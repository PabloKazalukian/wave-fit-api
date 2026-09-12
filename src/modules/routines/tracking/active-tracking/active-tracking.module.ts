import { Module, forwardRef } from '@nestjs/common';
import { WeekLogModule } from '../week-log/week-log.module';
import { DayLogModule } from '../day-log/day-log.module';
import { ActiveTrackingService } from './active-tracking.service';
import { ActiveTrackingResolver } from './active-tracking.resolver';
import { AuditLogsModule } from 'src/modules/audit-logs/audit-logs.module';

@Module({
  imports: [
    forwardRef(() => WeekLogModule),
    forwardRef(() => DayLogModule),
    AuditLogsModule,
  ],
  providers: [ActiveTrackingService, ActiveTrackingResolver],
  exports: [ActiveTrackingService],
})
export class ActiveTrackingModule {}
