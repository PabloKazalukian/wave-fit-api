import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AI_CAUSE } from 'src/modules/ai/ai-error-causes';
import { ExerciseService } from 'src/modules/routines/templates/exercise/exercise.service';
import {
  WeekLogDayDomain,
  WeekLogDomain,
  WorkoutSessionCreationData,
} from 'src/modules/routines/tracking/week-log/domain/entities/week-log.domain';
import {
  todayInTimezone,
  addDaysToLocalDate,
  localDateToUtc,
} from 'src/common/utils/date.utils';
import {
  normalizeString,
  foldTokens,
  containsOppositeKeywords,
} from 'src/common/utils/string.utils';
import { distance } from 'fastest-levenshtein';
import { randomBytes } from 'crypto';
import { ParsedPlan } from '../plan-generator/plan-generator.parser';

const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

/** Umbral de Levenshtein para nombres cortos (≤15 chars normalizados). */
const FUZZY_THRESHOLD_SHORT = 2;
/** Umbral de Levenshtein para nombres largos (>15 chars normalizados). */
const FUZZY_THRESHOLD_LONG = 3;

interface CatalogEntry {
  id: unknown;
  name: string;
  /** Nombre normalizado (minúsculas, sin acentos). */
  norm: string;
  /** Tokens normalizados y singularizados, unidos por espacio. */
  foldedKey: string;
  /** Tokens normalizados y singularizados. */
  tokens: string[];
}

type MatchStrategy = 'exact' | 'folded' | 'subset' | 'levenshtein';

interface ResolutionContext {
  /** Índice exacto: nombre normalizado → entrada. */
  byName: Map<string, CatalogEntry>;
  /** Índice folded: tokens singularizados unidos → entrada. */
  byFolded: Map<string, CatalogEntry>;
  /** Todas las entradas del catálogo (deduplicadas). */
  entries: CatalogEntry[];
}

interface ResolvedMatch {
  entry: CatalogEntry;
  strategy: MatchStrategy;
}

/**
 * Convierte la respuesta estructurada de la IA (ParsedPlan) en las
 * entidades de tracking persistibles: WeekLogDomain + WorkoutSessions.
 *
 * Es compartido por la generación (generatePlan) y la confirmación
 * (confirmPlan): en ambos casos hay que resolver los nombres de ejercicios
 * devueltos por la IA contra el catálogo real y armar la semana con fechas
 * UTC derivadas del LocalDate del usuario.
 */
@Injectable()
export class PlanMaterializerService {
  private readonly logger = new Logger(PlanMaterializerService.name);

  constructor(private readonly exerciseService: ExerciseService) {}

  /**
   * Nombres únicos del catálogo (deduplicados por nombre normalizado),
   * listos para incrustar en el prompt de la IA.
   */
  buildUniqueCatalogNames(
    userId: string,
    catalog: Array<{ id: unknown; name: string }>,
  ): string[] {
    const byName = this.buildCatalogByName(userId, catalog);
    return [...byName.values()].map((e) => e.name);
  }

  /**
   * Resuelve ejercicios por nombre contra el catálogo vigente y construye
   * el WeekLog + sesiones correspondientes (startDate = hoy).
   */
  async materializeWeekLog(
    userId: string,
    plan: ParsedPlan,
  ): Promise<{
    weekLog: WeekLogDomain;
    sessions: WorkoutSessionCreationData[];
  }> {
    await this.resolveAgainstCatalog(userId, plan);
    return this.buildWeekLogFromPlan(userId, plan);
  }

