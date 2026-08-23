import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { HealthConstraintsResolver } from './health-constraints.resolver';
import { HealthConstraintsService } from './health-constraints.service';
import { UserHealthConstraint } from '../schema/health-constraints.schema';

describe('HealthConstraintsResolver', () => {
  let resolver: HealthConstraintsResolver;

  const mockModel = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    exists: jest.fn(),
    exec: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthConstraintsResolver,
        HealthConstraintsService,
        {
          provide: getModelToken(UserHealthConstraint.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    resolver = module.get<HealthConstraintsResolver>(HealthConstraintsResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
