import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ _id: false })
class AdherenceWeekEntry {
  @Prop({ type: Date, required: true })
  weekStartDate: Date;

  @Prop({ type: Number, required: true, min: 0 })
  totalDays: number;

  @Prop({ type: Number, required: true, min: 0 })
  completedDays: number;

  @Prop({ type: Number, required: true, min: 0 })
  skippedDays: number;

  @Prop({ type: Number, required: true, min: 0 })
  pendingDays: number;

  @Prop({ type: Number, required: true, min: 0, max: 100 })
  adherencePercent: number;
}

const AdherenceWeekEntrySchema = SchemaFactory.createForClass(AdherenceWeekEntry);

@Schema({ timestamps: true })
export class UserAdherence {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ type: Date, required: true })
  computedAt: Date;

  @Prop({ type: [AdherenceWeekEntrySchema], default: [] })
  weeks: AdherenceWeekEntry[];
}

export type UserAdherenceDocument = HydratedDocument<UserAdherence>;
export const UserAdherenceSchema = SchemaFactory.createForClass(UserAdherence);

UserAdherenceSchema.index({ userId: 1 }, { unique: true });
