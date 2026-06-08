// modules/ai/interfaces/ai-provider.interface.ts
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

export interface IAiProvider {
  name: string;
  getModel(): BaseChatModel; // Retorna la instancia unificada de LangChain
}
