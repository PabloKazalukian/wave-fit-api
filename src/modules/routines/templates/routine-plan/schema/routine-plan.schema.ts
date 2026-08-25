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

  // true = plan generado a partir de un TrainingPlan de IA (privado del creador)
  @Prop({ type: Boolean, default: false, index: true })
  isAiGenerated: boolean;

  // TrainingPlan que originó el plan (trazabilidad, null si fue creado a mano)
  @Prop({ type: Types.ObjectId, ref: 'TrainingPlan', default: null })
  generatedFromPlanId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  createdBy?: Types.ObjectId;
}

export const RoutinePlanSchema = SchemaFactory.createForClass(RoutinePlan);

RoutinePlanSchema.index({ 'week.day': 1 });
RoutinePlanSchema.index({ createdBy: 1, createdAt: -1 });
