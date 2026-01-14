import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ timestamps: true })
export class RoutinePlan extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({
    type: [MongooseSchema.Types.Mixed],
    default: [],
  })
  routineDays?: any[];
  @Prop({ required: false })
  createdBy?: string;
}

export const RoutinePlanSchema = SchemaFactory.createForClass(RoutinePlan);
