import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ _id: false })
class TopRoutineEntry {
  @Prop({ type: Number, required: true })
  rank: number;

  @Prop({ type: Types.ObjectId, ref: 'RoutinePlan', required: true })
  planId: Types.ObjectId;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: Number, required: true, min: 0 })
  totalWeeks: number;

  @Prop({ type: Number, required: true, min: 0 })
  totalSessions: number;

  @Prop({ type: Number, required: true, min: 0, max: 100 })
  adherenceRate: number;
}

const TopRoutineEntrySchema = SchemaFactory.createForClass(TopRoutineEntry);

@Schema({ timestamps: true })
export class UserTopRoutine {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ type: Date, required: true })
  computedAt: Date;

  @Prop({ type: [TopRoutineEntrySchema], default: [] })
  routines: TopRoutineEntry[];
}

export type UserTopRoutineDocument = HydratedDocument<UserTopRoutine>;
export const UserTopRoutineSchema = SchemaFactory.createForClass(UserTopRoutine);

UserTopRoutineSchema.index({ userId: 1 }, { unique: true });
