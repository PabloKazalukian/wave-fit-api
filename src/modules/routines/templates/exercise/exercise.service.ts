import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateExerciseInput } from './dto/create-exercise.input';
import { UpdateExerciseInput } from './dto/update-exercise.input';
import { Exercise as ExerciseSchema } from './schema/exercise.schema';
import { Exercise } from './entities/exercise.entity';
import {
  UserTrainingPreference,
} from 'src/modules/user/user-profile/schema/training-preference.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  serializeMongo,
  serializeMongoArray,
} from 'src/common/utils/mongo.utils';
import { markItemsAsFavorites } from 'src/common/utils/favorites.utils';
import { normalizeString, isSimilar } from 'src/common/utils/string.utils';

@Injectable()
export class ExerciseService {
  constructor(
    @InjectModel(ExerciseSchema.name)
    private ExerciseModel: Model<ExerciseSchema>,
    @InjectModel(UserTrainingPreference.name)
    private readonly trainingPreferenceModel: Model<UserTrainingPreference>,
  ) {}
  async create(createExerciseInput: CreateExerciseInput): Promise<Exercise> {
    const { name } = createExerciseInput;

    // 1. Normalización
    const normalizedName = normalizeString(name);

    // 2. Búsqueda de duplicados exactos (por nombre normalizado)
    const existingExact = await this.ExerciseModel.findOne({
      normalizedName,
    })
      .lean()
      .exec();

    if (existingExact) {
      throw new BadRequestException({
        message: `Ya existe un ejercicio con el nombre o similar a "${name}"`,
        code: 'DUPLICATE_NAME',
      });
    }

    // 3. Verificación de similitud con otros ejercicios
    // Traemos todos para comparar (o podríamos filtrar por categoría si quisiéramos ser más específicos)
    const allExercises = await this.ExerciseModel.find().lean().exec();

    for (const exercise of allExercises) {
      if (isSimilar(normalizedName, exercise.normalizedName, 2)) {
        throw new BadRequestException({
          message: `El ejercicio "${name}" es muy similar a uno existente: "${exercise.name}"`,
          code: 'SIMILAR_NAME',
          similarTo: exercise.name,
        });
      }
    }

    // 4. Creación
    const { id, ...restInput } = createExerciseInput;
    const createData: any = {
      ...restInput,
      normalizedName,
    };
    if (id) {
      createData._id = id;
    }

    const createdExercise = await this.ExerciseModel.create(createData);

    return serializeMongo<Exercise>(createdExercise);
  }

  async findAll(): Promise<Exercise[]> {
    const exercises = await this.ExerciseModel.find().lean().exec();
    return serializeMongoArray<Exercise>(exercises);
  }

  async findOne(id: string): Promise<Exercise | null> {
    const exercise = await this.ExerciseModel.findById(id).lean().exec();
    return exercise ? serializeMongo<Exercise>(exercise) : null;
  }

  async findByIds(ids: string[]): Promise<Exercise[]> {
    const exercises = await this.ExerciseModel.find({ _id: { $in: ids } })
      .lean()
      .exec();
    return serializeMongoArray<Exercise>(exercises);
  }

  async update(
    id: string,
    updateExerciseInput: UpdateExerciseInput,
  ): Promise<Exercise> {
    const updateData: any = { ...updateExerciseInput };

    if (updateData.name) {
      updateData.normalizedName = normalizeString(updateData.name);

      // Opcional: Verificar similitud también en el update si cambia el nombre
      const allExercises = await this.ExerciseModel.find({
        _id: { $ne: id },
      })
        .lean()
        .exec();

      for (const exercise of allExercises) {
        if (isSimilar(updateData.normalizedName, exercise.normalizedName, 2)) {
          throw new BadRequestException({
            message: `El nuevo nombre "${updateData.name}" es muy similar a uno existente: "${exercise.name}"`,
            code: 'SIMILAR_NAME',
            similarTo: exercise.name,
          });
        }
      }
    }

    const updated = await this.ExerciseModel.findByIdAndUpdate(id, updateData, {
      new: true,
    })
      .lean()
      .exec();

    if (!updated) {
      throw new BadRequestException(`Exercise with id ${id} not found`);
    }

    return serializeMongo<Exercise>(updated);
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.ExerciseModel.findByIdAndDelete(id).exec();
    return !!result;
  }

  async getFavoriteExerciseIds(userId: string): Promise<Set<string>> {
    const preference = await this.trainingPreferenceModel
      .findOne({ userId: new Types.ObjectId(userId) }, { favoriteExercises: 1 })
      .lean()
      .exec();
    return new Set(
      (preference?.favoriteExercises ?? []).map((id) => String(id)),
    );
  }

  markFavorites<T extends { id: string }>(
    exercises: T[],
    favoriteIds: Set<string>,
  ): T[] {
    return markItemsAsFavorites(exercises, favoriteIds);
  }
}
