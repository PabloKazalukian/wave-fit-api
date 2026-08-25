import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserTrainingPreference } from '../schema/training-preference.schema';
import { UpdateTrainingPreferenceInput } from './dto/update-training-preference.input';
import { ExerciseService } from 'src/modules/routines/templates/exercise/exercise.service';
import { RoutinePlanService } from 'src/modules/routines/templates/routine-plan/routine-plan.service';
import { RoutineDayService } from 'src/modules/routines/templates/routine-day/routine-day.service';

type FavoriteField =
  | 'favoriteExercises'
  | 'favoriteRoutines'
  | 'favoriteRoutineDays';

@Injectable()
export class TrainingPreferenceService {
  constructor(
    @InjectModel(UserTrainingPreference.name)
    private readonly trainingPreferenceModel: Model<UserTrainingPreference>,
    private readonly exerciseService: ExerciseService,
    private readonly routinePlanService: RoutinePlanService,
    private readonly routineDayService: RoutineDayService,
  ) {}

  async findTrainingPreference(
    userId: string,
  ): Promise<UserTrainingPreference | null> {
    return this.trainingPreferenceModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
  }

  async updateTrainingPreference(
    userId: string,
    input: UpdateTrainingPreferenceInput,
  ): Promise<UserTrainingPreference> {
    const objectId = new Types.ObjectId(userId);
    const favoriteObjectIds = await this.validateFavoriteExercises(
      input.favoriteExercises,
    );
    const favoriteRoutineObjectIds = await this.validateFavoriteRoutines(
      input.favoriteRoutines,
    );
    const favoriteRoutineDayObjectIds = await this.validateFavoriteRoutineDays(
      input.favoriteRoutineDays,
    );

    const exists = await this.trainingPreferenceModel
      .exists({ userId: objectId })
      .exec();
    if (!exists) {
      await this.trainingPreferenceModel.create({ userId: objectId, ...input });
    }

    const setData: Record<string, unknown> = { ...input, userId: objectId };
    if (input.favoriteExercises) {
      setData.favoriteExercises = favoriteObjectIds;
    }
    if (input.favoriteRoutines) {
      setData.favoriteRoutines = favoriteRoutineObjectIds;
    }
    if (input.favoriteRoutineDays) {
      setData.favoriteRoutineDays = favoriteRoutineDayObjectIds;
    }

    return this.trainingPreferenceModel
      .findOneAndUpdate({ userId: objectId }, { $set: setData }, { new: true })
      .orFail()
      .exec();
  }

  async removeTrainingPreference(userId: string): Promise<boolean> {
    const result = await this.trainingPreferenceModel
      .deleteMany({ userId: new Types.ObjectId(userId) })
      .exec();
    return result.deletedCount > 0;
  }

  async toggleFavoriteExercise(
    userId: string,
    exerciseId: string,
  ): Promise<UserTrainingPreference> {
    return this.toggleInFavorites(userId, exerciseId, 'favoriteExercises', async () => {
      const exercise = await this.exerciseService.findOne(exerciseId);
      if (!exercise) {
        throw new NotFoundException(`Exercise with id ${exerciseId} not found`);
      }
    });
  }

  async toggleFavoriteRoutine(
    userId: string,
    routineId: string,
  ): Promise<UserTrainingPreference> {
    return this.toggleInFavorites(userId, routineId, 'favoriteRoutines', async () => {
      await this.routinePlanService.findOne(routineId);
    });
  }

  async toggleFavoriteRoutineDay(
    userId: string,
    routineDayId: string,
  ): Promise<UserTrainingPreference> {
    return this.toggleInFavorites(userId, routineDayId, 'favoriteRoutineDays', async () => {
      const day = await this.routineDayService.findOne(routineDayId);
      if (!day) {
        throw new NotFoundException(
          `RoutineDay with id ${routineDayId} not found`,
        );
      }
    });
  }

  private async toggleInFavorites(
    userId: string,
    itemId: string,
    field: FavoriteField,
    assertExists: () => Promise<void>,
  ): Promise<UserTrainingPreference> {
    if (!Types.ObjectId.isValid(itemId)) {
      throw new BadRequestException(`Invalid id: ${itemId}`);
    }
    await assertExists();

    const objectId = new Types.ObjectId(userId);
    const current = await this.trainingPreferenceModel
      .findOne({ userId: objectId }, { [field]: 1 })
      .exec();

    const isFavorite =
      current?.[field]?.some((id) => String(id) === String(itemId)) ?? false;

    const update = isFavorite
      ? { $pull: { [field]: new Types.ObjectId(itemId) } }
      : { $addToSet: { [field]: new Types.ObjectId(itemId) } };

    return this.trainingPreferenceModel
      .findOneAndUpdate({ userId: objectId }, update, {
        new: true,
        upsert: true,
      })
      .exec();
  }

  private async validateFavoriteExercises(
    ids?: string[],
  ): Promise<Types.ObjectId[]> {
    return this.validateFavorites(
      ids,
      'ejercicios',
      'EXERCISE',
      (validated) => this.exerciseService.findByIds(validated),
    );
  }

  private async validateFavoriteRoutines(
    ids?: string[],
  ): Promise<Types.ObjectId[]> {
    return this.validateFavorites(
      ids,
      'rutinas',
      'ROUTINE',
      (validated) => this.routinePlanService.findByIds(validated),
    );
  }

  private async validateFavoriteRoutineDays(
    ids?: string[],
  ): Promise<Types.ObjectId[]> {
    return this.validateFavorites(
      ids,
      'días de rutina',
      'ROUTINE_DAY',
      (validated) => this.routineDayService.findByIds(validated),
    );
  }

  private async validateFavorites(
    ids: string[] | undefined,
    label: string,
    code: string,
    findByIds: (ids: string[]) => Promise<Array<{ id: string }>>,
  ): Promise<Types.ObjectId[]> {
    if (!ids || ids.length === 0) {
      return [];
    }

    const invalidFormat = ids.filter((id) => !Types.ObjectId.isValid(id));
    if (invalidFormat.length > 0) {
      throw new BadRequestException({
        message: `IDs de ${label} inválidos`,
        code: `INVALID_${code}_ID`,
        invalidIds: invalidFormat,
      });
    }

    const found = await findByIds(ids);
    const foundIds = new Set(found.map((doc) => String(doc.id)));
    const notFound = ids.filter((id) => !foundIds.has(id));
    if (notFound.length > 0) {
      throw new BadRequestException({
        message: `Algunas ${label} no existen`,
        code: `${code}_NOT_FOUND`,
        notFoundIds: notFound,
      });
    }

    return ids.map((id) => new Types.ObjectId(id));
  }
}
