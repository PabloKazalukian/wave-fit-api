import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
export class AiSnapshot extends Document {
  // El objeto que buildUserContextForAI() generó y se envió
  @Prop({ type: Object, required: true })
  contextSentToAI: Record<string, any>;

  // El prompt completo enviado (system + user)
  @Prop({ type: String, required: true })
  promptUsed: string;

  // Modelo usado (ej: "gpt-4o", "claude-3-5-sonnet")
  @Prop({ type: String, required: true })
  modelUsed: string;

  // Respuesta cruda de la IA (el JSON tal como llegó)
  @Prop({ type: Object, required: true })
  rawResponse: Record<string, any>;

  // Tokens consumidos (opcional, para métricas de costo)
  @Prop({ type: Number, default: null })
  tokensUsed?: number;

  @Prop({ type: Date, default: () => new Date() })
  generatedAt: Date;
}

export const AiSnapshotSchema = SchemaFactory.createForClass(AiSnapshot);
