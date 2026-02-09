import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true })
export class WeekLog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Date, required: true, index: true })
  startDate: Date;

  @Prop({ type: Date, required: true })
  endDate: Date;

  @Prop({ type: Types.ObjectId, ref: 'RoutinePlan', default: null })
  planId?: Types.ObjectId;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'WorkoutSession' }],
    default: [],
  })
  workoutSessionIds: Types.ObjectId[];

  @Prop({ type: Boolean, default: false, index: true })
  completed: boolean;

  @Prop({ type: String, default: '' })
  notes?: string;
}

export const WeekLogSchema = SchemaFactory.createForClass(WeekLog);
WeekLogSchema.virtual('id').get(function (this: any) {
  return this._id.toHexString();
});
WeekLogSchema.index({ userId: 1, startDate: 1 }, { unique: true });
WeekLogSchema.index({ userId: 1, completed: 1 });
