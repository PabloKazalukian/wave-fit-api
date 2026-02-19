import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

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

// Agregar virtual 'id' para que GraphQL lo reconozca
RoutinePlanSchema.virtual('id').get(function (this: any) {
  return this._id.toHexString();
});
RoutinePlanSchema.index({ 'week.day': 1 });

// Configurar para que los virtuals se incluyan cuando se serializa
RoutinePlanSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc: any, ret: any) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

RoutinePlanSchema.set('toObject', {
  virtuals: true,
  transform: function (doc: any, ret: any) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
