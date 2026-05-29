import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DEFAULT_TIMEZONE, WeekLogService } from '../../week-log.service';
import { WEEK_LOG_REPOSITORY } from '../../domain/interfaces/repositories/week-log.repository.interface';
import { WeekLogDayDomain } from '../../domain/entities/week-log.domain';
import type { IWeekLogRepository } from '../../domain/interfaces/repositories/week-log.repository.interface';
import {
  isValidLocalDate,
  isDateSameLocalDate,
} from 'src/common/utils/date.utils';
import { WeekLogValidator } from '../validators/week-log.validator';
import { ExtraSessionService } from '../../../extra-session/extra-session.service';

@Injectable()
export class RemoveExtraSessionUseCase {
  constructor(
    private readonly validator: WeekLogValidator,

    @Inject(forwardRef(() => WeekLogService))
    private readonly weekLogService: WeekLogService,
    private readonly extraSessionService: ExtraSessionService,
    @Inject(WEEK_LOG_REPOSITORY)
    private readonly weekLogRepository: IWeekLogRepository,
  ) {}

  async execute(
    extraSessionId: string,
    userId: string,
    date: string, // LocalDate "yyyy-MM-dd"
    timezone: string = DEFAULT_TIMEZONE,
  ): Promise<WeekLogDayDomain> {
    const weekLog = await this.weekLogRepository.findActive(userId);

    if (!weekLog) {
      throw new NotFoundException(
        `No se encontró un WeekLog con el extraSessionId "${extraSessionId}"`,
      );
    }

    this.validator.validateOwnership(weekLog, userId);

    if (!isValidLocalDate(date)) {
      throw new BadRequestException(
        `date "${date}" must be in yyyy-MM-dd format`,
      );
    }

    // ✅ Comparar LocalDate con fecha del día en Mongo
    const day = weekLog.days.find((d) =>
      isDateSameLocalDate(d.date, date, timezone),
    );

    if (!day) {
      throw new NotFoundException(
        `No se encontró un día con fecha "${date}" en el WeekLog activo`,
      );
    }

    day.extraSessionIds = day.extraSessionIds.filter(
      (id) => id.toString() !== extraSessionId,
    );

    await this.weekLogRepository.updateDayField(
      weekLog.id.toString(),
      day.order,
      {
        extraSessionIds: day.extraSessionIds,
      },
    );

    await this.extraSessionService.remove(extraSessionId, userId);

    return this.weekLogService.findOneDay(weekLog.id, day.order, userId);
  }
}
