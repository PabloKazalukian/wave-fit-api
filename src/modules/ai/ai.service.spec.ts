import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, Logger } from '@nestjs/common';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { AiService } from './ai.service';
import { AiRateLimitService } from './ai-rate-limit.service';
import { AI_CAUSE } from './ai-error-causes';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

describe('AiService', () => {
  let service: AiService;

  const invokeMock = jest.fn();
  const assertWithinLimitMock = jest.fn();
  const logAsyncMock = jest.fn();

  const providers = new Map<string, any>([
    [
      'groq',
      {
        name: 'groq',
        getModel: () => ({ invoke: invokeMock }),
      },
    ],
  ]);

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: 'AI_PROVIDERS', useValue: providers },
        {
          provide: AiRateLimitService,
          useValue: { assertWithinLimit: assertWithinLimitMock },
        },
        { provide: AuditLogsService, useValue: { logAsync: logAsyncMock } },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    // Evita esperas reales de backoff en los tests de reintento
    (service as any).sleep = jest.fn().mockResolvedValue(undefined);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('lanza BadRequestException si el proveedor no está registrado', async () => {
    await expect(
      service.executePrompt({
        providerName: 'openai',
        systemPrompt: 'sys',
        userPrompt: 'usr',
      }),
    ).rejects.toThrow(
      new BadRequestException('Proveedor de IA no soportado: openai'),
    );
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('invoca el modelo con SystemMessage y HumanMessage en orden', async () => {
    invokeMock.mockResolvedValue({ content: 'respuesta' });

    await service.executePrompt({
      providerName: 'groq',
      systemPrompt: 'Eres un entrenador',
      userPrompt: 'Genera un plan',
    });

    expect(invokeMock).toHaveBeenCalledTimes(1);
    const messages = invokeMock.mock.calls[0][0];
    expect(messages).toHaveLength(2);
    expect(messages[0]).toBeInstanceOf(SystemMessage);
    expect(messages[0].content).toBe('Eres un entrenador');
    expect(messages[1]).toBeInstanceOf(HumanMessage);
    expect(messages[1].content).toBe('Genera un plan');
  });

  it('mapea contenido, modelo y tokens desde response_metadata', async () => {
    invokeMock.mockResolvedValue({
      content: 'plan generado',
      response_metadata: {
        model_name: 'llama-3.3-70b',
        tokenUsage: {
          completionTokens: 120,
          promptTokens: 80,
          totalTokens: 200,
        },
      },
    });

    const result = await service.executePrompt({
      providerName: 'groq',
      systemPrompt: 'sys',
      userPrompt: 'usr',
    });

    expect(result).toEqual({
      rawContent: 'plan generado',
      modelUsed: 'llama-3.3-70b',
      promptUsed: 'sys\nusr',
      tokensUsed: 200,
    });
  });

  it('aplica fallbacks cuando la respuesta no trae metadata', async () => {
    invokeMock.mockResolvedValue({ content: 'sin metadata' });

    const result = await service.executePrompt({
      providerName: 'groq',
      systemPrompt: 'sys',
      userPrompt: 'usr',
    });

    expect(result.modelUsed).toBe('groq');
    expect(result.tokensUsed).toBe(0);
  });

  it('usa 0 tokens si tokenUsage no trae totalTokens', async () => {
    invokeMock.mockResolvedValue({
      content: 'ok',
      response_metadata: { model_name: 'llama', tokenUsage: {} },
    });

    const result = await service.executePrompt({
      providerName: 'groq',
      systemPrompt: 's',
      userPrompt: 'u',
    });

    expect(result.tokensUsed).toBe(0);
    expect(result.modelUsed).toBe('llama');
  });

  it('propaga errores del proveedor subyacente', async () => {
    invokeMock.mockRejectedValue(new Error('rate limit'));

    await expect(
      service.executePrompt({
        providerName: 'groq',
        systemPrompt: 's',
        userPrompt: 'u',
      }),
    ).rejects.toThrow('rate limit');
  });

  describe('rate limit', () => {
    it('corta rate limit cuando viene userId', async () => {
      invokeMock.mockResolvedValue({ content: 'ok' });

      await service.executePrompt({
        providerName: 'groq',
        systemPrompt: 's',
        userPrompt: 'u',
        userId: '507f1f77bcf86cd799439011',
      });

      expect(assertWithinLimitMock).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
      );
      expect(invokeMock).toHaveBeenCalledTimes(1);
    });

    it('propaga el HttpException del rate limiter sin invocar el modelo', async () => {
      assertWithinLimitMock.mockRejectedValue(
        new BadRequestException('Límite diario de generaciones alcanzado'),
      );

      await expect(
        service.executePrompt({
          providerName: 'groq',
          systemPrompt: 's',
          userPrompt: 'u',
          userId: '507f1f77bcf86cd799439011',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(invokeMock).not.toHaveBeenCalled();
    });

    it('no corta rate limit cuando no viene userId', async () => {
      invokeMock.mockResolvedValue({ content: 'ok' });

      await service.executePrompt({
        providerName: 'groq',
        systemPrompt: 's',
        userPrompt: 'u',
      });

      expect(assertWithinLimitMock).not.toHaveBeenCalled();
    });
  });

  describe('logging y clasificación de causas', () => {
    it('audita el éxito con provider, duración y tokens', async () => {
      assertWithinLimitMock.mockResolvedValue(undefined);
      invokeMock.mockResolvedValue({
        content: 'plan',
        response_metadata: {
          model_name: 'llama-3.3-70b',
          tokenUsage: { totalTokens: 200 },
        },
      });

      await service.executePrompt({
        providerName: 'groq',
        systemPrompt: 's',
        userPrompt: 'u',
        userId: '507f1f77bcf86cd799439011',
      });

      expect(logAsyncMock).toHaveBeenCalledTimes(1);
      const entry = logAsyncMock.mock.calls[0][0];
      expect(entry.action).toBe('AI_PROMPT_EXECUTED');
      expect(entry.success).toBe(true);
      expect(entry.userId).toBe('507f1f77bcf86cd799439011');
      expect(entry.metadata.provider).toBe('groq');
      expect(entry.metadata.modelUsed).toBe('llama-3.3-70b');
      expect(entry.metadata.tokensUsed).toBe(200);
      expect(typeof entry.metadata.durationMs).toBe('number');
    });

    it('clasifica timeout como AI_PROVIDER_ERROR transitorio y re-lanza', async () => {
      invokeMock.mockRejectedValue(
        Object.assign(new Error('Request timed out'), { code: 'ETIMEDOUT' }),
      );

      await expect(
        service.executePrompt({
          providerName: 'groq',
          systemPrompt: 's',
          userPrompt: 'u',
        }),
      ).rejects.toThrow('Request timed out');

      const entry = logAsyncMock.mock.calls[0][0];
      expect(entry.success).toBe(false);
      expect(entry.metadata.cause).toBe(AI_CAUSE.PROVIDER);
      expect(entry.metadata.transient).toBe(true);
    });

    it('clasifica HTTP 429 del proveedor como RATE_LIMIT_EXCEEDED', async () => {
      invokeMock.mockRejectedValue(
        Object.assign(new Error('Too Many Requests'), {
          response: { status: 429 },
        }),
      );

      await expect(
        service.executePrompt({
          providerName: 'groq',
          systemPrompt: 's',
          userPrompt: 'u',
        }),
      ).rejects.toThrow();

      const entry = logAsyncMock.mock.calls[0][0];
      expect(entry.metadata.cause).toBe(AI_CAUSE.RATE_LIMIT);
      expect(entry.metadata.httpStatus).toBe(429);
      expect(entry.metadata.transient).toBe(true);
    });

    it('marca HTTP 503 como transitorio', async () => {
      invokeMock.mockRejectedValue(
        Object.assign(new Error('server error'), {
          response: { status: 503 },
        }),
      );

      await expect(
        service.executePrompt({
          providerName: 'groq',
          systemPrompt: 's',
          userPrompt: 'u',
        }),
      ).rejects.toThrow('server error');

      const entry = logAsyncMock.mock.calls[0][0];
      expect(entry.metadata.httpStatus).toBe(503);
      expect(entry.metadata.transient).toBe(true);
    });

    it('marca HTTP 400 como no transitorio', async () => {
      invokeMock.mockRejectedValue(
        Object.assign(new Error('bad request'), {
          response: { status: 400 },
        }),
      );

      await expect(
        service.executePrompt({
          providerName: 'groq',
          systemPrompt: 's',
          userPrompt: 'u',
        }),
      ).rejects.toThrow('bad request');

      const entry = logAsyncMock.mock.calls[0][0];
      expect(entry.metadata.httpStatus).toBe(400);
      expect(entry.metadata.transient).toBe(false);
    });

    it('clasifica error desconocido sin status ni código de red', async () => {
      invokeMock.mockRejectedValue(new Error('algo raro'));

      await expect(
        service.executePrompt({
          providerName: 'groq',
          systemPrompt: 's',
          userPrompt: 'u',
        }),
      ).rejects.toThrow('algo raro');

      const entry = logAsyncMock.mock.calls[0][0];
      expect(entry.metadata.cause).toBe(AI_CAUSE.PROVIDER);
      expect(entry.metadata.transient).toBe(false);
    });
  });

  describe('respuesta vacía', () => {
    it('reintenta ante respuesta vacía y tiene éxito en el 2do intento', async () => {
      invokeMock
        .mockResolvedValueOnce({
          content: '',
          response_metadata: { finish_reason: 'length' },
        })
        .mockResolvedValueOnce({ content: 'plan válido' });

      const result = await service.executePrompt({
        providerName: 'groq',
        systemPrompt: 's',
        userPrompt: 'u',
      });

      expect(result.rawContent).toBe('plan válido');
      expect(invokeMock).toHaveBeenCalledTimes(2);
      expect((service as any).sleep).toHaveBeenCalledWith(1000);
    });

    it('trata contenido whitespace-only como vacío', async () => {
      invokeMock.mockResolvedValue({ content: '   \n\t  ' });

      await expect(
        service.executePrompt({
          providerName: 'groq',
          systemPrompt: 's',
          userPrompt: 'u',
        }),
      ).rejects.toThrow('Respuesta vacía del proveedor de IA');

      expect(invokeMock).toHaveBeenCalledTimes(3);
    });

    it('audita causa AI_EMPTY_RESPONSE al agotar reintentos', async () => {
      invokeMock.mockResolvedValue({
        content: '',
        response_metadata: {
          finish_reason: 'length',
          tokenUsage: { completionTokens: 1234 },
        },
      });

      await expect(
        service.executePrompt({
          providerName: 'groq',
          systemPrompt: 's',
          userPrompt: 'u',
        }),
      ).rejects.toThrow('finishReason=length');

      const entry = logAsyncMock.mock.calls[0][0];
      expect(entry.success).toBe(false);
      expect(entry.metadata.cause).toBe(AI_CAUSE.EMPTY_RESPONSE);
      expect(entry.metadata.transient).toBe(true);
    });

    it('normaliza contenido en formato array de partes', async () => {
      invokeMock.mockResolvedValue({
        content: [{ text: 'hola ' }, { text: 'mundo' }],
      });

      const result = await service.executePrompt({
        providerName: 'groq',
        systemPrompt: 's',
        userPrompt: 'u',
      });

      expect(result.rawContent).toBe('hola mundo');
    });
  });

  describe('retry/backoff', () => {
    const httpError = (status: number, headers?: Record<string, string>) =>
      Object.assign(new Error(`http ${status}`), {
        response: { status, ...(headers && { headers }) },
      });

    it('reintenta ante error transitorio y tiene éxito en el 2do intento', async () => {
      invokeMock
        .mockRejectedValueOnce(httpError(503))
        .mockResolvedValueOnce({ content: 'ok' });

      const result = await service.executePrompt({
        providerName: 'groq',
        systemPrompt: 's',
        userPrompt: 'u',
      });

      expect(result.rawContent).toBe('ok');
      expect(invokeMock).toHaveBeenCalledTimes(2);
      expect((service as any).sleep).toHaveBeenCalledTimes(1);
      expect((service as any).sleep).toHaveBeenCalledWith(1000);

      // un único audit con el desenlace final (éxito)
      expect(logAsyncMock).toHaveBeenCalledTimes(1);
      expect(logAsyncMock.mock.calls[0][0].success).toBe(true);
    });

    it('agota los reintentos con backoff creciente y audit de fallo único', async () => {
      invokeMock.mockRejectedValue(httpError(503));

      await expect(
        service.executePrompt({
          providerName: 'groq',
          systemPrompt: 's',
          userPrompt: 'u',
        }),
      ).rejects.toThrow('http 503');

      expect(invokeMock).toHaveBeenCalledTimes(3); // default AI_MAX_ATTEMPTS=3
      const delays = (service as any).sleep.mock.calls.map((c) => c[0]);
      expect(delays).toEqual([1000, 2000]);

      expect(logAsyncMock).toHaveBeenCalledTimes(1);
      const entry = logAsyncMock.mock.calls[0][0];
      expect(entry.success).toBe(false);
      expect(entry.metadata.attempts).toBe(3);
      expect(entry.metadata.transient).toBe(true);
    });

    it('NO reintenta errores no transitorios (4xx)', async () => {
      invokeMock.mockRejectedValue(httpError(400));

      await expect(
        service.executePrompt({
          providerName: 'groq',
          systemPrompt: 's',
          userPrompt: 'u',
        }),
      ).rejects.toThrow('http 400');

      expect(invokeMock).toHaveBeenCalledTimes(1);
      expect((service as any).sleep).not.toHaveBeenCalled();
    });

    it('respeta Retry-After en un 429', async () => {
      invokeMock
        .mockRejectedValueOnce(
          httpError(429, { 'retry-after': '7' }),
        )
        .mockResolvedValueOnce({ content: 'ok' });

      await service.executePrompt({
        providerName: 'groq',
        systemPrompt: 's',
        userPrompt: 'u',
      });

      expect(invokeMock).toHaveBeenCalledTimes(2);
      expect((service as any).sleep).toHaveBeenCalledWith(7000);
    });

    it('abandona si el Retry-After excede el presupuesto restante', async () => {
      process.env.AI_TOTAL_BUDGET_MS = '500';
      invokeMock.mockRejectedValue(
        httpError(429, { 'retry-after': '120' }),
      );

      try {
        await expect(
          service.executePrompt({
            providerName: 'groq',
            systemPrompt: 's',
            userPrompt: 'u',
          }),
        ).rejects.toThrow('http 429');

        expect(invokeMock).toHaveBeenCalledTimes(1); // sin segundo intento
        expect((service as any).sleep).not.toHaveBeenCalled();
      } finally {
        delete process.env.AI_TOTAL_BUDGET_MS;
      }
    });

    it('corta por presupuesto total aunque queden reintentos', async () => {
      process.env.AI_MAX_ATTEMPTS = '6';
      process.env.AI_TOTAL_BUDGET_MS = '3500';
      invokeMock.mockRejectedValue(httpError(503));

      // sleep real (con fake timers) para que el reloj avance con los delays
      delete (service as any).sleep;
      const sleepSpy = jest.spyOn(service as any, 'sleep');

      jest.useFakeTimers();
      try {
        const pending = service
          .executePrompt({
            providerName: 'groq',
            systemPrompt: 's',
            userPrompt: 'u',
          })
          .catch((e) => e);

        await jest.advanceTimersByTimeAsync(10000);
        await pending;

        // intentó 3 veces (de 6 permitidas): el backoff del 4to ya no entra
        // en el presupuesto de 3.5s
        expect(invokeMock).toHaveBeenCalledTimes(3);
        expect(sleepSpy).toHaveBeenCalledTimes(2);
        expect(logAsyncMock).toHaveBeenCalledTimes(1);
        expect(logAsyncMock.mock.calls[0][0].metadata.attempts).toBe(3);
      } finally {
        jest.useRealTimers();
        delete process.env.AI_MAX_ATTEMPTS;
        delete process.env.AI_TOTAL_BUDGET_MS;
      }
    });
  });
});