  /**
   * Resuelve los nombres de ejercicios del plan contra el catálogo real
   * (resolución difusa por capas) y devuelve un mapa
   * exerciseId → metadata (nombre, categoría) para construir templates.
   */
  async resolveAgainstCatalog(
    userId: string,
    plan: ParsedPlan,
  ): Promise<Map<string, { name: string; category: string }>> {
    const exercises = await this.exerciseService.findAll();
    const ctx = this.buildResolutionContext(userId, exercises);
    this.resolveExercisesByName(userId, plan, ctx);

    const byId = new Map<string, { name: string; category: string }>();
    for (const exercise of exercises) {
      byId.set(String(exercise.id), {
        name: exercise.name,
        category: (exercise as any).category,
      });
    }
    return byId;
  }

  /**
   * Indexa el catálogo por nombre normalizado (único). Si dos ejercicios
   * colisionan tras normalizar, gana el primero y se advierte en el log:
   * es un problema de datos del catálogo, no de la generación.
   */
  private buildCatalogByName(
    userId: string,
    catalog: Array<{ id: unknown; name: string }>,
  ): Map<string, { id: unknown; name: string }> {
    const byName = new Map<string, { id: unknown; name: string }>();

    for (const exercise of catalog) {
      const key = normalizeString(exercise.name);
      if (!key) continue;
      if (byName.has(key)) {
        this.logger.warn(
          `[materializeWeekLog] Catálogo con nombres duplicados userId=${userId}: "${exercise.name}" colisiona con "${byName.get(key)!.name}"; se ignora el duplicado`,
        );
        continue;
      }
      byName.set(key, { id: exercise.id, name: exercise.name });
    }

    return byName;
  }

  /**
   * Construye el contexto de resolución: índice exacto, índice folded
   * (singular/plural) y listado de entradas para matching difuso.
   */
  private buildResolutionContext(
    userId: string,
    catalog: Array<{ id: unknown; name: string }>,
  ): ResolutionContext {
    const deduped = this.buildCatalogByName(userId, catalog);
    const byName = new Map<string, CatalogEntry>();
    const byFolded = new Map<string, CatalogEntry>();
    const entries: CatalogEntry[] = [];

    for (const [norm, { id, name }] of deduped) {
      const tokens = foldTokens(name);
      const foldedKey = tokens.join(' ');
      if (!foldedKey) continue;

      const entry: CatalogEntry = { id, name, norm, foldedKey, tokens };
      entries.push(entry);
      byName.set(norm, entry);

      const existing = byFolded.get(foldedKey);
      if (existing) {
        // Ej. "Elevación lateral" vs "Elevaciones laterales": mismo nombre
        // a efectos de singular/plural. Se conserva el primero y se avisa:
        // es un problema de datos del catálogo que conviene corregir.
        this.logger.warn(
          `[materializeWeekLog] Catálogo con nombres equivalentes (plural/singular) userId=${userId}: "${name}" colisiona con "${existing.name}"; se ignora el duplicado`,
        );
        continue;
      }
      byFolded.set(foldedKey, entry);
    }

    return { byName, byFolded, entries };
  }

