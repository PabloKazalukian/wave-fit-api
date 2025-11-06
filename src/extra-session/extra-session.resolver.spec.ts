import { Test, TestingModule } from '@nestjs/testing';
import { ExtraSessionResolver } from './extra-session.resolver';
import { ExtraSessionService } from './extra-session.service';

describe('ExtraSessionResolver', () => {
  let resolver: ExtraSessionResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExtraSessionResolver, ExtraSessionService],
    }).compile();

    resolver = module.get<ExtraSessionResolver>(ExtraSessionResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
