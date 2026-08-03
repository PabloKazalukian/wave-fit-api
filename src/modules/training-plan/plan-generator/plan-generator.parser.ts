import { BadRequestException, Injectable } from '@nestjs/common';

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
  parse(rawResponse: string): ParsedPlan {
    const json = this.extractJson(rawResponse);

    const plan = JSON.parse(json);

    this.validate(plan);

    return this.normalize(plan);
  }

  private extractJson(content: string) {
    return content
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
  }

  private validate(plan: any) {
    if (!plan.days) throw new BadRequestException('AI response missing "days" array');
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
          if (!ex.exerciseId)
            throw new BadRequestException(
              'Each exercise must have an "exerciseId"',
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
            exerciseId: e.exerciseId,
            name: e.name || '',
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
