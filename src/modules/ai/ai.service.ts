// modules/ai/ai.service.ts
import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { IAiProvider } from './interfaces/ai-proider.interface';

@Injectable()
export class AiService {
  constructor(
    @Inject('AI_PROVIDERS')
    private readonly providers: Map<string, IAiProvider>,
  ) {}

  /**
   * Método generalizado para consultar a cualquier IA
   * @param providerName 'groq' | 'openai'
   */
  async executePrompt(options: {
    providerName: string;
    systemPrompt: string;
    userPrompt: string;
  }) {
    // 1. Validar y obtener el proveedor dinámicamente
    const provider = this.providers.get(options.providerName);
    if (!provider) {
      throw new BadRequestException(
        `Proveedor de IA no soportado: ${options.providerName}`,
      );
    }

    const model = provider.getModel();

    // 2. Estructurar los mensajes con LangChain
    const messages = [
      new SystemMessage(options.systemPrompt),
      new HumanMessage(options.userPrompt),
    ];

    // 3. Ejecutar la llamada de manera unificada
    // LangChain estandariza la ejecución con .invoke()
    const response: any = await model.invoke(messages);

    // 4. Control y mapeo de restricciones / tokens de forma unificada
    // LangChain guarda los metadatos de tokens en 'response_metadata' de manera estándar
    const tokenUsage = response.response_metadata?.tokenUsage || {
      completionTokens: 0,
      promptTokens: 0,
      totalTokens: 0,
    };
    console.log('[tokenUsage]', { tokenUsage });

    return {
      rawContent: response.content as string,
      modelUsed: response.response_metadata?.model_name || options.providerName,
      promptUsed: `${options.systemPrompt}\n${options.userPrompt}`,
      tokensUsed: tokenUsage?.totalTokens || 0,
    };
  }
}
