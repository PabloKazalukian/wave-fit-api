import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateRoutinePlanInput } from './dto/create-routine-plan.input';
import { UpdateRoutinePlanInput } from './dto/update-routine-plan.input';
import { InjectModel } from '@nestjs/mongoose';
import { RoutinePlan as RoutinePlanSchema } from './schema/routine-plan.schema';
import {
  UserTrainingPreference,
} from 'src/modules/user/user-profile/schema/training-preference.schema';
import { RoutinePlan } from './entities/routine-plan.entity';
import { Model, Types } from 'mongoose';
import { serializeMongo } from 'src/common/utils/mongo.utils';
import { markItemsAsFavorites } from 'src/common/utils/favorites.utils';

@Injectable()
export class RoutinePlanService {
  constructor(
    @InjectModel(RoutinePlanSchema.name)
    private routinePlanModel: Model<RoutinePlanSchema>,
    @InjectModel(UserTrainingPreference.name)
    private readonly trainingPreferenceModel: Model<UserTrainingPreference>,
  ) {}

  async create(input: CreateRoutinePlanInput): Promise<RoutinePlan> {
    const week = (input.routineDays || []).map((id, index) => ({
      day: id ? new Types.ObjectId(id) : null,
      isRest: !id,
      order: index,
    }));

    const plan = await this.routinePlanModel.create({
      ...input,
      week,
    });
    return serializeMongo<RoutinePlan>(plan);
  }

  /**
   * Devuelve los planes visibles para un usuario: los globales (sin owner,
   * ej. seed) + los propios. Los planes creados por otros usuarios
   * (incluidos los generados con IA) nunca se exponen a terceros.
   */
  async findAll(userId?: string): Promise<RoutinePlan[]> {
    const filter = userId
      ? {
          $or: [
            { createdBy: null },
            { createdBy: new Types.ObjectId(userId) },
          ],
        }
      : {};
    const docs = await this.routinePlanModel.find(filter).lean().exec();
    return serializeMongo<RoutinePlan[]>(docs);
  }

  /**
   * Busca un plan por id. Si se recibe userId, solo devuelve planes
   * globales o propios (un plan ajeno responde 404).
   */
  async findOne(id: string, userId?: string): Promise<RoutinePlan> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`ID "${id}" no es válido`);
    }

    const filter: Record<string, any> = { _id: id };
    if (userId) {
      filter.$or = [
        { createdBy: null },
        { createdBy: new Types.ObjectId(userId) },
      ];
    }

    const plan = await this.routinePlanModel.findOne(filter).lean().exec();

    if (!plan) {
      throw new NotFoundException(`Plan con ID "${id}" no encontrado`);
    }

    return serializeMongo<RoutinePlan>(plan);
  }

  async findOneWithDays(id: string): Promise<RoutinePlan> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`ID "${id}" no es válido`);
    }

    const plan = await this.routinePlanModel
      .findById(id)
      .populate('week.day')
      .lean()
      .exec();

    if (!plan) {
      throw new NotFoundException(`Plan con ID "${id}" no encontrado`);
    }

    return serializeMongo<RoutinePlan>(plan);
  }

  async findByTitle(title: string): Promise<RoutinePlan | null> {
    const doc = await this.routinePlanModel
      .findOne({ name: title })
      .lean()
      .exec();
    return doc ? serializeMongo<RoutinePlan>(doc) : null;
  }

  async update(
    id: string,
    updateRoutinePlanInput: UpdateRoutinePlanInput,
  ): Promise<RoutinePlan> {
    const updated = await this.routinePlanModel
      .findByIdAndUpdate(id, updateRoutinePlanInput, { new: true })
      .lean()
      .exec();

    if (!updated) {
      throw new NotFoundException(`Plan with id ${id} not found`);
    }

    return serializeMongo<RoutinePlan>(updated);
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.routinePlanModel.findByIdAndDelete(id).exec();
    return !!result;
  }

  async findByIds(ids: string[]): Promise<RoutinePlan[]> {
    const docs = await this.routinePlanModel
      .find({ _id: { $in: ids } })
      .lean()
      .exec();
    return serializeMongo<RoutinePlan[]>(docs);
  }

  async getFavoriteRoutineIds(userId: string): Promise<Set<string>> {
    const preference = await this.trainingPreferenceModel
      .findOne({ userId: new Types.ObjectId(userId) }, { favoriteRoutines: 1 })
      .lean()
      .exec();
    return new Set(
      (preference?.favoriteRoutines ?? []).map((id) => String(id)),
    );
  }

  markFavorites<T extends { id: string }>(
    plans: T[],
    favoriteIds: Set<string>,
  ): T[] {
    return markItemsAsFavorites(plans, favoriteIds);
  }
}
