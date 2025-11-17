import { Test, TestingModule } from '@nestjs/testing';
import { GoogleResolver } from './google.resolver';
import { GoogleService } from './google.service';

describe('GoogleResolver', () => {
  let resolver: GoogleResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GoogleResolver, GoogleService],
    }).compile();

    resolver = module.get<GoogleResolver>(GoogleResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
