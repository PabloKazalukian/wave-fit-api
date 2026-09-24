import { BadRequestException } from '@nestjs/common';
import {
  resolveTimezone,
  validateStatsChartsRange,
  rangeUtcBounds,
  isoWeekKeyFor,
  buildWeekKeys,
} from './range.utils';
import { localDateToUtc } from '../../../common/utils/date.utils';
import {
  STATS_CHARTS_DEFAULT_TIMEZONE,
  STATS_CHARTS_MAX_RANGE_DAYS,
} from '../stats-charts.config';

describe('range.utils (stats-charts)', () => {
  describe('resolveTimezone', () => {
    it('returns the default timezone when undefined or empty', () => {
      expect(resolveTimezone(undefined)).toBe(STATS_CHARTS_DEFAULT_TIMEZONE);
      expect(resolveTimezone('')).toBe(STATS_CHARTS_DEFAULT_TIMEZONE);
      expect(resolveTimezone('   ')).toBe(STATS_CHARTS_DEFAULT_TIMEZONE);
    });

    it('preserves and trims an explicit timezone', () => {
      expect(resolveTimezone('  America/New_York  ')).toBe('America/New_York');
    });
  });

  describe('validateStatsChartsRange', () => {
    it('accepts a valid window and resolves the default timezone', () => {
      const resolved = validateStatsChartsRange('2026-09-01', '2026-09-30');
      expect(resolved.timezone).toBe(STATS_CHARTS_DEFAULT_TIMEZONE);
    });

    it('keeps an explicit timezone', () => {
      const resolved = validateStatsChartsRange(
        '2026-09-01',
        '2026-09-30',
        'America/New_York',
      );
      expect(resolved.timezone).toBe('America/New_York');
    });

    it('rejects non-LocalDate strings', () => {
      expect(() => validateStatsChartsRange('2026-02-31', '2026-03-01')).toThrow(
        BadRequestException,
      );
      expect(() => validateStatsChartsRange('abc', '2026-03-01')).toThrow(
        BadRequestException,
      );
      expect(() =>
        validateStatsChartsRange('2026-03-01', 'not-a-date'),
      ).toThrow(BadRequestException);
    });

    it('rejects from > to', () => {
      expect(() => validateStatsChartsRange('2026-03-01', '2026-02-01')).toThrow(
        BadRequestException,
      );
    });

    it(`rejects spans over ${STATS_CHARTS_MAX_RANGE_DAYS} days (4-month cap)`, () => {
      expect(() =>
        validateStatsChartsRange('2026-01-01', '2026-05-02'),
      ).toThrow(BadRequestException);
    });

    it(`accepts a span of exactly ${STATS_CHARTS_MAX_RANGE_DAYS} days`, () => {
      const over = new Date(0);
      over.setUTCFullYear(2026, 0, 1 + STATS_CHARTS_MAX_RANGE_DAYS);
      const year = over.getUTCFullYear();
      const month = String(over.getUTCMonth() + 1).padStart(2, '0');
      const day = String(over.getUTCDate()).padStart(2, '0');
      expect(() =>
        validateStatsChartsRange('2026-01-01', `${year}-${month}-${day}`),
      ).not.toThrow();
    });
  });

  describe('rangeUtcBounds', () => {
    it('builds UTC [from, to+1day) bounds in the user timezone', () => {
      const { fromUtc, toUtc } = rangeUtcBounds(
        '2026-09-01',
        '2026-09-03',
        'America/Argentina/Buenos_Aires',
      );
      expect(fromUtc.toISOString()).toBe('2026-09-01T03:00:00.000Z');
      expect(toUtc.toISOString()).toBe('2026-09-04T03:00:00.000Z');
    });
  });

  describe('isoWeekKeyFor', () => {
    it('computes ISO week keys from UTC dates in the user timezone', () => {
      expect(
        isoWeekKeyFor(
          localDateToUtc('2026-01-01', 'America/Argentina/Buenos_Aires'),
          'America/Argentina/Buenos_Aires',
        ),
      ).toBe('2026-W01');
    });

    it('rolls the year over (2025-12-31 belongs to ISO week 2026-W01)', () => {
      expect(
        isoWeekKeyFor(
          localDateToUtc('2025-12-31', 'America/Argentina/Buenos_Aires'),
          'America/Argentina/Buenos_Aires',
        ),
      ).toBe('2026-W01');
    });

    it('advances to the next ISO week on the Monday boundary', () => {
      expect(
        isoWeekKeyFor(
          localDateToUtc('2026-01-05', 'America/Argentina/Buenos_Aires'),
          'America/Argentina/Buenos_Aires',
        ),
      ).toBe('2026-W02');
    });
  });

  describe('buildWeekKeys', () => {
    it('returns a single key for a window inside one ISO week', () => {
      expect(
        buildWeekKeys('2026-01-01', '2026-01-04', STATS_CHARTS_DEFAULT_TIMEZONE),
      ).toEqual(['2026-W01']);
    });

    it('returns contiguous week keys across a month border', () => {
      expect(
        buildWeekKeys('2026-01-01', '2026-01-12', STATS_CHARTS_DEFAULT_TIMEZONE),
      ).toEqual(['2026-W01', '2026-W02', '2026-W03']);
    });

    it('returns contiguous week keys across an ISO year border', () => {
      expect(
        buildWeekKeys('2025-12-29', '2026-01-11', STATS_CHARTS_DEFAULT_TIMEZONE),
      ).toEqual(['2026-W01', '2026-W02']);
    });

    it('never repeats a week key and is duration-independent of the day count', () => {
      const keys = buildWeekKeys(
        '2026-03-02',
        '2026-03-29',
        STATS_CHARTS_DEFAULT_TIMEZONE,
      );
      expect(new Set(keys).size).toBe(keys.length);
      expect(keys).toEqual(['2026-W10', '2026-W11', '2026-W12', '2026-W13']);
    });
  });
});