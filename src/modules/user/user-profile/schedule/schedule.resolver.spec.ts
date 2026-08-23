import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ScheduleResolver } from './schedule.resolver';
import { ScheduleService } from './schedule.service';
import { UserSchedule } from '../schema/schedule.schema';

describe('ScheduleResolver', () => {
  let resolver: ScheduleResolver;

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
        ScheduleResolver,
        ScheduleService,
        {
          provide: getModelToken(UserSchedule.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    resolver = module.get<ScheduleResolver>(ScheduleResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
