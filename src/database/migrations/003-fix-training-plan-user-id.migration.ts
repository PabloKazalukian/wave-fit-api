import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from 'src/app.module';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';

const logger = new Logger('FixTrainingPlanUserIdsMigration');

const ID_FIELDS = ['userId', 'userProfileId', 'goalId', 'replacedByPlanId'];

async function migrate() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const connection: Connection = app.get(getConnectionToken());

  logger.log('Iniciando migración: refs string → ObjectId en TrainingPlans...');

  const plansCollection = connection.collection('trainingplans');
  const docs = await plansCollection.find({}).toArray();
  let updated = 0;

  for (const doc of docs) {
    const set: Record<string, any> = {};

    for (const field of ID_FIELDS) {
      const value = doc[field];
      if (
        value != null &&
        typeof value === 'string' &&
        Types.ObjectId.isValid(value)
      ) {
        set[field] = new Types.ObjectId(value);
      }
    }

    if (Object.keys(set).length > 0) {
      await plansCollection.updateOne({ _id: doc._id }, { $set: set });
      updated++;
      logger.warn(
        `  TrainingPlan ${doc._id}: ${Object.keys(set).join(', ')} → ObjectId`,
      );
    }
  }

  logger.log(`✅ TrainingPlans actualizados: ${updated}`);

  await app.close();
  logger.log('🎉 Migración completada.');
}

migrate().catch((err) => {
  logger.error('❌ Error durante la migración:', err);
  process.exit(1);
});
