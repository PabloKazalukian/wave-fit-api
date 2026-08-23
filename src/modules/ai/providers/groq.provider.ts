// modules/ai/providers/groq.provider.ts
import { Injectable } from '@nestjs/common';
import { IAiProvider } from '../interfaces/ai-proider.interface';
import { ChatGroq } from '@langchain/groq';
// import { IAiProvider } from '../interfaces/ai-provider.interface';

const DEFAULT_CALL_TIMEOUT_MS = 45000;
/**
 * El límite TPM de Groq cuenta prompt + max_completion_tokens.
 * Con TPM=8000 y prompts de ~1.6k tokens, un maxTokens de 8192
 * revienta el presupuesto (9761 > 8000). Un plan semanal en JSON
 * consume ~1.5k tokens de salida; 5000 deja margen holgado.
 */
const DEFAULT_MAX_OUTPUT_TOKENS = 5000;

@Injectable()
export class GroqProvider implements IAiProvider {
  readonly name = 'groq';
  private model: ChatGroq;

  constructor() {
    this.model = new ChatGroq({
      model: 'openai/gpt-oss-120b',
      apiKey: process.env.GROQ_API_KEY,
      temperature: 0,
      // Presupuesto de salida explícito: sin esto, un modelo de razonamiento
      // puede agotar los tokens mientras razona y devolver content vacío.
      maxTokens: Number(
        process.env.AI_MAX_OUTPUT_TOKENS ?? DEFAULT_MAX_OUTPUT_TOKENS,
      ),
      // Reduce los tokens gastados en razonamiento interno (gpt-oss)
      reasoningEffort: 'low',
      // Sin reintentos internos del SDK: la única capa de reintento vive en
      // AiService, con backoff y presupuesto global de tiempo acotado.
      maxRetries: 0,
      timeout: Number(
        process.env.AI_CALL_TIMEOUT_MS ?? DEFAULT_CALL_TIMEOUT_MS,
      ),
    });
  }

  getModel() {
    return this.model;
  }
}
