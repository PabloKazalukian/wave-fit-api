import { Module } from '@nestjs/common';
import { RoutinePlanService } from './routine-plan.service';
import { RoutinePlanResolver } from './routine-plan.resolver';
import { RoutinePlan, RoutinePlanSchema } from './schema/routine-plan.schema';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RoutinePlan.name, schema: RoutinePlanSchema },
    ]),
  ],
  providers: [RoutinePlanResolver, RoutinePlanService],
})
export class RoutinePlanModule {}
