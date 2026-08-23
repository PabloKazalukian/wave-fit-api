import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { HealthConstraintsService } from './health-constraints.service';
import { UserHealthConstraint } from '../schema/health-constraints.schema';

describe('HealthConstraintsService', () => {
  let service: HealthConstraintsService;

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
        HealthConstraintsService,
        {
          provide: getModelToken(UserHealthConstraint.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<HealthConstraintsService>(HealthConstraintsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
