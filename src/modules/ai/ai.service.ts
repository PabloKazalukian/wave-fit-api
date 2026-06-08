import { Injectable } from '@nestjs/common';
import { CreateAiInput } from './dto/create-ai.input';
import { UpdateAiInput } from './dto/update-ai.input';
import { UserContextInput } from '../user/user-profile/user-profile.utils';

@Injectable()
export class AiService {
  create(createAiInput: CreateAiInput) {
    return 'This action adds a new ai';
  }

  findAll() {
    return `This action returns all ai`;
  }

  findOne(id: number) {
    return `This action returns a #${id} ai`;
  }

  update(id: number, updateAiInput: UpdateAiInput) {
    return `This action updates a #${id} ai`;
  }

  remove(id: number) {
    return `This action removes a #${id} ai`;
  }

  async generatePlan(userContext: UserContextInput): Promise<{
    rawResponse;
    promptUsed: string;
    tokensUsed: number;
  }> {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content:
          'Eres un experto preparador físico global con +10 años de experiencia en entrenamiento funcional, hipertrofia, pérdida de grasa y rendimiento deportivo. Generas planes de entrenamiento realistas, progresivos y adaptados a la persona.',
      },
      {
        role: 'user',
        content: `Genera un plan de entrenamiento completo para el usuario con los siguientes datos:

CONTEXTO DEL USUARIO (JSON):
${JSON.stringify(userContext, null, 2)}

REGLAS:
- El plan debe tener ${userContext.goal.timelineWeeks} semanas
- Debe generar ${userContext.schedule.daysPerWeek} sesiones/semana en formato JSON válido.
- Incluye calentamiento, sesiones de fuerza/hipertrofia y vuelta a la calma.
- Añade notas de progresión y consejos personalizados.
- NO incluyas secciones extra, solo el JSON del plan.
`,
      },
    ];

    const response = await langChain.chat.completions.create({
      model: 'gpt-4o',
      messages,
    });

    const rawText = response.choices[0].message.content;

    return {
      rawResponse: rawText,
      promptUsed: messages.map((m) => m.content).join('\n'),
      tokensUsed: response.usage?.total_tokens || 0,
    };
  }
}
