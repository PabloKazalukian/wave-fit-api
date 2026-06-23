import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class PlanGeneratorParser {
  parse(rawResponse: string) {
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
    if (!plan.weeks) throw new BadRequestException('AI generated invalid plan');

    if (!Array.isArray(plan.weeks))
      throw new BadRequestException('Weeks must be array');
  }

  private normalize(plan: any) {
    return {
      title: plan.title ?? 'Training Plan',

      durationWeeks: Number(plan.durationWeeks ?? 4),

      daysPerWeek: Number(plan.daysPerWeek ?? 3),

      //   weeks:
      //       plan.weeks.map(...)
    };
  }
}
