import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateDayLogInput } from './presentation/dto/create-day-log.input';
import { UpdateDayLogInput } from './presentation/dto/update-day-log.input';
import { DayLogDomain } from './domain/entities/day-log.domain';
import {
  AssignRoutineDayUseCase,
  CreateDayLogUseCase,
  FindActiveDayLogUseCase,
  FindAllDayLogsUseCase,
  FindOneDayLogUseCase,
  RemoveDayLogUseCase,
  RemoveExtraSessionUseCase,
  RemoveWorkoutSessionUseCase,
  UpdateDayLogUseCase,
  UpdateDayStatusUseCase,
} from './application/use-cases';

export const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

@Injectable()
export class DayLogService {
  constructor(
    private readonly createDayLogUseCase: CreateDayLogUseCase,
    private readonly findAllDayLogsUseCase: FindAllDayLogsUseCase,
    private readonly findOneDayLogUseCase: FindOneDayLogUseCase,
    private readonly findActiveDayLogUseCase: FindActiveDayLogUseCase,
    private readonly updateDayLogUseCase: UpdateDayLogUseCase,
    private readonly updateDayStatusUseCase: UpdateDayStatusUseCase,
    private readonly removeDayLogUseCase: RemoveDayLogUseCase,
    private readonly removeWorkoutSessionUseCase: RemoveWorkoutSessionUseCase,
    private readonly removeExtraSessionUseCase: RemoveExtraSessionUseCase,
    private readonly assignRoutineDayUseCase: AssignRoutineDayUseCase,
  ) {}

  async create(
    input: CreateDayLogInput,
    userId: string,
  ): Promise<DayLogDomain | null> {
    return this.createDayLogUseCase.execute(input, userId);
  }

  async findAllByUser(
    userId: string,
    limit: number = 5,
    offset: number = 0,
  ): Promise<DayLogDomain[]> {
    return this.findAllDayLogsUseCase.execute(userId, limit, offset);
  }

  async findOne(id: string, userId: string): Promise<DayLogDomain | null> {
    const dayLog = await this.findOneDayLogUseCase.execute(id, userId);
    if (!dayLog) {
      throw new NotFoundException('not found');
    }
    return dayLog;
  }

  async findActiveDayLog(userId: string): Promise<DayLogDomain | null> {
    return this.findActiveDayLogUseCase.execute(userId);
  }

  async update(
    input: UpdateDayLogInput,
    userId: string,
  ): Promise<DayLogDomain | null> {
    return this.updateDayLogUseCase.execute(input, userId);
  }

  async updateDayStatus(
    date: string,
    isRest: boolean,
    userId: string,
  ): Promise<DayLogDomain | null> {
    return this.updateDayStatusUseCase.execute(date, isRest, userId);
  }

  async remove(id: string, userId: string): Promise<DayLogDomain | null> {
    return this.removeDayLogUseCase.execute(id, userId);
  }

  async removeWorkoutSessionFromDay(
    workoutSessionId: string,
    userId: string,
  ): Promise<DayLogDomain | null> {
    return this.removeWorkoutSessionUseCase.execute(workoutSessionId, userId);
  }

  async removeExtraSessionFromDay(
    extraSessionId: string,
    userId: string,
  ): Promise<DayLogDomain | null> {
    return this.removeExtraSessionUseCase.execute(extraSessionId, userId);
  }

  async assignRoutineToDay(
    routineDayId: string,
    date: string,
    userId: string,
  ): Promise<DayLogDomain | null> {
    return this.assignRoutineDayUseCase.execute(routineDayId, date, userId);
  }
}
