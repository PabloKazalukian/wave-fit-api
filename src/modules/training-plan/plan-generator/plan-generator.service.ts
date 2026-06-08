// plan-generator.service.ts — método secundario

import { Injectable, NotFoundException } from '@nestjs/common';
import { UserProfileService } from 'src/modules/user/user-profile';
import { addWeeks } from 'date-fns';
import { buildUserContextForAI } from 'src/modules/user/user-profile/user-profile.utils';
import { TrainingPlan } from '../entities/training-plan.entity';
import { Model } from 'mongoose';
import { AiService } from 'src/modules/ai/ai.service';
import { InjectModel } from '@nestjs/mongoose';

@Injectable()
export class PlanGeneratorService {
  constructor(
    private readonly userProfileService: UserProfileService,
    @InjectModel(TrainingPlan.name) // <-- ¡AQUÍ ESTÁ LA MAGIA! Dile a Nest qué modelo inyectar
    private readonly trainingPlanModel: Model<TrainingPlan>,
    private readonly aiService: AiService,
  ) {}

  async generatePlan(userId: string, goalId: string): Promise<TrainingPlan> {
    const profile = await this.userProfileService.getFullLlmContext(userId);
    if (!profile) throw new NotFoundException('User profile not found');

    const goal = await this.userProfileService.findUserGoalsActive(userId);
    if (!goal) throw new NotFoundException('User goal not found');

    const aiContext = buildUserContextForAI(profile);

    // Definimos prompts limpios
    const systemPrompt = `Eres un experto preparador físico global con +10 años de experiencia... Generas planes realistas en formato JSON válido.`;

    const userPrompt = `Genera un plan de entrenamiento completo para el usuario con los siguientes datos:
    CONTEXTO DEL USUARIO (JSON):
    ${JSON.stringify(aiContext, null, 2)}
    
    REGLAS:
    - El plan debe tener ${goal?.timelineWeeks || 4} semanas.
    - Debe generar ${profile?.schedule?.daysPerWeek || 3} sesiones/semana.
    - NO incluyas secciones extra ni introducciones, solo devuelve un objeto JSON puro.`;

    // 3. LLAMADA GENERALIZADA A LA IA
    // Puedes cambiar 'groq' por 'openai' y el código de abajo ni se entera
    const providerTarget = process.env.PREFERRED_AI_PROVIDER || 'groq';

    const { rawContent, modelUsed, promptUsed, tokensUsed } =
      await this.aiService.executePrompt({
        providerName: providerTarget,
        systemPrompt,
        userPrompt,
      });

    // 4. Parsear la respuesta de forma segura
    // (Limpiamos posibles marcas de Markdown que a veces ponen los LLMs como ```json ... ```)
    const cleanJsonString = rawContent.replace(/```json|```/g, '').trim();
    const parsedPlan = JSON.parse(cleanJsonString);

    // 5. Crear el TrainingPlan en MongoDB con el snapshot unificado
    const plan = await this.trainingPlanModel.create({
      userId,
      userProfileId: profile.profile?.id,
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
        modelUsed: modelUsed, // Guardará exactamente si fue llama3 o gpt4o
        rawResponse: rawContent,
        tokensUsed,
        generatedAt: new Date(),
      },
    });

    // 6. Lógica de tus WeekLogs...
    return plan;
  }
}
