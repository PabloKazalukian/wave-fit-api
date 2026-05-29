import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { CreateWorkoutSessionInput } from './dto/create-workout-session.input';
import { UpdateWorkoutSessionInput } from './dto/update-workout-session.input';
import {
  WorkoutSession,
  WorkoutSessionDocument,
} from './schema/workout-session.schema';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { WeekLogService } from '../week-log/week-log.service';
import { WorkoutSessionValidator } from './workout-session.validator';
import {
  WorkoutSessionCreationData,
  WeekLogDomain,
} from '../week-log/domain/entities/week-log.domain';
import {
  localDateToUtc,
  isValidLocalDate,
  nowUtc,
} from 'src/common/utils/date.utils';

const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

@Injectable()
export class WorkoutSessionService {
  constructor(
    @InjectModel(WorkoutSession.name)
    private sessionModel: Model<WorkoutSession>,
    @Inject(forwardRef(() => WeekLogService))
    private weekLogService: WeekLogService,
    private readonly validator: WorkoutSessionValidator,
  ) {}

  async create(
    input: (Omit<CreateWorkoutSessionInput, 'date'> & {
      date: string | Date;
    }) & {
      timezone?: string;
    },
    userId: string,
  ): Promise<WorkoutSessionDocument> {
    const timezone = (input as any).timezone ?? DEFAULT_TIMEZONE;

    let weekLog: WeekLogDomain | null = null;
    if (input.weekLogId) {
      weekLog = await this.weekLogService.findOne(input.weekLogId, userId);
      if (!weekLog) {
        throw new NotFoundException(
          // `Week log con ID "${input.weekLogId}" no encontrado`,
          'not found',
        );
      }
    }

    // ✅ Normalizar date a UTC Date ANTES de la validación
    const dateUtc =
      typeof input.date === 'string'
        ? localDateToUtc(input.date, timezone)
        : input.date;

    await this.validator.validateCreation(
      { ...input, date: dateUtc } as any,
      userId,
      weekLog,
    );

    if (typeof input.date === 'string' && !isValidLocalDate(input.date)) {
      throw new BadRequestException(
        `date "${input.date}" must be in yyyy-MM-dd format`,
      );
    }

    const session = await this.sessionModel.create({
      userId: new Types.ObjectId(userId),
      weekLogId: input.weekLogId ? new Types.ObjectId(input.weekLogId) : null,
      date: dateUtc, // ✅ Date UTC normalizada
      routineDayId: input.routineDayId
        ? new Types.ObjectId(input.routineDayId)
        : null,
      exercises: input.exercises,
      status: input.status,
      notes: input.notes || '',
    });

    return session;
  }

  findAllByUser(userId: string): Promise<WorkoutSession[]> {
    return this.sessionModel
      .find({ userId, deleted: { $ne: true } })
      .populate('exercises')
      .exec();
  }

  findOne(id: string, userId: string) {
    return this.sessionModel
      .findOne({ _id: id, userId, deleted: { $ne: true } })
      .populate('exercises')
      .exec();
  }

  async insertMany(sessions: WorkoutSessionCreationData[]) {
    return this.sessionModel.insertMany(sessions);
  }

  /**
   * Busca un WorkoutSession por LocalDate "yyyy-MM-dd" + timezone.
   * Convierte el LocalDate a rango UTC para la query de Mongo.
   */
  async findByDate(
    date: string,
    userId: string,
    timezone: string = DEFAULT_TIMEZONE,
  ) {
    if (!isValidLocalDate(date)) {
      throw new BadRequestException(
        `date "${date}" must be in yyyy-MM-dd format`,
      );
    }

    // Rango UTC para el día completo en la timezone del usuario
    const startUtc = localDateToUtc(date, timezone);
    const endUtc = localDateToUtc(
      // Next day at 00:00 in same timezone = end of range
      new Date(startUtc.getTime() + 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      timezone,
    );

    return this.sessionModel
      .findOne({
        userId,
        deleted: { $ne: true },
        date: {
          $gte: startUtc,
          $lt: endUtc,
        },
      })
      .populate('exercises')
      .exec();
  }

  async update(
    id: string,
    updateWorkoutSessionInput: UpdateWorkoutSessionInput,
    userId: string,
  ): Promise<WorkoutSessionDocument> {
    const existing = await this.sessionModel.findOne({
      _id: id,
      userId,
      deleted: { $ne: true },
    });
    if (!existing) {
      throw new NotFoundException(`Workout Session with ID "${id}" not found`);
    }

    if (updateWorkoutSessionInput.exercises) {
      updateWorkoutSessionInput.exercises =
        updateWorkoutSessionInput.exercises.map((ex) => ({
          ...ex,
          series: ex.sets?.length ?? ex.series,
        }));
    }

    await this.validator.validateUpdateWorkoutSession(
      updateWorkoutSessionInput,
      userId,
      existing,
    );

    const { id: _, ...updateData } = updateWorkoutSessionInput;

    const updated = await this.sessionModel
      .findByIdAndUpdate(id, { ...updateData, edited: true }, { new: true })
      .populate('exercises')
      .exec();

    if (!updated) {
      throw new NotFoundException(`Workout Session with ID "${id}" no existe`);
    }

    return updated;
  }

  async remove(id: string, userId: string) {
    const existing = await this.sessionModel.findOne({
      _id: id,
      userId,
      deleted: { $ne: true },
    });
    if (!existing) {
      throw new NotFoundException(`Workout Session with ID "${id}" not found`);
    }

    const updated = await this.sessionModel
      .findByIdAndUpdate(
        id,
        {
          deleted: true,
          deletedAt: nowUtc(), // ✅ timestamp UTC puro
        },
        { new: true },
      )
      .populate('exercises')
      .exec();

    return updated;
  }
}
