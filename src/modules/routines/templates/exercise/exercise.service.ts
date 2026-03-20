import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateExerciseInput } from './dto/create-exercise.input';
import { UpdateExerciseInput } from './dto/update-exercise.input';
import { Exercise as ExerciseSchema } from './schema/exercise.schema';
import { Exercise } from './entities/exercise.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  serializeMongo,
  serializeMongoArray,
} from 'src/common/utils/mongo.utils';

@Injectable()
export class ExerciseService {
  constructor(
    @InjectModel(ExerciseSchema.name)
    private ExerciseModel: Model<ExerciseSchema>,
  ) {}
  async create(createExerciseInput: CreateExerciseInput): Promise<Exercise> {
    const { name } = createExerciseInput;
    const existing = await this.ExerciseModel.findOne({ name }).lean().exec();
    if (existing) {
      throw new BadRequestException({
        message: `Ya existe un ejercicio con el nombre "${name}"`,
        code: 'DUPLICATE_NAME',
      });
    }
    const createdExercise =
      await this.ExerciseModel.create(createExerciseInput);
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
    const updated = await this.ExerciseModel.findByIdAndUpdate(
      id,
      updateExerciseInput,
      { new: true },
    )
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
}
