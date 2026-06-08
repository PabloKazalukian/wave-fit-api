import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum InjurySeverity {
  MILD = 'mild', // Molestia menor, puede entrenar con cuidado
  MODERATE = 'moderate', // Limita algunos movimientos
  SEVERE = 'severe', // Impide ciertos ejercicios completamente
}

export enum BodyPart {
  LOWER_BACK = 'lower_back',
  UPPER_BACK = 'upper_back',
  NECK = 'neck',
  LEFT_SHOULDER = 'left_shoulder',
  RIGHT_SHOULDER = 'right_shoulder',
  LEFT_KNEE = 'left_knee',
  RIGHT_KNEE = 'right_knee',
  LEFT_HIP = 'left_hip',
  RIGHT_HIP = 'right_hip',
  LEFT_ELBOW = 'left_elbow',
  RIGHT_ELBOW = 'right_elbow',
  LEFT_WRIST = 'left_wrist',
  RIGHT_WRIST = 'right_wrist',
  LEFT_ANKLE = 'left_ankle',
  RIGHT_ANKLE = 'right_ankle',
  CORE = 'core',
  CHEST = 'chest',
}

export enum MobilityLevel {
  LIMITED = 'limited',
  MODERATE = 'moderate',
  GOOD = 'good',
  EXCELLENT = 'excellent',
}

// Sub-documento para cada lesión activa o pasada
@Schema({ _id: false })
class Injury {
  @Prop({ required: true, enum: BodyPart })
  bodyPart: BodyPart;

  @Prop({ required: true, enum: InjurySeverity })
  severity: InjurySeverity;

  // true = lesión activa que la IA debe considerar HOY
  @Prop({ required: true, type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: String, trim: true, default: null })
  description?: string;
}

const InjurySchema = SchemaFactory.createForClass(Injury);

@Schema({ timestamps: true })
export class UserHealthConstraint extends Document {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({ type: [InjurySchema], default: [] })
  injuries: Injury[];

  // Restricciones de movimiento en texto libre: "no overhead", "no sentadilla profunda"
  @Prop({ type: [String], default: [] })
  movementRestrictions: string[];

  // Condiciones médicas relevantes para el entrenamiento
  @Prop({ type: [String], default: [] })
  conditions: string[];

  @Prop({ type: String, enum: MobilityLevel, default: MobilityLevel.MODERATE })
  mobilityLevel: MobilityLevel;

  // ¿Tiene médico o fisio que supervise? Afecta la conservadurismo de los planes
  @Prop({ type: Boolean, default: false })
  hasHealthcareSupervision: boolean;
}

export const UserHealthConstraintSchema =
  SchemaFactory.createForClass(UserHealthConstraint);
