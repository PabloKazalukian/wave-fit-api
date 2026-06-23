import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { UserProfileService } from 'src/modules/user/user-profile';
import { addWeeks } from 'date-fns';
import { buildUserContextForAI } from 'src/modules/user/user-profile/user-profile.utils';
import { TrainingPlan } from '../entities/training-plan.entity';
import { Model } from 'mongoose';
import { AiService } from 'src/modules/ai/ai.service';
import { InjectModel } from '@nestjs/mongoose';
import { PlanValidatorService } from '../plan-validator/plan-validator.service';
import { buildPlanPrompts } from './plan-generator.prompt';

@Injectable()
export class PlanGeneratorService {
  constructor(
    private readonly userProfileService: UserProfileService,
    @InjectModel(TrainingPlan.name)
    private readonly trainingPlanModel: Model<TrainingPlan>,
    private readonly aiService: AiService,
    private readonly planValidator: PlanValidatorService,
  ) {}

  async generatePlan(userId: string, goalId: string): Promise<TrainingPlan> {
    const validation = await this.planValidator.validate(userId);
    if (!validation.valid) {
      throw new BadRequestException({
        message: 'Faltan datos obligatorios para generar el plan',
        missing: validation.missing,
        recommended: validation.recommended,
      });
    }

    const profile = await this.userProfileService.getFullProfileContext(userId);
    if (!profile.profile) throw new NotFoundException('User profile not found');

    // const goal = await this.userProfileService.findUserGoalsActive(userId);
    // if (!goal) throw new NotFoundException('User goal not found');

    const aiContext = buildUserContextForAI(profile);

    const { systemPrompt, userPrompt } = buildPlanPrompts(aiContext);

    const providerTarget = process.env.PREFERRED_AI_PROVIDER || 'groq';

    const { rawContent, modelUsed, promptUsed, tokensUsed } =
      await this.aiService.executePrompt({
        providerName: providerTarget,
        systemPrompt,
        userPrompt,
      });

    const cleanJsonString = rawContent.replace(/```json|```/g, '').trim();
    const parsedPlan = JSON.parse(cleanJsonString);

    const plan = await this.trainingPlanModel.create({
      userId,
      userProfileId: profile.profile._id,
      goalId,
      title: parsedPlan.title || 'Plan de Entrenamiento Personalizado',
      focus: parsedPlan.focus || 'General',
      startDate: new Date(),
      endDate: addWeeks(new Date(), parsedPlan.durationWeeks || 4),
      durationWeeks: parsedPlan.durationWeeks || 4,
      trainingDaysPerWeek: parsedPlan.daysPerWeek || 3,
      totalSessionsPlanned:
        (parsedPlan.durationWeeks || 4) * (parsedPlan.daysPerWeek || 3),
      aiSnapshot: {
        contextSentToAI: aiContext,
        promptUsed,
        modelUsed,
        rawResponse: rawContent,
        tokensUsed,
        generatedAt: new Date(),
      },
    });

    return plan;
  }
}
