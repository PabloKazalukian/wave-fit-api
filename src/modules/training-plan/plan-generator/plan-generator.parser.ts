import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AI_CAUSE } from 'src/modules/ai/ai-error-causes';

export interface ParsedDayExercise {
  exerciseId: string;
  name: string;
  plannedSets: number;
  plannedReps: string;
  rpe: number | null;
  restSeconds: number | null;
  notes: string | null;
}

export interface ParsedDay {
  order: number;
  isRest: boolean;
  focus: string | null;
  exercises: ParsedDayExercise[];
}

export interface ParsedPlan {
  title: string;
  focus: string;
  durationWeeks: number;
  daysPerWeek: number;
  days: ParsedDay[];
}

@Injectable()
export class PlanGeneratorParser {
  private readonly logger = new Logger(PlanGeneratorParser.name);

  parse(rawResponse: string): ParsedPlan {
    return this.parseWithRawJson(rawResponse).plan;
  }

  parseWithRawJson(rawResponse: string): {
    plan: ParsedPlan;
    rawJson: Record<string, any>;
  } {
    const json = this.extractJson(rawResponse);

    let plan: Record<string, any>;
    try {
      plan = JSON.parse(json);
    } catch (err) {
      // Log del contenido crudo truncado para diagnóstico post-mortem
      this.logger.error(
        `${AI_CAUSE.MALFORMED_JSON}: la IA devolvió JSON inválido. Contenido crudo : ${rawResponse}`,
      );
      console.log('[Error de iA]', err);
      throw new BadRequestException(
        'La IA devolvió una respuesta JSON malformada',
      );
    }

    this.validate(plan);

    return { plan: this.normalize(plan), rawJson: plan };
  }

  /**
   * Extrae y limpia el JSON de la respuesta cruda de la IA.
   *
   * Además de quitar los delimitadores de código (```json ... ```), tolera
   * JSON "manchado" por caracteres extra después del objeto (p. ej. un `}`
   * sobrante, texto de cierre, etc.), muy común en modelos generativos. Se
   * localiza el primer `{`, se recorre con conciencia de strings y depth para
   * encontrar el cierre balanceado, y se prueba JSON.parse. Si el recorte
   * directo falla, se vuelve a intentar recortando desde el cierre hacia atrás.
   */
  private extractJson(content: string): string {
    const cleaned = content
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    const start = cleaned.indexOf('{');
    if (start === -1) return cleaned;

    // 1) Intentar el recorte balanceado (ignora strings y llaves sobrantes al final).
    const candidate = this.balancedSlice(cleaned, start);
    if (candidate !== null) {
      try {
        JSON.parse(candidate);
        return candidate;
      } catch {
        // El recorte balanceado no parsea; se intenta el recorte iterativo.
      }
    }

    // 2) Fallback: probar recortes sucesivos desde el último `}` hasta parsear.
    const lastBrace = cleaned.lastIndexOf('}');
    if (lastBrace > start) {
      for (let end = lastBrace; end > start; end--) {
        const slice = cleaned.slice(start, end + 1);
        try {
          JSON.parse(slice);
          return slice;
        } catch {
          // seguir recortando
        }
      }
    }
    return cleaned;
  }

  /**
   * Devuelve el slice desde `start` hasta el `}` que cierra el objeto,
   * ignorando llaves dentro de strings. Retorna null si no encuentra cierre.
   */
  private balancedSlice(content: string, start: number): string | null {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < content.length; i++) {
      const ch = content[i];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
      } else if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          return content.slice(start, i + 1);
        }
      }
    }
    return null;
  }

  private validate(plan: any) {
    if (!plan.days)
      throw new BadRequestException('AI response missing "days" array');
    if (!Array.isArray(plan.days))
      throw new BadRequestException('days must be an array');
    if (plan.days.length !== 7)
      throw new BadRequestException('days must contain exactly 7 entries');

    for (const day of plan.days) {
      if (typeof day.order !== 'number')
        throw new BadRequestException('Each day must have a numeric "order"');
      if (typeof day.isRest !== 'boolean')
        throw new BadRequestException('Each day must have a boolean "isRest"');
      if (!day.isRest && Array.isArray(day.exercises)) {
        for (const ex of day.exercises) {
          if (typeof ex.name !== 'string' || !ex.name.trim())
            throw new BadRequestException(
              'Each exercise must have a non-empty "name"',
            );
        }
      }
    }
  }

  private normalize(plan: any): ParsedPlan {
    return {
      title: plan.title ?? 'Training Plan',
      focus: plan.focus ?? '',
      durationWeeks: Math.max(1, Number(plan.durationWeeks ?? 1)),
      daysPerWeek: Number(plan.daysPerWeek ?? 3),
      days: this.normalizeDays(plan.days),
    };
  }

  private normalizeDays(days: any[]): ParsedDay[] {
    return days.map((d) => ({
      order: Number(d.order),
      isRest: Boolean(d.isRest),
      focus: d.focus || null,
      exercises: Array.isArray(d.exercises)
        ? d.exercises.map((e) => ({
            // exerciseId se resuelve después en el service, buscando
            // el name en el catálogo real de la DB.
            exerciseId: '',
            name: String(e.name ?? '').trim(),
            plannedSets: Number(e.plannedSets ?? e.sets ?? 0),
            plannedReps: String(e.plannedReps ?? e.reps ?? ''),
            rpe: e.rpe != null ? Number(e.rpe) : null,
            restSeconds: e.restSeconds != null ? Number(e.restSeconds) : null,
            notes: e.notes || null,
          }))
        : [],
    }));
  }
}
