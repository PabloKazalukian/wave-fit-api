import { distance } from 'fastest-levenshtein';

/**
 * Normaliza un string para comparaciones:
 * - Tokeniza por espacios
 * - Quita caracteres especiales excepto los permitidos
 * - Convierte a minúsculas
 * - Elimina acentos
 */
export function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quita acentos
    .replace(/[^a-z0-9\s]/g, '') // Quita caracteres especiales
    .trim()
    .split(/\s+/) // Tokeniza
    .filter((token) => token.length > 0)
    .join(' ');
}

/**
 * Compara dos strings usando la distancia de Levenshtein.
 * Retorna true si la distancia es menor o igual al umbral predefinido.
 */
export function isSimilar(
  str1: string,
  str2: string,
  threshold: number = 2,
): boolean {
  const norm1 = normalizeString(str1);
  const norm2 = normalizeString(str2);

  if (norm1 === norm2) return true;

  return distance(norm1, norm2) <= threshold;
}
