import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum PreferredTime {
  MORNING = 'morning', // 5am – 12pm
  NOON = 'noon', // 12pm – 2pm
  AFTERNOON = 'afternoon', // 2pm – 6pm
  EVENING = 'evening', // 6pm – 11pm
}

export enum RestDayActivity {
  FULL_REST = 'full_rest',
  LIGHT_WALK = 'light_walk',
  ACTIVE_RECOVERY = 'active_recovery',
  YOGA_STRETCHING = 'yoga_stretching',
}

@Schema({ timestamps: true })
export class UserSchedule extends Document {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    required: true,
    type: Number,
    min: 1,
    max: 7,
  })
  daysPerWeek: number;

  // 0 = Domingo, 1 = Lunes, …, 6 = Sábado (igual que Date.getDay())
  @Prop({
    type: [Number],
    validate: [
      (v: number[]) => v.every((d) => d >= 0 && d <= 6),
      'Los días deben estar entre 0 (Domingo) y 6 (Sábado)',
    ],
    default: [],
  })
  preferredDays: number[];

  @Prop({
    required: true,
    type: Number,
    min: 15,
    max: 240,
    default: 60,
  })
  sessionDurationMin: number;

  @Prop({ type: String, enum: PreferredTime, default: null })
  preferredTime?: PreferredTime;

  @Prop({
    type: String,
    enum: RestDayActivity,
    default: RestDayActivity.FULL_REST,
  })
  restDayActivity: RestDayActivity;
}

export const UserScheduleSchema = SchemaFactory.createForClass(UserSchedule);
