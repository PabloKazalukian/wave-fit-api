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
 * Singularización ingenua pero CONSISTENTE de un token en español.
 *
 * No pretende ser lingüísticamente correcta: alcanza con que variantes
 * del mismo nombre (singular/plural, ej. "mancuerna"/"mancuernas")
 * colapsen al mismo resultado, porque el folding se aplica por igual
 * a ambos lados de cualquier comparación.
 *
 * Reglas:
 * - "elevaciones" → "elevacion"  (termina en "es" y es larga)
 * - "mancuernas"  → "mancuerna"  (termina en "s" y es suficientemente larga)
 * - "press"       → "pres"       (imperfecto pero consistente en ambos lados)
 */
export function singularizeToken(token: string): string {
  if (token.length > 6 && token.endsWith('es')) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith('s')) return token.slice(0, -1);
  return token;
}

/**
 * Normaliza un string y singulariza cada token.
 * Base para matching difuso entre nombres que la IA devuelve y el catálogo.
 */
export function foldTokens(str: string): string[] {
  if (!str) return [];
  return normalizeString(str)
    .split(' ')
    .filter((token) => token.length > 0)
    .map(singularizeToken);
}

/**
 * Set de tokens normalizados y singularizados (sin orden ni duplicados).
 */
export function tokenSet(str: string): Set<string> {
  return new Set(foldTokens(str));
}

/**
 * Compara dos strings usando la distancia de Levenshtein.
 * Retorna true si la distancia es menor o igual al umbral predefinido.
 */
const OPPOSITE_KEYWORDS: [string, string][] = [
  // Direcciones y Movimientos Principales
  ['pull', 'push'], // Tracción vs Empuje
  ['up', 'down'], // Arriba vs Abajo
  ['elevacion', 'depresion'],
  ['extension', 'flexion'], // Clásico: Extensión de tríceps vs Curl (Flexión)
  ['abduccion', 'aduccion'], // Abd vs Add (Muy parecidos en Levenshtein)
  ['abd', 'add'], // Versiones cortas comunes

  // Planos anatómicos y agarres
  ['supino', 'prono'], // Agarre hacia arriba vs hacia abajo
  ['supinacion', 'pronacion'],
  ['anterior', 'posterior'], // Deltoides anterior vs posterior
  ['frontal', 'lateral'], // Elevaciones frontales vs laterales
  ['interno', 'externo'], // Rotadores
  ['inclinado', 'declinado'], // Press inclinado vs declinado

  // Materiales y Equipamiento (A veces mutan por una letra)
  ['barra', 'mancuerna'],
  ['mancuerna', 'polea'],
  ['barra', 'polea'],
  ['banda', 'polea'],
  ['maquina', 'libre'],
  ['dumbbell', 'barbell'], // DB vs BB en inglés
  ['kettlebell', 'barbell'],

  // Unilateral vs Bilateral
  ['unilateral', 'bilateral'],
  ['unilateral', 'doble'],
  ['una pierna', 'dos piernas'],
  ['un brazo', 'ambos brazos'],

  // Tipos de ejecución
  ['estatico', 'dinamico'],
  ['isometrico', 'isotonico'],
  ['estricto', 'con impulso'],
];

/**
 * Detecta si dos strings (ya normalizados o no) contienen palabras clave
 * mutuamente excluyentes (ej. "barra" vs "mancuerna", "pull" vs "push").
 * Usada para evitar falsos positivos en matching difuso.
 */
export function containsOppositeKeywords(str1: string, str2: string): boolean {
  const words1 = normalizeString(str1).split(' ');
  const words2 = normalizeString(str2).split(' ');

  for (const [op1, op2] of OPPOSITE_KEYWORDS) {
    const hasOp1 = words1.includes(op1) || words2.includes(op1);
    const hasOp2 = words1.includes(op2) || words2.includes(op2);
    if (hasOp1 && hasOp2) return true;
  }

  return false;
}

export function isSimilar(
  str1: string,
  str2: string,
  threshold: number = 2,
): boolean {
  const norm1 = normalizeString(str1);
  const norm2 = normalizeString(str2);

  if (norm1 === norm2) return true;

  // 1. Validar si contienen palabras opuestas
  if (containsOppositeKeywords(norm1, norm2)) return false;

  // 2. Si no hay conflicto de opuestos, aplicar Levenshtein
  return distance(norm1, norm2) <= threshold;
}

