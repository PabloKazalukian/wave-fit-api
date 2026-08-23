import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { AiService } from './ai.service';

describe('AiService', () => {
  let service: AiService;

  const invokeMock = jest.fn();

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
      providers: [AiService, { provide: 'AI_PROVIDERS', useValue: providers }],
    }).compile();

    service = module.get<AiService>(AiService);
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
});
