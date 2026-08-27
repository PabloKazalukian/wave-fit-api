// modules/ai/ai.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiService } from './ai.service';
import { AiResolver } from './ai.resolver';
import { GroqProvider } from './providers/groq.provider';
import { AiRateLimitService } from './ai-rate-limit.service';
import { AiUsage, AiUsageSchema } from './schemas/ai-usage.schema';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
// import { OpenAIProvider } from './providers/openai.provider';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiUsage.name, schema: AiUsageSchema },
    ]),
    AuditLogsModule,
  ],
  providers: [
    AiService,
    AiResolver,
    AiRateLimitService,
    GroqProvider,
    // OpenAIProvider,
    {
      provide: 'AI_PROVIDERS',
      useFactory: (groq: GroqProvider) => {
        const registry = new Map<string, any>();
        registry.set(groq.name, groq);
        // registry.set(openai.name, openai);
        return registry;
      },
      inject: [GroqProvider], // Inyectamos las estrategias individuales
    },
  ],
  exports: [
    AiService,
    AiRateLimitService,
    'AI_PROVIDERS', // <-- ¡CRUCIAL! Tienes que exportar el token aquí también
  ],
})
export class AiModule {}
