import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class RoutinePlan extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({
    type: [
      {
        day: {
          type: Types.ObjectId,
          ref: 'RoutineDay',
        },
        isRest: {
          type: Boolean,
          default: false,
        },
        order: {
          type: Number,
          required: true,
        },
      },
    ],
    validate: [(v: any[]) => v.length === 7, 'Must contain 7 days'],
  })
  week: {
    day?: Types.ObjectId;
    isRest: boolean;
    order: number;
  }[];

  @Prop({ required: false })
  weekly_distribution?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  createdBy?: Types.ObjectId;
}

export const RoutinePlanSchema = SchemaFactory.createForClass(RoutinePlan);

RoutinePlanSchema.index({ 'week.day': 1 });
