// training-plan.service.ts — método principal

import { Injectable, NotFoundException } from '@nestjs/common';
import { TrainingPlanService } from '../training-plan.service';
import { UserService } from 'src/modules/user/user.service';
import { UserProfileService } from 'src/modules/user/user-profile';
import { addDays, addWeeks } from 'date-fns';
import { buildUserContextForAI } from 'src/modules/user/user-profile/user-profile.utils';
import { TrainingPlan } from '../entities/training-plan.entity';
import { WeekLogService } from 'src/modules/routines/tracking/week-log/week-log.service';
import { addDaysToLocalDate } from 'src/common/utils/date.utils';
import { Model } from 'mongoose';
import { AiService } from 'src/modules/ai/ai.service';

@Injectable()
export class PlanGeneratorService {
  constructor(
    private readonly trainingPlanService: TrainingPlanService,
    private readonly userService: UserService,
    private readonly userProfileService: UserProfileService,
    private readonly weekLogService: WeekLogService,
    private readonly aiService: AiService,
    private readonly trainingPlanModel: Model<TrainingPlan>,
    // private readonly userGoalService:UserGoalService
  ) {}

  async generatePlan(userId: string, goalId: string): Promise<TrainingPlan> {
    // 1. Obtener perfil completo
    const profile = await this.userProfileService.findByUserId(userId);

    if (!profile) {
      throw new NotFoundException('User profile not found');
    }

    const goal = await this.userProfileService.findUserGoalsActive(userId);

    if (!goal) {
      throw new NotFoundException('User goal not found');
    }

    // 2. Construir contexto para la IA
    const aiContext = buildUserContextForAI(profile); // tu util existente

    // 3. Llamar a la IA
    const { rawResponse, promptUsed, tokensUsed } =
      await this.aiService.generatePlan(aiContext);

    // 4. Parsear la respuesta (el JSON que devuelve la IA)
    const parsedPlan: GeneratedPlanDto = JSON.parse(rawResponse.content); //nose que es GeneratedPlanDto

    // 5. Crear el TrainingPlan con el snapshot
    const plan = await this.trainingPlanModel.create({
      userId,
      userProfileId: profile._id,
      goalId,
      title: parsedPlan.title,
      focus: parsedPlan.focus,
      startDate: new Date(),
      endDate: addWeeks(new Date(), parsedPlan.durationWeeks),
      durationWeeks: parsedPlan.durationWeeks,
      trainingDaysPerWeek: parsedPlan.daysPerWeek,
      totalSessionsPlanned: parsedPlan.durationWeeks * parsedPlan.daysPerWeek,
      aiSnapshot: {
        contextSentToAI: aiContext,
        promptUsed,
        modelUsed: 'gpt-4o',
        rawResponse,
        tokensUsed,
        generatedAt: new Date(),
      },
    });

    // 6. Crear los WeekLogs con sus sesiones
    for (let week = 1; week <= parsedPlan.durationWeeks; week++) {
      const weekStart = addWeeks(plan.startDate, week - 1);
      //Crear un week-log para iniciar.
      //   await this.weekLogService.create({
      //     planId: plan._id,
      //     // weekNumber: week,
      //     startDate: weekStart,
      //     endDate: addDaysToLocalDate(weekStart, 6),
      //     // sessions: parsedPlan.weeks[week - 1].sessions, // ya parseado desde IA
      //   },userId);
    }

    return plan;
  }
}
