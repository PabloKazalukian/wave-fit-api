import { Test, TestingModule } from '@nestjs/testing';
import { RoutinePlanService } from './routine-plan.service';
import { getModelToken } from '@nestjs/mongoose';
import { RoutinePlan } from './schema/routine-plan.schema';

describe('RoutinePlanService', () => {
  let service: RoutinePlanService;

  const routinePlanModelMock = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    deleteOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutinePlanService,
        {
          provide: getModelToken(RoutinePlan.name),
          useValue: routinePlanModelMock,
        },
      ],
    }).compile();

    service = module.get<RoutinePlanService>(RoutinePlanService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
