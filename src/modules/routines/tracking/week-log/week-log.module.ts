import { Module } from '@nestjs/common';
import { WeekLogService } from './week-log.service';
import { WeekLogResolver } from './week-log.resolver';
import { MongooseModule } from '@nestjs/mongoose';
import { WeekLog, WeekLogSchema } from './schema/week-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: WeekLog.name, schema: WeekLogSchema }]),
  ],
  providers: [WeekLogResolver, WeekLogService],
})
export class WeekLogModule {}
