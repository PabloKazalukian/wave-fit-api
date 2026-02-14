import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateWorkoutSessionInput } from './dto/create-workout-session.input';
import { UpdateWorkoutSessionInput } from './dto/update-workout-session.input';
import { WorkoutSession } from './schema/workout-session.schema';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { ExercisePerformance } from './schema/exercise-performance.schema';
import { WeekLog } from '../week-log/schema/week-log.schema';
import { WeekLogService } from '../week-log/week-log.service';

@Injectable()
export class WorkoutSessionService {
  constructor(
    @InjectModel(WorkoutSession.name)
    private sessionModel: Model<WorkoutSession>,
    private weekLogService: WeekLogService,
  ) {}

  async create(
    createWorkoutSessionInput: CreateWorkoutSessionInput,
    userId: string,
  ): Promise<WorkoutSession> {
    // 1. Validar que el WeekLog existe y pertenece al usuario
    const weekLog = await this.weekLogService.findOne(
      createWorkoutSessionInput.weekLogId,
      userId,
    );

    if (!weekLog) {
      throw new NotFoundException(
        `WeekLog with ID ${createWorkoutSessionInput.weekLogId}${weekLog} not found`,
      );
    }

    if (weekLog.userId.toString() !== userId) {
      throw new ForbiddenException(
        'You do not have permission to add sessions to this WeekLog',
      );
    }

    // 2. Validar que la fecha está dentro del rango del WeekLog
    const sessionDate = new Date(createWorkoutSessionInput.date);
    if (sessionDate < weekLog.startDate || sessionDate > weekLog.endDate) {
      throw new BadRequestException(
        'Session date must be within the WeekLog date range',
      );
    }

    // 3. Verificar si ya existe una sesión para esta fecha (opcional, depende de tu lógica)
    const existingSession = await this.sessionModel.findOne({
      userId: new Types.ObjectId(userId),
      weekLogId: new Types.ObjectId(createWorkoutSessionInput.weekLogId),
      date: sessionDate,
    });

    if (existingSession) {
      throw new BadRequestException(
        'A workout session already exists for this date',
      );
    }

    // 4. Validar que series coincide con la cantidad de sets
    for (const exercise of createWorkoutSessionInput.exercises) {
      if (exercise.series !== exercise.sets.length) {
        throw new BadRequestException(
          `Exercise ${exercise.exerciseId}: series (${exercise.series}) must match sets length (${exercise.sets.length})`,
        );
      }
    }

    // 5. Crear la sesión
    const newSession = new this.sessionModel({
      userId: new Types.ObjectId(userId),
      weekLogId: new Types.ObjectId(createWorkoutSessionInput.weekLogId),
      date: sessionDate,
      routineDayId: createWorkoutSessionInput.routineDayId
        ? new Types.ObjectId(createWorkoutSessionInput.routineDayId)
        : null,
      exercises: createWorkoutSessionInput.exercises,
      status: createWorkoutSessionInput.status,
      notes: createWorkoutSessionInput.notes || '',
    });

    const savedSession = await newSession.save();

    // 6. Agregar el ID de la sesión al WeekLog
    await this.weekLogService.findByIdAndUpdate(
      createWorkoutSessionInput.weekLogId,
      createWorkoutSessionInput,
    );

    return savedSession;
  }

  findAllByUser(userId: string): Promise<WorkoutSession[]> {
    return this.sessionModel.find({ userId }).populate('exercises').exec();
  }

  findOne(id: string, userId: string) {
    return this.sessionModel
      .findOne({ _id: id, userId })
      .populate('exercises')
      .exec();
  }

  update(id: string, updateWorkoutSessionInput: UpdateWorkoutSessionInput) {
    return `This action updates a #${id} workoutSession`;
  }

  remove(id: string) {
    return `This action removes a #${id} workoutSession`;
  }
}
