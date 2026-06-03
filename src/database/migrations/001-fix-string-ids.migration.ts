import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from 'src/app.module';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';

const logger = new Logger('FixStringIdsMigration');

async function migrate() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const connection: Connection = app.get(getConnectionToken());

  logger.log('Iniciando migración: string → ObjectId en IDs...');

  // 1. WorkoutSessions
  const wsCollection = connection.collection('workoutsessions');
  const wsDocs = await wsCollection.find({}).toArray();
  let wsUpdated = 0;

  for (const doc of wsDocs) {
    const set: Record<string, any> = {};
    if (typeof doc.userId === 'string') {
      set.userId = new Types.ObjectId(doc.userId);
    }
    if (typeof doc.weekLogId === 'string') {
      set.weekLogId = new Types.ObjectId(doc.weekLogId);
    }
    if (typeof doc.routineDayId === 'string') {
      set.routineDayId = new Types.ObjectId(doc.routineDayId);
    }
    if (doc.exercises && Array.isArray(doc.exercises)) {
      const fixed: any[] = doc.exercises.map((ex: any) => {
        if (ex && typeof ex.exerciseId === 'string') {
          return { ...ex, exerciseId: new Types.ObjectId(ex.exerciseId) };
        }
        return ex;
      });
      set.exercises = fixed;
    }
    if (Object.keys(set).length > 0) {
      await wsCollection.updateOne({ _id: doc._id }, { $set: set });
      wsUpdated++;
    }
  }
  logger.log(`✅ WorkoutSessions actualizados: ${wsUpdated}`);

  // 2. WeekLogs — extraSessionIds en days
  const wlCollection = connection.collection('weeklogs');
  const wlDocs = await wlCollection.find({}).toArray();
  let wlUpdated = 0;

  for (const doc of wlDocs) {
    if (!doc.days || !Array.isArray(doc.days)) continue;

    let modified = false;
    const days = doc.days.map((day: any) => {
      if (!day.extraSessionIds || !Array.isArray(day.extraSessionIds)) return day;
      const fixed = day.extraSessionIds.map((id: any) =>
        typeof id === 'string' ? new Types.ObjectId(id) : id,
      );
      const hasChange = fixed.some(
        (f: any, i: number) => f !== day.extraSessionIds[i],
      );
      if (hasChange) modified = true;
      return { ...day, extraSessionIds: fixed };
    });

    if (modified) {
      await wlCollection.updateOne({ _id: doc._id }, { $set: { days } });
      wlUpdated++;
    }
  }
  logger.log(`✅ WeekLogs actualizados: ${wlUpdated}`);

  // 3. AuditLogs
  const alCollection = connection.collection('audit_logs');
  const alDocs = await alCollection.find({}).toArray();
  let alUpdated = 0;

  for (const doc of alDocs) {
    const set: Record<string, any> = {};
    if (typeof doc.userId === 'string') {
      set.userId = new Types.ObjectId(doc.userId);
    }
    if (doc.entityId && typeof doc.entityId === 'string') {
      set.entityId = new Types.ObjectId(doc.entityId);
    }
    if (Object.keys(set).length > 0) {
      await alCollection.updateOne({ _id: doc._id }, { $set: set });
      alUpdated++;
    }
  }
  logger.log(`✅ AuditLogs actualizados: ${alUpdated}`);

  await app.close();
  logger.log('🎉 Migración completada exitosamente');
}

migrate().catch((err) => {
  logger.error('❌ Error durante la migración:', err);
  process.exit(1);
});
