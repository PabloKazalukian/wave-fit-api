import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiResolver } from './ai.resolver';

@Module({
  providers: [AiResolver, AiService],
})
export class AiModule {}
