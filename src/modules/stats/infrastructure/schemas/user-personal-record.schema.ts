import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ _id: false })
class PersonalRecordEntry {
  @Prop({ type: Types.ObjectId, ref: 'Exercise', required: true })
  exerciseId: Types.ObjectId;

  @Prop({ type: String, required: true })
  exerciseName: string;

  @Prop({ type: String, required: true })
  category: string;

  @Prop({ type: Number, required: true, min: 0 })
  oneRmEstimated: number;

  @Prop({ type: Number, required: true, min: 0 })
  bestWeight: number;

  @Prop({ type: Number, required: true, min: 0 })
  bestReps: number;

  @Prop({ type: Number, required: true, min: 0 })
  bestVolume: number;

  @Prop({ type: Date, required: true })
  achievedAt: Date;

  @Prop({ type: Number, default: null })
  previousOneRm: number | null;
}

const PersonalRecordEntrySchema = SchemaFactory.createForClass(PersonalRecordEntry);

@Schema({ timestamps: true })
export class UserPersonalRecord {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ type: Date, required: true })
  computedAt: Date;

  @Prop({ type: [PersonalRecordEntrySchema], default: [] })
  records: PersonalRecordEntry[];
}

export type UserPersonalRecordDocument = HydratedDocument<UserPersonalRecord>;
export const UserPersonalRecordSchema = SchemaFactory.createForClass(UserPersonalRecord);

UserPersonalRecordSchema.index({ userId: 1 }, { unique: true });
