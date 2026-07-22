import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from 'src/app.module';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';

const logger = new Logger('FixExerciseReferences');

async function fix() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const connection: Connection = app.get(getConnectionToken());

  logger.log('Arreglando referencias rotas a Exercise...');

  // 1. Obtener todos los IDs de exercises existentes
  const exercisesCollection = connection.collection('exercises');
  const existingExercises = await exercisesCollection.find({}, { projection: { _id: 1 } }).toArray();
  const exerciseIds = new Set(existingExercises.map((e) => e._id.toString()));
  logger.log(`Exercises en DB: ${exerciseIds.size}`);

  // 2. RoutineDays — eliminar exercises[] con exerciseId roto + re-indexar order
  const rdCollection = connection.collection('routinedays');
  const routineDays = await rdCollection.find({}).toArray();
  let rdUpdated = 0;

  for (const rd of routineDays) {
    if (!rd.exercises || !Array.isArray(rd.exercises) || rd.exercises.length === 0) continue;

    const valid = rd.exercises.filter((e: any) => e.exercise && exerciseIds.has(e.exercise.toString()));
    if (valid.length === rd.exercises.length) continue;

    const removed = rd.exercises.length - valid.length;
    // Re-indexar order secuencialmente
    const reindexed = valid.map((e: any, i: number) => ({ ...e, order: i }));

    await rdCollection.updateOne({ _id: rd._id }, { $set: { exercises: reindexed } });
    rdUpdated++;
    logger.warn(`  RoutineDay "${rd.title}" (${rd._id}): ${removed} ejercicio(s) eliminado(s), ${reindexed.length} restante(s)`);
  }

  logger.log(`✅ RoutineDays actualizados: ${rdUpdated}`);

  // 3. WorkoutSessions — eliminar exercises[] con exerciseId roto
  const wsCollection = connection.collection('workoutsessions');
  const workoutSessions = await wsCollection.find({}).toArray();
  let wsUpdated = 0;

  for (const ws of workoutSessions) {
    if (!ws.exercises || !Array.isArray(ws.exercises) || ws.exercises.length === 0) continue;

    const valid = ws.exercises.filter((e: any) => e.exerciseId && exerciseIds.has(e.exerciseId.toString()));
    if (valid.length === ws.exercises.length) continue;

    const removed = ws.exercises.length - valid.length;
    await wsCollection.updateOne({ _id: ws._id }, { $set: { exercises: valid } });
    wsUpdated++;
    logger.warn(`  WorkoutSession (${ws._id}): ${removed} ejercicio(s) eliminado(s), ${valid.length} restante(s)`);
  }

  logger.log(`✅ WorkoutSessions actualizados: ${wsUpdated}`);

  await app.close();
  logger.log('🎉 Reparación completada.');
}

fix().catch((err) => {
  logger.error('Error durante la reparación:', err);
  process.exit(1);
});
