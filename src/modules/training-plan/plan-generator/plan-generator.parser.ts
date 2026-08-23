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
        `${AI_CAUSE.MALFORMED_JSON}: la IA devolvió JSON inválido. Contenido crudo (primeros 500 chars): ${rawResponse.slice(0, 500)}`,
      );
      console.log('[Error de iA]', err);
      throw new BadRequestException(
        'La IA devolvió una respuesta JSON malformada',
      );
    }

    this.validate(plan);

    return { plan: this.normalize(plan), rawJson: plan };
  }

  private extractJson(content: string) {
    return content
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
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
