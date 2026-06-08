import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum Gender {
  MALE = 'M',
  FEMALE = 'F',
  OTHER = 'other',
}

export enum UnitsPreference {
  METRIC = 'metric',
  IMPERIAL = 'imperial',
}

export enum DistributionDays {
  WEKK = 'Week-log',
  DAY = 'Day-log',
}

@Schema({ timestamps: true })
export class UserProfile extends Document {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: Gender })
  gender: Gender;

  @Prop({ required: true, type: Date })
  birthDate: Date;

  @Prop({ required: true, type: Number, min: 50, max: 280 })
  heightCm: number;

  @Prop({ required: true, type: Number, min: 20, max: 500 })
  weightKg: number;

  @Prop({ type: Number, min: 1, max: 70, default: null })
  bodyFatPct?: number;

  @Prop({
    type: String,
    enum: DistributionDays,
    default: DistributionDays.WEKK,
  })
  distributionDays: DistributionDays;

  @Prop({
    type: String,
    enum: UnitsPreference,
    default: UnitsPreference.METRIC,
  })
  unitsPreference: UnitsPreference;
}

export const UserProfileSchema = SchemaFactory.createForClass(UserProfile);

export type UserProfileDocument = UserProfile & Document;