  /**
   * Resolución de un nombre de la IA contra el catálogo, por capas:
   *
   * L1 `exact`:      match exacto tras normalizar (comportamiento original).
   * L2 `folded`:     igualdad ignorando plural/singular ("Mancuernas" → "mancuerna").
   * L3 `subset`:     todos los tokens del candidato están presentes en el nombre
   *                  de la IA (la IA agregó detalles como equipamiento). Gana el
   *                  candidato MÁS ESPECÍFICO (más tokens); empate entre ids
   *                  distintos se considera ambigüo y no resuelve.
   * L4 `levenshtein`: distancia acotada sobre el nombre completo, bloqueada si
   *                  hay palabras opuestas (barra/mancuerna, abd/add, etc.).
   *
   * Devuelve null si ninguna capa resuelve sin ambigüedad.
   */
  private resolveSingle(
    rawName: string,
    ctx: ResolutionContext,
  ): ResolvedMatch | null {
    // L1 — exacto
    const exact = ctx.byName.get(normalizeString(rawName));
    if (exact) {
      return { entry: exact, strategy: 'exact' };
    }

    // L2 — igualdad folded (singular/plural)
    const foldedKey = foldTokens(rawName).join(' ');
    if (foldedKey) {
      const folded = ctx.byFolded.get(foldedKey);
      if (folded) return { entry: folded, strategy: 'folded' };
    }

    // L3 — subconjunto de tokens (el candidato está contenido en el nombre IA)
    const queryTokens = new Set(foldTokens(rawName));
    if (queryTokens.size > 0) {
      let best: CatalogEntry | null = null;
      let ambiguous = false;

      for (const candidate of ctx.entries) {
        if (
          candidate.tokens.length === 0 ||
          candidate.tokens.length > queryTokens.size ||
          !candidate.tokens.every((t) => queryTokens.has(t))
        ) {
          continue;
        }
        if (!best || candidate.tokens.length > best.tokens.length) {
          best = candidate;
          ambiguous = false;
        } else if (
          candidate.tokens.length === best.tokens.length &&
          candidate.id !== best.id
        ) {
          ambiguous = true;
        }
      }

      if (best && !ambiguous) return { entry: best, strategy: 'subset' };
    }

    // L4 — Levenshtein sobre el string completo, con guarda de opuestos
    const normQuery = normalizeString(rawName);
    if (normQuery) {
      const threshold =
        normQuery.length <= 15 ? FUZZY_THRESHOLD_SHORT : FUZZY_THRESHOLD_LONG;
      let best: CatalogEntry | null = null;
      let bestDistance = Infinity;
      let ambiguous = false;

      for (const candidate of ctx.entries) {
        if (!candidate.norm) continue;
        const d = distance(normQuery, candidate.norm);
        if (d > threshold) continue;
        if (containsOppositeKeywords(normQuery, candidate.norm)) continue;
        if (!best || d < bestDistance) {
          best = candidate;
          bestDistance = d;
          ambiguous = false;
        } else if (d === bestDistance && candidate.id !== best.id) {
          ambiguous = true;
        }
      }

      if (best && !ambiguous) return { entry: best, strategy: 'levenshtein' };
    }

    return null;
  }

