import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum DayLogStatusEnum {
  PENDING = 'pending',
  COMPLETE = 'complete',
  SKIPPED = 'skipped',
}

@Schema({ timestamps: true })
export class DayLog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Date, required: true })
  date: Date;

  @Prop({ type: Types.ObjectId, ref: 'RoutinePlan', default: null })
  planId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'RoutineDay', default: null })
  routineDayId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'WorkoutSession', default: null })
  workoutSessionId?: Types.ObjectId | null;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'ExtraSession' }],
    default: [],
  })
  extraSessionIds: Types.ObjectId[];

  @Prop({
    type: String,
    enum: [DayLogStatusEnum.PENDING, DayLogStatusEnum.COMPLETE, DayLogStatusEnum.SKIPPED],
    default: DayLogStatusEnum.PENDING,
  })
  status: string;

  @Prop({ type: Boolean, default: true, index: true })
  active: boolean;

  @Prop({ type: Boolean, default: false })
  completed: boolean;

  @Prop({ type: String, default: '' })
  notes?: string;

  @Prop({ type: Boolean, default: false })
  deleted: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export type DayLogDocument = HydratedDocument<DayLog>;

export const DayLogSchema = SchemaFactory.createForClass(DayLog);

DayLogSchema.index({ userId: 1, date: 1 });
DayLogSchema.index({ userId: 1, active: 1 });
DayLogSchema.index({ workoutSessionId: 1 });
DayLogSchema.index({ extraSessionIds: 1 });
