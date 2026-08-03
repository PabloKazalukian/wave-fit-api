import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from 'src/app.module';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

const logger = new Logger('FixTrainingPlanFocusMigration');

// Mapeo de valores legacy (enum PlanFocus anterior) a los valores actuales,
// alineados con PrimaryGoal del goals.schema.
const LEGACY_FOCUS_MAP: Record<string, string> = {
  hypertrophy: 'muscle_gain', // equivalente semántico de muscle_gain
  sport_specific: 'strength', // rendimiento deportivo → fuerza
  general: 'maintenance', // fallback del parser anterior
};

async function migrate() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const connection: Connection = app.get(getConnectionToken());

  logger.log('Iniciando migración: focus legacy → PlanFocus válido...');

  const plansCollection = connection.collection('trainingplans');
  const docs = await plansCollection.find({}).toArray();

  const counts: Record<string, number> = {};
  let updated = 0;

  for (const doc of docs) {
    const focus = doc.focus as string;
    const target = LEGACY_FOCUS_MAP[focus];

    if (target && target !== focus) {
      await plansCollection.updateOne(
        { _id: doc._id },
        { $set: { focus: target } },
      );
      counts[`${focus} → ${target}`] = (counts[`${focus} → ${target}`] ?? 0) + 1;
      updated++;
      logger.warn(
        `  TrainingPlan ${doc._id}: focus "${focus}" → "${target}"`,
      );
    }
  }

  logger.log(`✅ TrainingPlans actualizados: ${updated}`);
  for (const [mapping, count] of Object.entries(counts)) {
    logger.log(`    ${mapping}: ${count}`);
  }

  await app.close();
  logger.log('🎉 Migración completada.');
}

migrate().catch((err) => {
  logger.error('❌ Error durante la migración:', err);
  process.exit(1);
});
