import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from 'src/app.module';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import {
  isSimilar,
  normalizeString,
  foldTokens,
} from 'src/common/utils/string.utils';

const logger = new Logger('FindSimilarExercises');

interface ExerciseRow {
  _id: unknown;
  name: string;
}

/**
 * Auditoría READ-ONLY del catálogo de ejercicios.
 * Detecta problemas de datos que complican la resolución de nombres de la IA:
 *
 *  1. Duplicados exactos tras normalizar (mismo normalizedName)
 *  2. Equivalentes singular/plural ("Remo con mancuerna" vs "Remo con Mancuernas")
 *  3. Pares sospechosamente similares por Levenshtein (typos), con guarda
 *     de palabras opuestas (barra/polea, inclinado/declinado...)
 *  4. Contención de tokens ("Sentadilla búlgara" vs "Sentadilla Búlgaras con Mancuernas")
 *
 * No modifica datos: solo reporta.
 */
async function find() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const connection: Connection = app.get(getConnectionToken());

  const docs = await connection
    .collection('exercises')
    .find({}, { projection: { name: 1 } })
    .toArray();

  const exercises: ExerciseRow[] = docs.map((d) => ({
    _id: d._id,
    name: String(d.name ?? ''),
  }));

  logger.log(`Ejercicios en DB: ${exercises.length}`);
  if (exercises.length === 0) {
    await app.close();
    return;
  }

  let issues = 0;

  // 1. Duplicados por nombre normalizado
  const byNorm = new Map<string, ExerciseRow[]>();
  for (const ex of exercises) {
    const key = normalizeString(ex.name);
    if (!key) continue;
    const group = byNorm.get(key) ?? [];
    group.push(ex);
    byNorm.set(key, group);
  }
  logger.log('--- [1] Duplicados exactos (normalizados) ---');
  for (const group of byNorm.values()) {
    if (group.length < 2) continue;
    issues++;
    logger.warn(
      `  ${group.map((e) => `"${e.name}" (${e._id})`).join(' <-> ')}`,
    );
  }

  // 2. Equivalentes singular/plural (folding consistente)
  const byFolded = new Map<string, ExerciseRow[]>();
  for (const ex of exercises) {
    const key = foldTokens(ex.name).join(' ');
    if (!key) continue;
    const group = byFolded.get(key) ?? [];
    group.push(ex);
    byFolded.set(key, group);
  }
  logger.log('--- [2] Equivalentes singular/plural ---');
  for (const [key, group] of byFolded) {
    if (group.length < 2) continue;
    // Si ya son duplicados normalizados, ya se reportaron en [1]
    const norms = new Set(group.map((e) => normalizeString(e.name)));
    if (norms.size < 2) continue;
    issues++;
    logger.warn(`  [${key}] ${group.map((e) => `"${e.name}"`).join(' <-> ')}`);
  }
  void byNorm;

  // 3 y 4. Escaneo pareado
  logger.log('--- [3] Nombres sospechosamente similares (Levenshtein ≤ 3) ---');
  logger.log('--- [4] Contención de tokens (uno incluye al otro) ---');

  for (let i = 0; i < exercises.length; i++) {
    for (let j = i + 1; j < exercises.length; j++) {
      const a = exercises[i];
      const b = exercises[j];

      // [3] Similares por distancia acotada (isSimilar ya excluye opuestos
      // como barra/mancuerna o inclinado/declinado)
      if (
        normalizeString(a.name) !== normalizeString(b.name) &&
        isSimilar(a.name, b.name, 3)
      ) {
        issues++;
        logger.warn(
          `  [similar] "${a.name}" <-> "${b.name}"`,
        );
        continue;
      }

      // [4] Contención de tokens: los tokens de uno están todos presentes
      // en el otro (típico drift de la IA agregando equipamiento/detalles)
      const tokensA = new Set(foldTokens(a.name));
      const tokensB = new Set(foldTokens(b.name));
      if (tokensA.size === 0 || tokensB.size === 0) continue;

      const aInB = [...tokensA].every((t) => tokensB.has(t));
      const bInA = [...tokensB].every((t) => tokensA.has(t));
      if (aInB || bInA) {
        // Ya cubierto si comparten clave folded completa ([2]) o norm ([1])
        if (foldTokens(a.name).join(' ') === foldTokens(b.name).join(' ')) {
          continue;
        }
        issues++;
        const contained = aInB && !bInA ? a.name : b.name;
        const container = aInB && !bInA ? b.name : a.name;
        logger.warn(
          `  [contiene] "${contained}" está contenido en "${container}"`,
        );
      }
    }
  }

  if (issues === 0) {
    logger.log('✅ Sin inconsistencias detectadas en el catálogo.');
  } else {
    logger.log(
      `⚠️ Se detectaron ${issues} inconsistencia(s). Corregir los nombres en DB (las referencias son por ObjectId; el normalizedName se recalcula al guardar).`,
    );
  }

  await app.close();
}

find().catch((err) => {
  logger.error('Error durante la auditoría:', err);
  process.exit(1);
});
