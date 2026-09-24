import { BadRequestException } from '@nestjs/common';
import { getISOWeek, getISOWeekYear } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import {
  addDaysToLocalDate,
  differenceInLocalDays,
  isValidLocalDate,
  localDateToUtc,
  utcToLocalDate,
  type LocalDate,
} from '../../../common/utils/date.utils';
import {
  STATS_CHARTS_DEFAULT_TIMEZONE,
  STATS_CHARTS_MAX_RANGE_DAYS,
} from '../stats-charts.config';

export interface ResolvedWindow {
  timezone: string;
}

export function resolveTimezone(timezone: string | undefined): string {
  if (timezone && timezone.trim().length > 0) return timezone.trim();
  return STATS_CHARTS_DEFAULT_TIMEZONE;
}

export function validateStatsChartsRange(
  from: LocalDate,
  to: LocalDate,
  timezone?: string,
): ResolvedWindow {
  if (!isValidLocalDate(from) || !isValidLocalDate(to)) {
    throw new BadRequestException(
      'Invalid date range: "from" and "to" must be LocalDate strings (yyyy-MM-dd).',
    );
  }
  if (from > to) {
    throw new BadRequestException(
      'Invalid date range: "from" must be <= "to".',
    );
  }
  if (differenceInLocalDays(to, from) > STATS_CHARTS_MAX_RANGE_DAYS) {
    throw new BadRequestException(
      `Date range exceeds the ${STATS_CHARTS_MAX_RANGE_DAYS}-day limit (4 months).`,
    );
  }
  return { timezone: resolveTimezone(timezone) };
}

export function rangeUtcBounds(
  from: LocalDate,
  to: LocalDate,
  timezone: string,
): { fromUtc: Date; toUtc: Date } {
  return {
    fromUtc: localDateToUtc(from, timezone),
    toUtc: localDateToUtc(addDaysToLocalDate(to, 1), timezone),
  };
}

export function isoWeekKeyFor(dateUtc: Date, timezone: string): string {
  const zoned = toZonedTime(dateUtc, timezone);
  return `${getISOWeekYear(zoned)}-W${String(getISOWeek(zoned)).padStart(2, '0')}`;
}

export function buildWeekKeys(
  from: LocalDate,
  to: LocalDate,
  timezone: string,
): string[] {
  const keys: string[] = [];
  let current: LocalDate = from;
  while (current <= to) {
    const key = isoWeekKeyFor(localDateToUtc(current, timezone), timezone);
    if (keys[keys.length - 1] !== key) keys.push(key);
    current = addDaysToLocalDate(current, 1);
  }
  return keys;
}

export function localDateOf(dateUtc: Date, timezone: string): LocalDate {
  return utcToLocalDate(dateUtc, timezone);
}