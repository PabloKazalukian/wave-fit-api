import { Test, TestingModule } from '@nestjs/testing';
import { ExtraSessionService } from './extra-session.service';

describe('ExtraSessionService', () => {
  let service: ExtraSessionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExtraSessionService],
    }).compile();

    service = module.get<ExtraSessionService>(ExtraSessionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
