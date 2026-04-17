import { addDays, differenceInDays, parseISO, format, isMatch } from 'date-fns';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';

/**
 * LocalDate = string en formato "yyyy-MM-dd"
 * Representa un día calendario sin ambigüedad de timezone.
 *
 * ✅ Usar para: fechas de negocio (startDate, endDate, date del workout, etc.)
 * ❌ No usar para: timestamps (createdAt, updatedAt, audit logs) → usar Date UTC
 */
export type LocalDate = string; // "yyyy-MM-dd"

const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

/**
 * Convierte un LocalDate "yyyy-MM-dd" + timezone IANA a un Date UTC.
 * El Date resultante representa el inicio del día (00:00:00) en esa timezone.
 *
 * Ejemplo: localDateToUtc("2024-04-16", "America/Argentina/Buenos_Aires")
 *   → 2024-04-16T03:00:00.000Z  (porque Argentina = UTC-3)
 *
 * ✅ Usar antes de guardar en MongoDB
 */
export function localDateToUtc(localDate: LocalDate, timezone: string): Date {
  // "yyyy-MM-dd" + " 00:00:00" en la timezone → Date UTC
  return fromZonedTime(`${localDate} 00:00:00`, timezone);
}

/**
 * Convierte un Date UTC de MongoDB a LocalDate "yyyy-MM-dd" en la timezone del usuario.
 *
 * Ejemplo: utcToLocalDate(new Date("2024-04-16T03:00:00Z"), "America/Argentina/Buenos_Aires")
 *   → "2024-04-16"
 *
 * ✅ Usar para comparar fechas almacenadas en Mongo con fechas de negocio
 */
export function utcToLocalDate(date: Date, timezone: string): LocalDate {
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd');
}

/**
 * Retorna la fecha de hoy como LocalDate "yyyy-MM-dd" en la timezone del usuario.
 *
 * ✅ Usar en lugar de `new Date()` para lógica de negocio
 */
export function todayInTimezone(
  timezone: string = DEFAULT_TIMEZONE,
): LocalDate {
  return formatInTimeZone(new Date(), timezone, 'yyyy-MM-dd');
}

/**
 * Compara si dos LocalDate son el mismo día calendario.
 * Comparación determinística: no depende de timezone ni de conversiones.
 */
export function isSameLocalDate(a: LocalDate, b: LocalDate): boolean {
  return a === b;
}

/**
 * Compara si una Date UTC de Mongo corresponde al mismo día que un LocalDate,
 * usando la timezone del usuario.
 */
export function isDateSameLocalDate(
  utcDate: Date,
  localDate: LocalDate,
  timezone: string,
): boolean {
  return utcToLocalDate(utcDate, timezone) === localDate;
}

/**
 * Avanza N días a partir de un LocalDate.
 * Ejemplo: addDaysToLocalDate("2024-04-16", 3) → "2024-04-19"
 */
export function addDaysToLocalDate(
  localDate: LocalDate,
  days: number,
): LocalDate {
  return format(addDays(parseISO(localDate), days), 'yyyy-MM-dd');
}

/**
 * Calcula la diferencia en días entre dos LocalDate strings.
 * Ejemplo: differenceInLocalDays("2024-04-22", "2024-04-16") → 6
 */
export function differenceInLocalDays(
  laterDate: LocalDate,
  earlierDate: LocalDate,
): number {
  return differenceInDays(parseISO(laterDate), parseISO(earlierDate));
}

/**
 * Valida que un string tenga formato "yyyy-MM-dd".
 */
export function isValidLocalDate(s: string): boolean {
  if (typeof s !== 'string') return false;
  return isMatch(s, 'yyyy-MM-dd');
}

/**
 * Timestamp UTC actual. Usar para createdAt, updatedAt, deletedAt, audit logs.
 * Es el único lugar donde new Date() está permitido para lógica de fecha.
 */
export function nowUtc(): Date {
  return new Date();
}
