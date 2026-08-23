// modules/ai/ai.service.ts
import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { IAiProvider } from './interfaces/ai-proider.interface';
import { AiRateLimitService } from './ai-rate-limit.service';
import { AI_CAUSE, AiErrorCause } from './ai-error-causes';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_TOTAL_BUDGET_MS = 80000;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 4000;

interface ExecutePromptOptions {
  providerName: string;
  systemPrompt: string;
  userPrompt: string;
  userId?: string;
}

interface ErrorClassification {
  cause: AiErrorCause;
  transient: boolean;
  httpStatus?: number;
}

/**
 * Marcador para respuestas del proveedor que llegan "exitosas" pero sin
 * contenido (ej. modelos de razonamiento que agotan tokens en reasoning).
 * Permite reintentarlas aunque `model.invoke` no haya lanzado error.
 */
const EMPTY_RESPONSE_MARKER = 'aiEmptyResponse';

function emptyResponseError(
  finishReason: string | undefined,
  completionTokens: number,
): Error {
  const err = new Error(
    `Respuesta vacía del proveedor de IA (finishReason=${finishReason ?? 'n/a'}, completionTokens=${completionTokens})`,
  );
  (err as any)[EMPTY_RESPONSE_MARKER] = true;
  return err;
}

function extractRawContent(response: any): string {
  const content = response?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === 'string' ? part : (part?.text ?? ''),
      )
      .join('')
      .trim();
  }
  return '';
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @Inject('AI_PROVIDERS')
    private readonly providers: Map<string, IAiProvider>,
    private readonly rateLimiter: AiRateLimitService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  /**
   * Método generalizado para consultar a cualquier IA.
   * Incluye rate limit por usuario y una única capa de reintento externa
   * (solo errores transitorios) con presupuesto global de tiempo compartido
   * entre intentos, para acotar la espera del usuario.
   *
   * @param providerName 'groq' | 'openai'
   */
  async executePrompt(options: ExecutePromptOptions) {
    // 0. Rate limit por usuario (fixed window diario) antes de invocar el modelo
    if (options.userId) {
      await this.rateLimiter.assertWithinLimit(options.userId);
    }

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

    // [PROMPT] DEBUG: ver el prompt exacto que se envía a la IA (descomentar para debuguear)
    // console.log(
    //   `\n========== [AI PROMPT] provider=${options.providerName} userId=${options.userId ?? 'n/a'} ==========`,
    // );
    // console.log(`--- SYSTEM (${options.systemPrompt.length} chars) ---`);
    // console.log(options.systemPrompt);
    // console.log(`--- USER (${options.userPrompt.length} chars) ---`);
    // console.log(options.userPrompt);
    // console.log(
    //   `========== [FIN AI PROMPT] total=${options.systemPrompt.length + options.userPrompt.length} chars ==========\n`,
    // );

    // 3. Loop de reintentos con presupuesto total compartido
    const maxAttempts = Math.max(
      1,
      Number(process.env.AI_MAX_ATTEMPTS ?? DEFAULT_MAX_ATTEMPTS),
    );
    const budgetDeadline =
      Date.now() +
      Math.max(1000, Number(process.env.AI_TOTAL_BUDGET_MS ?? DEFAULT_TOTAL_BUDGET_MS));

    const startedAt = Date.now();
    let lastError: unknown;
    let lastClassification: ErrorClassification | undefined;
    let attemptsMade = 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (Date.now() >= budgetDeadline) {
        this.logger.warn(
          `[executePrompt] Presupuesto de tiempo agotado antes del intento ${attempt}/${maxAttempts}`,
        );
        break;
      }

      attemptsMade = attempt;
      const attemptStartedAt = Date.now();
      try {
        const response: any = await model.invoke(messages);
        return this.finalizeSuccess(response, options, startedAt);
      } catch (error) {
        lastError = error;
        lastClassification = this.classifyError(error);
        const attemptDurationMs = Date.now() - attemptStartedAt;

        this.logger.warn(
          `[executePrompt] Intento ${attempt}/${maxAttempts} falló causa=${lastClassification.cause} status=${lastClassification.httpStatus ?? 'n/a'} durationMs=${attemptDurationMs}: ${errorMessage(error)}`,
        );

        if (!lastClassification.transient || attempt >= maxAttempts) break;

        const delay = this.resolveBackoffDelayMs(
          attempt,
          lastClassification,
          error,
          budgetDeadline,
        );
        if (delay === null) {
          this.logger.warn(
            `[executePrompt] Sin presupuesto para backoff tras intento ${attempt}; se abandona`,
          );
          break;
        }
        await this.sleep(delay);
      }
    }

    // 4. Fallo definitivo: log + audit una sola vez y re-lanzar
    if (lastError === undefined) {
      throw new BadRequestException(
        'No se pudo ejecutar el prompt de IA: presupuesto de tiempo insuficiente',
      );
    }
    this.finalizeFailure(
      lastError,
      lastClassification,
      options,
      startedAt,
      attemptsMade,
    );
  }

  private finalizeSuccess(
    response: any,
    options: ExecutePromptOptions,
    startedAt: number,
  ) {
    // Respuesta HTTP "exitosa" pero sin contenido: se trata como fallo
    // reintentable (los modelos de razonamiento pueden devolver content vacío
    // si agotan el presupuesto de salida mientras razonan).
    const rawContent = extractRawContent(response);
    if (!rawContent) {
      throw emptyResponseError(
        response?.response_metadata?.finish_reason,
        response?.response_metadata?.tokenUsage?.completionTokens ?? 0,
      );
    }

    const durationMs = Date.now() - startedAt;

    // LangChain guarda los metadatos de tokens en 'response_metadata' de manera estándar
    const tokenUsage = response.response_metadata?.tokenUsage || {
      completionTokens: 0,
      promptTokens: 0,
      totalTokens: 0,
    };
    const modelUsed =
      response.response_metadata?.model_name || options.providerName;
    const tokensUsed = tokenUsage?.totalTokens || 0;

    this.logger.log(
      `[executePrompt] OK provider=${options.providerName} model=${modelUsed} durationMs=${durationMs} tokensUsed=${tokensUsed}`,
    );
    this.auditLogsService.logAsync({
      action: 'AI_PROMPT_EXECUTED',
      entity: 'Ai',
      ...(options.userId && { userId: options.userId }),
      success: true,
      metadata: {
        provider: options.providerName,
        modelUsed,
        durationMs,
        tokensUsed,
      },
    });

    return {
      rawContent,
      modelUsed,
      promptUsed: `${options.systemPrompt}\n${options.userPrompt}`,
      tokensUsed,
    };
  }

  private finalizeFailure(
    error: unknown,
    classification: ErrorClassification | undefined,
    options: ExecutePromptOptions,
    startedAt: number,
    attemptsMade: number,
  ): never {
    const cause = classification?.cause ?? AI_CAUSE.PROVIDER;
    const transient = classification?.transient ?? false;
    const httpStatus = classification?.httpStatus;
    const durationMs = Date.now() - startedAt;
    const message = errorMessage(error);

    this.logger.error(
      `[executePrompt] FALLO provider=${options.providerName} causa=${cause} status=${httpStatus ?? 'n/a'} intentos=${attemptsMade} durationMs=${durationMs}: ${message}`,
      error instanceof Error ? error.stack : undefined,
    );
    this.auditLogsService.logAsync({
      action: 'AI_PROMPT_EXECUTED',
      entity: 'Ai',
      ...(options.userId && { userId: options.userId }),
      success: false,
      errorMessage: message,
      metadata: {
        cause,
        transient,
        ...(httpStatus !== undefined && { httpStatus }),
        provider: options.providerName,
        attempts: attemptsMade,
        durationMs,
      },
    });

    throw error;
  }

  /**
   * Backoff corto fijo con cap; en 429 respeta Retry-After si viene.
   * Devuelve null si el delay no entra en el presupuesto restante.
   */
  private resolveBackoffDelayMs(
    attempt: number,
    classification: ErrorClassification,
    error: unknown,
    budgetDeadline: number,
  ): number | null {
    let delay = Math.min(BASE_BACKOFF_MS * attempt, MAX_BACKOFF_MS);

    if (classification.httpStatus === 429) {
      const retryAfterMs = this.extractRetryAfterMs(error);
      if (retryAfterMs !== null && retryAfterMs > 0) {
        // Se respeta el Retry-After del proveedor; el presupuesto global
        // decide si alcanza o se abandona.
        delay = retryAfterMs;
      }
    }

    if (Date.now() + delay > budgetDeadline) return null;
    return delay;
  }

  private extractRetryAfterMs(error: unknown): number | null {
    const headers = (error as any)?.response?.headers;
    const raw = headers?.['retry-after'] ?? headers?.get?.('retry-after');
    if (typeof raw !== 'string' && typeof raw !== 'number') return null;

    const value = String(raw).trim();
    if (!value) return null;
    if (/^\d+$/.test(value)) return Number(value) * 1000;

    const dateMs = Date.parse(value);
    return Number.isNaN(dateMs) ? null : Math.max(0, dateMs - Date.now());
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Clasifica el error del proveedor en la taxonomía mínima de causas.
   * `transient` marca los reintentables (network / timeout / 5xx / 429).
   */
  private classifyError(error: unknown): ErrorClassification {
    const err = error as {
      code?: unknown;
      message?: unknown;
      status?: unknown;
      response?: { status?: unknown };
    };

    const message = typeof err?.message === 'string' ? err.message : '';
    const rawStatus = err?.response?.status ?? err?.status;
    const httpStatus = typeof rawStatus === 'number' ? rawStatus : undefined;

    if ((error as any)?.[EMPTY_RESPONSE_MARKER] === true) {
      return { cause: AI_CAUSE.EMPTY_RESPONSE, transient: true };
    }

    const isTimeout =
      err?.code === 'ETIMEDOUT' ||
      err?.code === 'ECONNABORTED' ||
      /timed?[ -]?out/i.test(message);

    if (isTimeout) {
      return { cause: AI_CAUSE.PROVIDER, transient: true };
    }

    if (httpStatus !== undefined) {
      if (httpStatus === 429) {
        return { cause: AI_CAUSE.RATE_LIMIT, transient: true, httpStatus };
      }
      return {
        cause: AI_CAUSE.PROVIDER,
        transient: httpStatus >= 500,
        httpStatus,
      };
    }

    // Errores de red sin HTTP status (ECONNREFUSED, ENOTFOUND, fetch failed...)
    if (
      typeof err?.code === 'string' &&
      /^(E[A-Z]{4,}|UND_ERR)/.test(err.code)
    ) {
      return { cause: AI_CAUSE.PROVIDER, transient: true };
    }

    return { cause: AI_CAUSE.PROVIDER, transient: false };
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
