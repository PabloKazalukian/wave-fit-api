import { Test, TestingModule } from '@nestjs/testing';
import { AiResolver } from './ai.resolver';
import { AiService } from './ai.service';

describe('AiResolver', () => {
  let resolver: AiResolver;

  const aiServiceMock = {
    getAvailableProviders: jest.fn(),
    generatePlan: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiResolver,
        {
          provide: AiService,
          useValue: aiServiceMock,
        },
      ],
    }).compile();

    resolver = module.get<AiResolver>(AiResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
