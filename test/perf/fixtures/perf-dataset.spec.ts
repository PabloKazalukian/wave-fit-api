import {
  PERF_SIZES,
  PERF_SIZE_SPECS,
  PERF_TIMEZONE,
  PERF_EXERCISES,
  PERF_ROUTINE_DAY_TITLES,
  buildPerfDataset,
} from './perf-dataset';
import {
  differenceInLocalDays,
  isValidLocalDate,
  utcToLocalDate,
} from '../../../src/common/utils/date.utils';
import { STATS_CHARTS_MAX_RANGE_DAYS } from '../../../src/modules/stats-charts/stats-charts.config';

describe('perf-dataset (stats-charts performance)', () => {
  it('exposes the three declared sizes', () => {
    expect([...PERF_SIZES]).toEqual(['small', 'medium', 'large']);
  });

  it('reuses the real seeded exercise catalog (30 exercises)', () => {
    expect(PERF_EXERCISES).toHaveLength(30);
  });

  it('builds six routine days', () => {
    expect(PERF_ROUTINE_DAY_TITLES).toHaveLength(6);
  });

  for (const size of PERF_SIZES) {
    describe(`size ${size}`, () => {
      const spec = PERF_SIZE_SPECS[size];

      it('produces the declared document counts', () => {
        const dataset = buildPerfDataset(size);

        expect(dataset.workoutSessions).toHaveLength(
          spec.windowSessions + spec.historySessions,
        );
        expect(dataset.extraSessions).toHaveLength(
          spec.windowExtras + spec.historyExtras,
        );
        expect(dataset.userWeightLogs).toHaveLength(spec.expectedWeightLogs);
        expect(dataset.exercises).toHaveLength(30);
        expect(dataset.routineDays).toHaveLength(6);
        expect(dataset.routinePlan.week).toHaveLength(7);
        expect(dataset.weekLog.days).toHaveLength(7);
        expect(dataset.userProfiles).toHaveLength(1);
      });

      it('splits sessions into in-window and historical as declared', () => {
        const dataset = buildPerfDataset(size);
        const inWindow = dataset.workoutSessions.filter(
          (s) => s.date >= dataset.fromUtc && s.date < dataset.toUtc,
        );

        expect(inWindow).toHaveLength(spec.windowSessions);
        expect(dataset.workoutSessions).toHaveLength(
          spec.windowSessions + spec.historySessions,
        );
      });

      it('keeps every in-window session complete and not deleted', () => {
        const dataset = buildPerfDataset(size);
        const inWindow = dataset.workoutSessions.filter(
          (s) => s.date >= dataset.fromUtc && s.date < dataset.toUtc,
        );

        expect(inWindow.length).toBeGreaterThan(0);
        for (const session of inWindow) {
          expect(session.status).toBe('complete');
          expect(session.deleted).toBe(false);
          expect(String(session.userId)).toBe(dataset.userId);
        }
      });

      it('produces a window the stats-charts resolver would accept', () => {
        const dataset = buildPerfDataset(size);

        expect(isValidLocalDate(dataset.from)).toBe(true);
        expect(isValidLocalDate(dataset.to)).toBe(true);
        expect(dataset.from <= dataset.to).toBe(true);
        expect(
          differenceInLocalDays(dataset.to, dataset.from),
        ).toBeLessThanOrEqual(STATS_CHARTS_MAX_RANGE_DAYS);
      });

      it('resolves the active-plan path used by forgotten-muscles', () => {
        const dataset = buildPerfDataset(size);

        expect(dataset.weekLog.active).toBe(true);
        expect(dataset.weekLog.planId).toBeTruthy();
        expect(String(dataset.weekLog.planId)).toBe(
          String(dataset.routinePlan._id),
        );
        expect(dataset.dayLog.active).toBe(true);
        expect(dataset.dayLog.routineDayId).toBeTruthy();

        const planDayIds = dataset.routinePlan.week
          .filter((d) => !d.isRest && d.day)
          .map((d) => String(d.day));
        expect(planDayIds).toHaveLength(6);
        expect(planDayIds).toContain(String(dataset.dayLog.routineDayId));
      });

      it('stores every session date inside the generated history', () => {
        const dataset = buildPerfDataset(size);

        for (const session of dataset.workoutSessions) {
          const local = utcToLocalDate(session.date, PERF_TIMEZONE);
          expect(local >= dataset.historyStart).toBe(true);
          expect(local <= dataset.to).toBe(true);
        }
      });

      it('keeps every weight log at or before the window end', () => {
        const dataset = buildPerfDataset(size);

        for (const log of dataset.userWeightLogs) {
          expect(log.loggedAt.getTime()).toBeLessThanOrEqual(
            dataset.toUtc.getTime(),
          );
        }
      });

      it('gives every extra session a catalog discipline and a valid category', () => {
        const dataset = buildPerfDataset(size);

        expect(dataset.extraSessions.length).toBeGreaterThan(0);
        for (const extra of dataset.extraSessions) {
          expect(extra.duration).toBeGreaterThanOrEqual(1);
          expect(extra.intensityLevel).toBeGreaterThanOrEqual(1);
          expect(extra.intensityLevel).toBeLessThanOrEqual(5);
        }
      });
    });
  }

  describe('determinism (BR-005)', () => {
    it('returns identical documents for two calls with the same size', () => {
      for (const size of PERF_SIZES) {
        const a = buildPerfDataset(size);
        const b = buildPerfDataset(size);

        expect(JSON.stringify(a.workoutSessions)).toBe(
          JSON.stringify(b.workoutSessions),
        );
        expect(JSON.stringify(a.extraSessions)).toBe(
          JSON.stringify(b.extraSessions),
        );
        expect(JSON.stringify(a.userWeightLogs)).toBe(
          JSON.stringify(b.userWeightLogs),
        );
        expect(JSON.stringify(a.exercises)).toBe(JSON.stringify(b.exercises));
        expect(String(a.routinePlan._id)).toBe(String(b.routinePlan._id));
        expect(a.userId).toBe(b.userId);
      }
    });

    it('gives each size a distinct userId so they can share one database', () => {
      const ids = PERF_SIZES.map((size) => buildPerfDataset(size).userId);
      expect(new Set(ids).size).toBe(PERF_SIZES.length);
    });

    it('never emits a date outside the anchor-derived range', () => {
      for (const size of PERF_SIZES) {
        const dataset = buildPerfDataset(size);
        const anySession = dataset.workoutSessions[0];
        expect(anySession).toBeDefined();
        expect(Number.isNaN(anySession.date.getTime())).toBe(false);
      }
    });
  });

  describe('size escalation (FR-003)', () => {
    it('keeps the window bounded while history grows', () => {
      const medium = buildPerfDataset('medium');
      const large = buildPerfDataset('large');

      expect(differenceInLocalDays(large.to, large.from)).toBe(
        differenceInLocalDays(medium.to, medium.from),
      );
      expect(large.workoutSessions.length).toBeGreaterThan(
        medium.workoutSessions.length,
      );
      expect(large.userWeightLogs.length).toBeGreaterThan(
        medium.userWeightLogs.length,
      );
    });

    it('anchors large history well before the window start', () => {
      const large = buildPerfDataset('large');
      expect(
        differenceInLocalDays(large.to, large.historyStart),
      ).toBeGreaterThan(400);
    });
  });
});
