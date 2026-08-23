import {
  localDateToUtc,
  utcToLocalDate,
  todayInTimezone,
  isSameLocalDate,
  isDateSameLocalDate,
  addDaysToLocalDate,
  differenceInLocalDays,
  isValidLocalDate,
  nowUtc,
} from './date.utils';

const AR = 'America/Argentina/Buenos_Aires';

describe('date.utils', () => {
  describe('localDateToUtc', () => {
    it('convierte medianoche local de Argentina a UTC-3', () => {
      expect(localDateToUtc('2024-04-16', AR).toISOString()).toBe(
        '2024-04-16T03:00:00.000Z',
      );
    });
  });

  describe('utcToLocalDate', () => {
    it('convierte un Date UTC a LocalDate en la timezone', () => {
      const utc = new Date('2024-04-16T03:00:00.000Z');
      expect(utcToLocalDate(utc, AR)).toBe('2024-04-16');
    });

    it('cruza el día calendario según timezone', () => {
      // 02:00Z en Argentina son las 23:00 del día anterior
      const utc = new Date('2024-04-16T02:00:00.000Z');
      expect(utcToLocalDate(utc, AR)).toBe('2024-04-15');
    });
  });

  describe('todayInTimezone', () => {
    it('retorna un string con formato yyyy-MM-dd', () => {
      expect(todayInTimezone(AR)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('usa la timezone por defecto si no se pasa una', () => {
      expect(todayInTimezone()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('isSameLocalDate', () => {
    it('compara strings de día calendario directamente', () => {
      expect(isSameLocalDate('2024-04-16', '2024-04-16')).toBe(true);
      expect(isSameLocalDate('2024-04-16', '2024-04-17')).toBe(false);
    });
  });

  describe('isDateSameLocalDate', () => {
    it('true cuando el Date UTC corresponde al mismo día local', () => {
      const utc = new Date('2024-04-16T03:30:00.000Z');
      expect(isDateSameLocalDate(utc, '2024-04-16', AR)).toBe(true);
    });

    it('false cuando cae en otro día local', () => {
      const utc = new Date('2024-04-16T02:00:00.000Z');
      expect(isDateSameLocalDate(utc, '2024-04-16', AR)).toBe(false);
    });
  });

  describe('addDaysToLocalDate', () => {
    it('avanza N días', () => {
      expect(addDaysToLocalDate('2024-04-16', 6)).toBe('2024-04-22');
    });

    it('retrocede con días negativos y cruza meses', () => {
      expect(addDaysToLocalDate('2024-05-01', -1)).toBe('2024-04-30');
    });
  });

  describe('differenceInLocalDays', () => {
    it('calcula la diferencia en días', () => {
      expect(differenceInLocalDays('2024-04-22', '2024-04-16')).toBe(6);
      expect(differenceInLocalDays('2024-04-16', '2024-04-22')).toBe(-6);
    });
  });

  describe('isValidLocalDate', () => {
    it('acepta formato yyyy-MM-dd válido', () => {
      expect(isValidLocalDate('2024-04-16')).toBe(true);
    });

    it('rechaza formatos inválidos', () => {
      expect(isValidLocalDate('16/04/2024')).toBe(false);
      expect(isValidLocalDate('2024-13-01')).toBe(false);
    });

    it('rechaza no-strings', () => {
      expect(isValidLocalDate(null as unknown as string)).toBe(false);
      expect(isValidLocalDate(undefined as unknown as string)).toBe(false);
      expect(isValidLocalDate(123 as unknown as string)).toBe(false);
    });
  });

  describe('nowUtc', () => {
    it('retorna un Date con el momento actual', () => {
      const before = Date.now();
      const result = nowUtc();
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeGreaterThanOrEqual(before);
    });
  });
});
