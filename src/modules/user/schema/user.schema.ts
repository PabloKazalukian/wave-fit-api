import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

@Schema()
export class User extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true, enum: UserRole, default: 'USER' })
  role!: UserRole;

  @Prop({ unique: true, sparse: true })
  googleId?: string;

  @Prop()
  picture?: string;

  @Prop({ type: String, default: 'America/Argentina/Buenos_Aires' })
  timezone?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
