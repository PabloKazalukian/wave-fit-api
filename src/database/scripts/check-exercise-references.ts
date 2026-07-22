import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from 'src/app.module';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';

const logger = new Logger('CheckExerciseReferences');

interface BrokenReference {
  collection: string;
  documentId: Types.ObjectId;
  documentTitle?: string;
  brokenExerciseId: Types.ObjectId;
  fieldPath: string;
}

async function check() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const connection: Connection = app.get(getConnectionToken());

  logger.log('Verificando integridad de referencias a Exercise...');

  // 1. Obtener todos los IDs de exercises existentes
  const exercisesCollection = connection.collection('exercises');
  const existingExercises = await exercisesCollection.find({}, { projection: { _id: 1 } }).toArray();
  const exerciseIds = new Set(existingExercises.map((e) => e._id.toString()));
  logger.log(`Exercises en DB: ${exerciseIds.size}`);

  const brokenRefs: BrokenReference[] = [];

  // 2. Verificar RoutineDays → exercises[].exercise
  const routineDaysCollection = connection.collection('routinedays');
  const routineDays = await routineDaysCollection.find({}).toArray();
  logger.log(`RoutineDays a verificar: ${routineDays.length}`);

  for (const rd of routineDays) {
    if (!rd.exercises || !Array.isArray(rd.exercises)) continue;
    for (const entry of rd.exercises) {
      const exId = entry.exercise;
      if (exId && !exerciseIds.has(exId.toString())) {
        brokenRefs.push({
          collection: 'routinedays',
          documentId: rd._id,
          documentTitle: rd.title,
          brokenExerciseId: exId,
          fieldPath: 'exercises[].exercise',
        });
      }
    }
  }

  // 3. Verificar WorkoutSessions → exercises[].exerciseId
  const wsCollection = connection.collection('workoutsessions');
  const workoutSessions = await wsCollection.find({}).toArray();
  logger.log(`WorkoutSessions a verificar: ${workoutSessions.length}`);

  for (const ws of workoutSessions) {
    if (!ws.exercises || !Array.isArray(ws.exercises)) continue;
    for (const entry of ws.exercises) {
      const exId = entry.exerciseId;
      if (exId && !exerciseIds.has(exId.toString())) {
        brokenRefs.push({
          collection: 'workoutsessions',
          documentId: ws._id,
          brokenExerciseId: exId,
          fieldPath: 'exercises[].exerciseId',
        });
      }
    }
  }

  // 4. Resultados
  if (brokenRefs.length === 0) {
    logger.log('✅ Todas las referencias a Exercise son válidas. No hay integridad rota.');
  } else {
    logger.warn(`⚠️  Se encontraron ${brokenRefs.length} referencias rotas:\n`);

    // Agrupar por colección
    const byCollection = brokenRefs.reduce(
      (acc, ref) => {
        (acc[ref.collection] ??= []).push(ref);
        return acc;
      },
      {} as Record<string, BrokenReference[]>,
    );

    for (const [collection, refs] of Object.entries(byCollection)) {
      logger.warn(`── ${collection} (${refs.length} referencias rotas) ──`);
      for (const ref of refs) {
        const title = ref.documentTitle ? ` "${ref.documentTitle}"` : '';
        logger.warn(
          `  Doc ${ref.documentId}${title} → ${ref.fieldPath} → exerciseId ${ref.brokenExerciseId} NO EXISTE`,
        );
      }
    }
  }

  await app.close();
  logger.log('Verificación completada.');
}

check().catch((err) => {
  logger.error('Error durante la verificación:', err);
  process.exit(1);
});