  /**
   * Nombres del catálogo más cercanos a un nombre desconocido, para
   * diagnosticar si fue un typo de la IA o una inconsistencia del catálogo.
   */
  private nearestCatalogNames(
    rawName: string,
    ctx: ResolutionContext,
    limit: number,
  ): string[] {
    const normQuery = normalizeString(rawName);
    if (!normQuery) return [];

    return [...ctx.entries]
      .map((e) => ({ name: e.name, d: distance(normQuery, e.norm) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, limit)
      .filter((e) => e.d <= FUZZY_THRESHOLD_LONG + 2)
      .map((e) => `"${e.name}"`);
  }

  /**
   * Resuelve el exerciseId de cada ejercicio del plan contra el catálogo
   * usando la resolución por capas. Muta el plan in-place.
   *
   * Los nombres genuinamente irresolubles se DESCARTAN con advertencia y la
   * generación continúa con lo válido (un ejercicio inventado por la IA no
   * debe tirar todo el plan). Solo falla con 400 si NINGÚN ejercicio del
   * plan resolvió contra el catálogo (plan inservible).
   */
  private resolveExercisesByName(
    userId: string,
    plan: ParsedPlan,
    ctx: ResolutionContext,
  ): void {
    const invalidNames = new Set<string>();
    const fuzzyMatches: string[] = [];
    let resolvedCount = 0;
    let totalCount = 0;

    for (const day of plan.days) {
      if (day.isRest) continue;
      totalCount += day.exercises.length;
      const kept: typeof day.exercises = [];
      for (const ex of day.exercises) {
        const match = this.resolveSingle(ex.name, ctx);
        if (!match) {
          invalidNames.add(ex.name);
          continue;
        }
        ex.exerciseId = String(match.entry.id);
        ex.name = match.entry.name;
        kept.push(ex);
        resolvedCount++;
        if (match.strategy !== 'exact') {
          fuzzyMatches.push(
            `"${ex.name}" → "${match.entry.name}" [${match.strategy}]`,
          );
        }
      }
      day.exercises = kept;
      // Invariante isRest ⇔ día sin ejercicios (tras descartar desconocidos)
      if (kept.length === 0) {
        day.isRest = true;
      }
    }

    if (fuzzyMatches.length > 0) {
      // Visible a propósito: cada match difuso sugiere o un typo de la IA o
      // una inconsistencia del catálogo que conviene corregir.
      this.logger.warn(
        `[materializeWeekLog] Resolución difusa userId=${userId} (${fuzzyMatches.length}/${resolvedCount} ejercicios): ${fuzzyMatches.join('; ')}`,
      );
    }

    if (invalidNames.size === 0) return;

    const list = [...invalidNames];
    const details = list.map((name) => {
      const near = this.nearestCatalogNames(name, ctx, 3);
      return near.length > 0 ? `${name} (¿quiso decir: ${near.join(' | ')}?)` : name;
    });

    // Plan inservible: había ejercicios y ninguno resolvió contra el catálogo.
    if (totalCount > 0 && resolvedCount === 0) {
      this.logger.error(
        `${AI_CAUSE.UNKNOWN_EXERCISE_NAME}: la IA devolvió ${list.length} nombres fuera del catálogo y ninguno resolvió: [${details.join(', ')}]`,
      );
      throw new BadRequestException({
        message: `Ningún ejercicio devuelto por la IA existe en el catálogo: [${details.join(', ')}]`,
        code: AI_CAUSE.UNKNOWN_EXERCISE_NAME,
        invalidExerciseNames: list,
      });
    }

    // Descarte parcial: continúa con los ejercicios válidos.
    this.logger.warn(
      `[materializeWeekLog] Ejercicios descartados por ausentes en catálogo userId=${userId}: ${details.join(', ')}`,
    );
  }

  private buildWeekLogFromPlan(
    userId: string,
    plan: ParsedPlan,
  ): { weekLog: WeekLogDomain; sessions: WorkoutSessionCreationData[] } {
    const startDate = todayInTimezone(DEFAULT_TIMEZONE);
    const endDate: string = addDaysToLocalDate(startDate, 6);
    const weekLogId = randomBytes(12).toString('hex');

    const sessionsToInsert: WorkoutSessionCreationData[] = [];

    const days: WeekLogDayDomain[] = plan.days.map((day, index) => {
      const dayLocalDate: string = addDaysToLocalDate(startDate, index);
      const dayUtcDate: Date = localDateToUtc(dayLocalDate, DEFAULT_TIMEZONE);

      let workoutSessionId: string | null = null;
      let exercises: any[] = [];

      if (!day.isRest && day.exercises.length > 0) {
        const sessionId = randomBytes(12).toString('hex');
        workoutSessionId = sessionId;

        exercises = day.exercises.map((e) => ({
          exerciseId: e.exerciseId,
          series: 0,
          sets: [],
        }));

        sessionsToInsert.push({
          _id: sessionId,
          userId,
          weekLogId,
          date: dayUtcDate,
          exercises: day.exercises.map((e) => ({
            exerciseId: e.exerciseId,
            series: 0,
            sets: [],
          })),
          status: 'not_started',
        });
      }

      return new WeekLogDayDomain(
        day.order,
        dayUtcDate,
        day.isRest,
        workoutSessionId,
        [],
        'pending',
        exercises,
      );
    });

    const weekLog = new WeekLogDomain(
      weekLogId,
      userId,
      localDateToUtc(startDate, DEFAULT_TIMEZONE),
      localDateToUtc(endDate, DEFAULT_TIMEZONE),
      null,
      days,
      false,
      true,
    );

    return { weekLog, sessions: sessionsToInsert };
  }
}
