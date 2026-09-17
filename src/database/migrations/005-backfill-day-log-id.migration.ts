import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from 'src/app.module';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';

const logger = new Logger('BackfillDayLogIdMigration');

/**
 * Populates `workoutsessions.dayLogId` for day-log sessions created before the
 * back-reference existed. The `daylogs` collection stores the forward reference
 * (`workoutSessionId`), so it is the source of truth for the backfill.
 */
async function migrate() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const connection: Connection = app.get(getConnectionToken());

  logger.log('Iniciando migración: backfill dayLogId en workoutsessions...');

  const dayLogsCollection = connection.collection('daylogs');
  const sessionsCollection = connection.collection('workoutsessions');

  const dayLogs = await dayLogsCollection
    .find({ workoutSessionId: { $ne: null }, deleted: { $ne: true } })
    .toArray();

  let updated = 0;
  let skipped = 0;

  for (const dayLog of dayLogs) {
    const rawSessionId = dayLog.workoutSessionId;
    if (!rawSessionId) {
      skipped++;
      continue;
    }

    let sessionId: Types.ObjectId;
    try {
      sessionId =
        rawSessionId instanceof Types.ObjectId
          ? rawSessionId
          : new Types.ObjectId(rawSessionId.toString());
    } catch {
      logger.warn(
        `DayLog ${dayLog._id} tiene un workoutSessionId inválido: ${rawSessionId}`,
      );
      skipped++;
      continue;
    }

    const result = await sessionsCollection.updateOne(
      {
        _id: sessionId,
        $or: [{ dayLogId: null }, { dayLogId: { $exists: false } }],
      },
      { $set: { dayLogId: dayLog._id } },
    );

    if (result.modifiedCount > 0) {
      updated++;
    } else {
      skipped++;
    }
  }

  logger.log(
    `✅ WorkoutSessions con dayLogId backfilleado: ${updated} (omitidos: ${skipped})`,
  );

  await app.close();
  logger.log('🎉 Migración completada exitosamente');
}

migrate().catch((err) => {
  logger.error('❌ Error durante la migración:', err);
  process.exit(1);
});
