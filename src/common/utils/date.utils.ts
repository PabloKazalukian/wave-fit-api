import { isSameDay, startOfDay, parseISO, format } from 'date-fns';

/**
 * Compares two dates and returns true if they are on the same day, regardless of time.
 * @param date1 First date to compare (Date, string, or number)
 * @param date2 Second date to compare (Date, string, or number)
 */
export const compareSameDay = (
  date1: Date | string | number,
  date2: Date | string | number,
): boolean => {
  const d1 = typeof date1 === 'string' ? parseISO(date1) : new Date(date1);
  const d2 = typeof date2 === 'string' ? parseISO(date2) : new Date(date2);
  return isSameDay(d1, d2);
};

/**
 * Returns a new date object set to the beginning of the day (00:00:00).
 * @param date Date to clear time from
 */
export const clearTime = (date: Date | string | number): Date => {
  const d = typeof date === 'string' ? parseISO(date) : new Date(date);
  return startOfDay(d);
};

export const parseLocalDate = (dateStr: string): Date => {
  return startOfDay(new Date(dateStr));
};

/**
 * Convierte un Date a string "YYYY-MM-DD" (formato para APIs/backend).
 */
export const toApiDateString = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
};
/**
 * Helper to ensure we have a Date object from a possible string or Date.
 */
export const ensureDate = (date: Date | string | number): Date => {
  return typeof date === 'string' ? parseISO(date) : new Date(date);
};
