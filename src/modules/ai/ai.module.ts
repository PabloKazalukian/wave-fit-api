// modules/ai/ai.module.ts
import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { GroqProvider } from './providers/groq.provider';
// import { OpenAIProvider } from './providers/openai.provider';

@Module({
  providers: [
    AiService,
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
    'AI_PROVIDERS', // <-- ¡CRUCIAL! Tienes que exportar el token aquí también
  ],
})
export class AiModule {}
