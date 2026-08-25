import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from 'src/app.module';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { foldTokens, normalizeString } from 'src/common/utils/string.utils';

const logger = new Logger('DedupeExercisesMigration');

/**
 * Migración 004 — Deduplicación del catálogo de ejercicios.
 *
 * Elimina duplicados que el seed (insertMany) y creaciones manuales
 * dejaron en DB y que el materializer detecta como colisiones:
 *
 *   Pass A: mismo normalizedName        ("Remo con Mancuerna" x2)
 *   Pass B: mismos tokens singularizados ("Sentadilla" / "Sentadillas")
 *
 * Por cada grupo conserva el canónico (el más antiguo), repuntea todas
 * las referencias y borra el resto. Deja además el índice único en
 * normalizedName para prevenir futuros duplicados.
 *
 * Uso:
 *   npm run migration:dedupe-exercises          → dry-run (solo reporta)
 *   npm run migration:dedupe-exercises -- --apply → ejecuta cambios
 */

const APPLY = process.argv.includes('--apply');

interface ExerciseDoc {
  _id: Types.ObjectId;
  name: string;
  normalizedName?: string;
}

/** Colecciones que referencian ejercicios y cómo repuntearlas. */
async function repointExerciseRefs(
  connection: Connection,
  dupId: Types.ObjectId,
  canonicalId: Types.ObjectId,
): Promise<number> {
  let touched = 0;

  // routinedays.exercises[].exercise
  const res1 = await connection
    .collection('routinedays')
    .updateMany(
      { 'exercises.exercise': dupId },
      { $set: { 'exercises.$[e].exercise': canonicalId } },
      { arrayFilters: [{ 'e.exercise': dupId }] },
    );
  touched += res1.modifiedCount;

  // workoutsessions.exercises[].exerciseId
  const res2 = await connection
    .collection('workoutsessions')
    .updateMany(
      { 'exercises.exerciseId': dupId },
      { $set: { 'exercises.$[e].exerciseId': canonicalId } },
      { arrayFilters: [{ 'e.exerciseId': dupId }] },
    );
  touched += res2.modifiedCount;

  // usertrainingpreferences.favoriteExercises[]
  const res3 = await connection
    .collection('usertrainingpreferences')
    .updateMany(
      { favoriteExercises: dupId },
      { $set: { 'favoriteExercises.$[e]': canonicalId } },
      { arrayFilters: [{ e: dupId }] },
    );
  touched += res3.modifiedCount;

  // stats.userpersonalrecords.exerciseId
  const res4 = await connection
    .collection('userpersonalrecords')
    .updateMany({ exerciseId: dupId }, { $set: { exerciseId: canonicalId } });
  touched += res4.modifiedCount;

  // stats.usertopexercises.exerciseId
  const res5 = await connection
    .collection('usertopexercises')
    .updateMany({ exerciseId: dupId }, { $set: { exerciseId: canonicalId } });
  touched += res5.modifiedCount;

  return touched;
}

async function migrate() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const connection: Connection = app.get(getConnectionToken());

  logger.log(
    `Iniciando migración de dedupe de ejercicios (modo=${APPLY ? 'APPLY' : 'DRY-RUN'})...`,
  );

  const exercises = (await connection
    .collection('exercises')
    .find({})
    .sort({ createdAt: 1 })
    .toArray()) as unknown as ExerciseDoc[];

  logger.log(`Ejercicios totales: ${exercises.length}`);

  // ── Agrupado por capas ────────────────────────────────────────────────
  // mergeMap: idDuplicado → idCanónico
  const mergeMap = new Map<string, Types.ObjectId>();
  const groups: Array<{ key: string; docs: ExerciseDoc[] }> = [];

  const groupBy = (
    keyFn: (doc: ExerciseDoc) => string,
    label: string,
    excluded: Set<string>,
  ) => {
    const buckets = new Map<string, ExerciseDoc[]>();
    for (const doc of exercises) {
      if (excluded.has(doc._id.toString())) continue;
      const key = keyFn(doc);
      if (!key) continue;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(doc);
    }
    for (const [key, docs] of buckets) {
      if (docs.length < 2) continue;
      const canonical = docs[0];
      groups.push({
        key: `${label}:${key}`,
        docs,
      });
      for (const doc of docs.slice(1)) {
        mergeMap.set(doc._id.toString(), canonical._id);
        excluded.add(doc._id.toString());
      }
    }
  };

  const seen = new Set<string>();

  // Pass A — nombre normalizado exacto
  groupBy((d) => d.normalizedName ?? normalizeString(d.name), 'exact', seen);

  // Pass B — tokens singularizados (plural/singular)
  groupBy(
    (d) => foldTokens(d.normalizedName ?? d.name).join(' '),
    'folded',
    seen,
  );

  if (mergeMap.size === 0) {
    logger.log('✅ No se encontraron duplicados; nada para hacer.');
    await app.close();
    return;
  }

  for (const group of groups) {
    const [canonical, ...dupes] = group.docs;
    logger.log(
      `[${group.key}] canónico="${canonical.name}" (${canonical._id}) ← ${dupes
        .map((d) => `"${d.name}" (${d._id})`)
        .join(', ')}`,
    );
  }

  if (!APPLY) {
    logger.log(
      `🔍 DRY-RUN: se fusionarían ${mergeMap.size} duplicados. Re-run con "--apply" para ejecutar.`,
    );
    await app.close();
    return;
  }

  // ── Aplicar: repuntear referencias y borrar duplicados ───────────────
  let deleted = 0;
  let refsRepointed = 0;

  for (const [dupKey, canonicalId] of mergeMap) {
    const dupId = new Types.ObjectId(dupKey);
    refsRepointed += await repointExerciseRefs(connection, dupId, canonicalId);
    const delRes = await connection
      .collection('exercises')
      .deleteOne({ _id: dupId });
    deleted += delRes.deletedCount;
    logger.log(`♻️  "${dupKey}" → ${canonicalId} (borrado=${delRes.deletedCount})`);
  }

  logger.log(`✅ Referencias repunteadas: ${refsRepointed}`);
  logger.log(`✅ Ejercicios eliminados: ${deleted}`);

  // ── Índice único anti-duplicados ──────────────────────────────────────
  try {
    await connection
      .collection('exercises')
      .createIndex(
        { normalizedName: 1 },
        { unique: true, sparse: true },
      );
    logger.log('✅ Índice único creado: exercises.normalizedName');
  } catch (error) {
    logger.error(
      '❌ No se pudo crear el índice único en normalizedName (¿quedaron duplicados?):',
      error,
    );
  }

  await app.close();
  logger.log('🎉 Migración completada exitosamente');
}

migrate().catch((err) => {
  logger.error('❌ Error durante la migración:', err);
  process.exit(1);
});
