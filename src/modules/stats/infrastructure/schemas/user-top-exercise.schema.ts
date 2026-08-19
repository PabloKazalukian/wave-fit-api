import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ _id: false })
class TopExerciseEntry {
  @Prop({ type: Number, required: true })
  rank: number;

  @Prop({ type: Types.ObjectId, ref: 'Exercise', required: true })
  exerciseId: Types.ObjectId;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, required: true })
  category: string;

  @Prop({ type: Number, required: true, min: 0 })
  totalSessions: number;

  @Prop({ type: Number, required: true, min: 0 })
  totalVolume: number;

  @Prop({ type: Number, required: true, min: 0 })
  avgVolumePerSession: number;
}

const TopExerciseEntrySchema = SchemaFactory.createForClass(TopExerciseEntry);

@Schema({ timestamps: true })
export class UserTopExercise {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ type: Date, required: true })
  computedAt: Date;

  @Prop({ type: [TopExerciseEntrySchema], default: [] })
  exercises: TopExerciseEntry[];
}

export type UserTopExerciseDocument = HydratedDocument<UserTopExercise>;
export const UserTopExerciseSchema = SchemaFactory.createForClass(UserTopExercise);

UserTopExerciseSchema.index({ userId: 1 }, { unique: true });
