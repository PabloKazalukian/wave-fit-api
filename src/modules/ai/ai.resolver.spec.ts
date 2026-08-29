import { Test, TestingModule } from '@nestjs/testing';
import { AiResolver } from './ai.resolver';
import { AiRateLimitService } from './ai-rate-limit.service';

describe('AiResolver', () => {
  let resolver: AiResolver;

  const rateLimitServiceMock = {
    getUsage: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiResolver,
        {
          provide: AiRateLimitService,
          useValue: rateLimitServiceMock,
        },
      ],
    }).compile();

    resolver = module.get<AiResolver>(AiResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
