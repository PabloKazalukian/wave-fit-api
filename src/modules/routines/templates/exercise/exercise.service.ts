import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateExerciseInput } from './dto/create-exercise.input';
import { UpdateExerciseInput } from './dto/update-exercise.input';
import { Exercise } from './schema/exercise.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class ExerciseService {
  constructor(
    @InjectModel(Exercise.name) private ExerciseModel: Model<Exercise>,
  ) {}
  async create(
    createExerciseInput: CreateExerciseInput,
  ): Promise<Exercise | undefined> {
    const { name } = createExerciseInput;
    const existing = await this.ExerciseModel.findOne({ name }).exec();
    if (existing) {
      throw new BadRequestException({
        message: `Ya existe un ejercicio con el nombre "${name}"`,
        code: 'DUPLICATE_NAME',
      });
    }
    const createdExercise = new this.ExerciseModel(createExerciseInput);
    return createdExercise.save();
  }

  async findAll() {
    return this.ExerciseModel.find().exec();
  }

  findOne(id: number) {
    return `This action returns a #${id} exercise`;
  }

  update(id: number, updateExerciseInput: UpdateExerciseInput) {
    return `This action updates a #${id} exercise`;
  }

  remove(id: number) {
    return `This action removes a #${id} exercise`;
  }
}
