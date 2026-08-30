import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { UserProfileService } from './user-profile.service';
import { UserProfile } from './schema/user-profile.schema';
import { UserGoal } from './schema/goals.schema';
import { UserTrainingPreference } from './schema/training-preference.schema';
import { UserWeightLog } from './schema/weight.schema';
import { UserHealthConstraint } from './schema/health-constraints.schema';
import { UserSchedule } from './schema/schedule.schema';
import { UserResource } from './schema/resourse.schema';
import { UserStrengthMetric } from './schema/strength-metrics.schema';
import { GoalsService } from './goals/goals.service';
import { TrainingPreferenceService } from './training-preference/training-preference.service';
import { ExerciseService } from 'src/modules/routines/templates/exercise/exercise.service';
import { RoutinePlanService } from 'src/modules/routines/templates/routine-plan/routine-plan.service';
import { RoutineDayService } from 'src/modules/routines/templates/routine-day/routine-day.service';
import { WeightService } from './weight/weight.service';
import { HealthConstraintsService } from './health-constraints/health-constraints.service';
import { ScheduleService } from './schedule/schedule.service';
import { ResourceService } from './resource/resource.service';
import { StrengthMetricsService } from './strength-metrics/strength-metrics.service';

const createMockModel = () => ({
  create: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findOneAndDelete: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
  updateOne: jest.fn(),
  deleteMany: jest.fn().mockReturnThis(),
  exists: jest.fn(),
  exec: jest.fn().mockResolvedValue({ deletedCount: 0 }),
});

describe('UserProfileService', () => {
  let service: UserProfileService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserProfileService,
        GoalsService,
        TrainingPreferenceService,
        WeightService,
        HealthConstraintsService,
        ScheduleService,
        ResourceService,
        StrengthMetricsService,
        ...[
          UserProfile,
          UserHealthConstraint,
          UserResource,
          UserSchedule,
          UserStrengthMetric,
          UserGoal,
          UserTrainingPreference,
          UserWeightLog,
        ].map((model) => ({
          provide: getModelToken(model.name),
          useValue: createMockModel(),
        })),
        {
          provide: ExerciseService,
          useValue: { findOne: jest.fn(), findByIds: jest.fn() },
        },
        {
          provide: RoutinePlanService,
          useValue: { findOne: jest.fn(), findByIds: jest.fn() },
        },
        {
          provide: RoutineDayService,
          useValue: { findOne: jest.fn(), findByIds: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<UserProfileService>(UserProfileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('removeAllProfileData', () => {
    it('borra los datos de todos los dominios del perfil y el perfil base', async () => {
      const goals = jest.spyOn(
        (service as any).goalsService,
        'removeGoal',
      );
      const preferences = jest.spyOn(
        (service as any).trainingPreferenceService,
        'removeTrainingPreference',
      );
      const weights = jest.spyOn(
        (service as any).weightService,
        'removeWeightLogs',
      );
      const health = jest.spyOn(
        (service as any).healthConstraintsService,
        'removeHealthConstraints',
      );
      const schedule = jest.spyOn(
        (service as any).scheduleService,
        'removeSchedule',
      );
      const resources = jest.spyOn(
        (service as any).resourceService,
        'removeResource',
      );
      const metrics = jest.spyOn(
        (service as any).strengthMetricsService,
        'removeStrengthMetrics',
      );

      await expect(service.removeAllProfileData('507f1f77bcf86cd799439011')).resolves.toBe(true);

      expect(goals).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(preferences).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(weights).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(health).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(schedule).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(resources).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(metrics).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });

    it('es idempotente: devuelve true aunque no hubiera datos que borrar', async () => {
      // mocks por defecto: deleteMany → deletedCount 0 → remove* devuelven false
      await expect(service.removeAllProfileData('507f1f77bcf86cd799439011')).resolves.toBe(true);
    });
  });

  describe('create', () => {
    const mockFindOneNull = () => ({
      exec: jest.fn().mockResolvedValue(null),
    });

    it('persiste distributionDays con valor por defecto week_log si no se pasa', async () => {
      const profileModel = (
        service as any
      ).profileModel;
      profileModel.findOne.mockReturnValue(mockFindOneNull());
      profileModel.create.mockImplementation((data) => Promise.resolve(data));

      const result = await service.create(
        { gender: 'M', birthDate: '1990-01-01' } as any,
        '507f1f77bcf86cd799439011',
      );

      expect(profileModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ distributionDays: 'week_log' }),
      );
      expect(result.distributionDays).toBe('week_log');
    });

    it('persiste distributionDays con el valor pasado por el input', async () => {
      const profileModel = (
        service as any
      ).profileModel;
      profileModel.findOne.mockReturnValue(mockFindOneNull());
      profileModel.create.mockImplementation((data) => Promise.resolve(data));

      const result = await service.create(
        { gender: 'M', birthDate: '1990-01-01', distributionDays: 'day_log' } as any,
        '507f1f77bcf86cd799439011',
      );

      expect(profileModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ distributionDays: 'day_log' }),
      );
      expect(result.distributionDays).toBe('day_log');
    });
  });

  describe('update', () => {
    it('actualiza distributionDays si viene en el input', async () => {
      const profileModel = (
        service as any
      ).profileModel;
      profileModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439011' }),
      });
      profileModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ distributionDays: 'day_log' }),
      });

      const result = await service.update(
        '507f1f77bcf86cd799439011',
        { distributionDays: 'day_log' } as any,
        '507f1f77bcf86cd799439011',
      );

      expect(profileModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        { $set: expect.objectContaining({ distributionDays: 'day_log' }) },
        { new: true },
      );
      expect(result).toBeTruthy();
    });
  });

  describe('onApplicationBootstrap (backfill distributionDays)', () => {
    const mockFindChain = (results: unknown[]) => ({
      exec: jest.fn().mockResolvedValue(results),
    });

    it('normaliza valores legacy a los nuevos y no toca los ya normalizados', async () => {
      const legacy = { _id: 'legacy1', distributionDays: 'Week-log' };
      const legacyDay = { _id: 'legacy2', distributionDays: 'Day-log' };
      const alreadyOk = { _id: 'ok1', distributionDays: 'week_log' };

      const profileModel = (
        service as any
      ).profileModel;
      profileModel.find.mockReturnValue(mockFindChain([legacy, legacyDay, alreadyOk]));
      profileModel.updateOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      await service.onApplicationBootstrap();

      expect(profileModel.updateOne).toHaveBeenCalledWith(
        { _id: 'legacy1' },
        { $set: { distributionDays: 'week_log' } },
      );
      expect(profileModel.updateOne).toHaveBeenCalledWith(
        { _id: 'legacy2' },
        { $set: { distributionDays: 'day_log' } },
      );
      expect(profileModel.updateOne).not.toHaveBeenCalledWith(
        { _id: 'ok1' },
        { $set: { distributionDays: 'week_log' } },
      );
    });

    it('no hace nada si no hay profiles que normalizar', async () => {
      const profileModel = (
        service as any
      ).profileModel;
      profileModel.find.mockReturnValue(mockFindChain([]));

      await service.onApplicationBootstrap();

      expect(profileModel.updateOne).not.toHaveBeenCalled();
    });
  });
});
