import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum TrainingEnvironment {
  GYM = 'gym',
  HOME = 'home',
  OUTDOOR = 'outdoor',
  HOTEL = 'hotel',
  CROSSFIT_BOX = 'crossfit_box',
}

// Sub-documento: equipamiento detallado con opciones granulares
@Schema({ _id: false })
class AvailableEquipment {
  @Prop({ type: Boolean, default: false }) barbell: boolean;
  @Prop({ type: Boolean, default: false }) squat_rack: boolean;
  @Prop({ type: Boolean, default: false }) power_rack: boolean;
  @Prop({ type: Boolean, default: false }) cables: boolean;
  @Prop({ type: Boolean, default: false }) smith_machine: boolean;
  @Prop({ type: Boolean, default: false }) leg_press: boolean;
  @Prop({ type: Boolean, default: false }) dumbbells: boolean;
  @Prop({ type: Boolean, default: false }) kettlebells: boolean;
  @Prop({ type: Boolean, default: false }) resistance_bands: boolean;
  @Prop({ type: Boolean, default: false }) pullup_bar: boolean;
  @Prop({ type: Boolean, default: false }) dip_bars: boolean;
  @Prop({ type: Boolean, default: false }) trx: boolean;
  @Prop({ type: Boolean, default: false }) treadmill: boolean;
  @Prop({ type: Boolean, default: false }) stationary_bike: boolean;
  @Prop({ type: Boolean, default: false }) rowing_machine: boolean;
  @Prop({ type: Boolean, default: false }) elliptical: boolean;
  @Prop({ type: Boolean, default: false }) jump_rope: boolean;
  @Prop({ type: Boolean, default: false }) ab_wheel: boolean;
  @Prop({ type: Boolean, default: false }) foam_roller: boolean;
}

const AvailableEquipmentSchema =
  SchemaFactory.createForClass(AvailableEquipment);

@Schema({ timestamps: true })
export class UserResource extends Document {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: [String],
    enum: TrainingEnvironment,
    required: true,
    validate: [
      (v: string[]) => v.length > 0,
      'Se requiere al menos un entorno de entrenamiento',
    ],
  })
  trainingEnvironments: TrainingEnvironment[];

  @Prop({ type: AvailableEquipmentSchema, default: () => ({}) })
  equipment: AvailableEquipment;

  // Si tiene mancuernas en casa, ¿hasta cuánto peso llegan?
  @Prop({ type: Number, min: 0, max: 200, default: null })
  dumbbellMaxKg?: number;

  // Distancia al gym — impacta adherencia
  @Prop({ type: Number, min: 0, default: null })
  gymDistanceKm?: number;
}

export const UserResourceSchema = SchemaFactory.createForClass(UserResource);
