import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';

async function bootstrap() {
  console.log('Iniciando script de normalización de IDs...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const connection = app.get<Connection>(getConnectionToken());

  const collectionsToNormalize = [
    'users',
    'exercises',
    'routineplans',
    'routinedays',
    'weeklogs',
    'workoutsessions',
    'extrasessions',
  ];

  // Campos que comúnmente guardan IDs
  const idFields = [
    '_id',
    'userId',
    'planId',
    'routineDayId',
    'weekLogId',
    'workoutSessionId',
  ];

  const arrayIdFields = ['exerciseIds', 'routineDayIds', 'extraSessionIds'];

  for (const collectionName of collectionsToNormalize) {
    console.log(`\nProcesando colección: ${collectionName}`);

    // Check if collection exists
    const collections = await connection.db
      ?.listCollections({ name: collectionName })
      .toArray();
    if (collections?.length === 0 || !connection.db) {
      console.log(`- Colección ${collectionName} no existe, ignorando.`);
      continue;
    }

    const collection = connection.collection(collectionName);
    const documents = await collection.find({}).toArray();

    let updatedCount = 0;

    for (const doc of documents) {
      let needsUpdate = false;
      const updateQuery: any = {};

      // 1. Campos simples
      for (const field of idFields) {
        if (
          doc[field] &&
          typeof doc[field] === 'string' &&
          Types.ObjectId.isValid(doc[field])
        ) {
          updateQuery[field] = new Types.ObjectId(doc[field]);
          needsUpdate = true;
        }
      }

      // 2. Campos de arreglos (arrays of IDs)
      for (const field of arrayIdFields) {
        if (doc[field] && Array.isArray(doc[field])) {
          let arrayNeedsUpdate = false;
          const newArray = doc[field].map((val: any) => {
            if (typeof val === 'string' && Types.ObjectId.isValid(val)) {
              arrayNeedsUpdate = true;
              return new Types.ObjectId(val);
            }
            return val;
          });

          if (arrayNeedsUpdate) {
            updateQuery[field] = newArray;
            needsUpdate = true;
          }
        }
      }

      // 3. Subdocumentos (caso especial weeklogs.days)
      if (
        collectionName === 'weeklogs' &&
        doc.days &&
        Array.isArray(doc.days)
      ) {
        let daysNeedsUpdate = false;
        const newDays = doc.days.map((day: any) => {
          let dayChanged = false;

          if (
            day.workoutSessionId &&
            typeof day.workoutSessionId === 'string' &&
            Types.ObjectId.isValid(day.workoutSessionId)
          ) {
            day.workoutSessionId = new Types.ObjectId(day.workoutSessionId);
            dayChanged = true;
          }

          if (day.extraSessionIds && Array.isArray(day.extraSessionIds)) {
            let extraNeedsUpdate = false;
            const newExtra = day.extraSessionIds.map((val: any) => {
              if (typeof val === 'string' && Types.ObjectId.isValid(val)) {
                extraNeedsUpdate = true;
                return new Types.ObjectId(val);
              }
              return val;
            });
            if (extraNeedsUpdate) {
              day.extraSessionIds = newExtra;
              dayChanged = true;
            }
          }

          if (dayChanged) {
            daysNeedsUpdate = true;
          }
          return day;
        });

        if (daysNeedsUpdate) {
          updateQuery.days = newDays;
          needsUpdate = true;
        }
      }

      // Aplicar actualización si es necesario
      if (needsUpdate) {
        const queryId = doc._id; // Mantener el id original para la búsqueda

        // Si el _id mismo era un string, es un caso muy especial en MongoDB.
        // Normalmente no se puede actualizar el _id de un documento existente.
        // Hay que borrarlo y recrearlo.
        if (updateQuery._id) {
          console.log(
            `- Documento con _id string encontrado: ${doc._id}. Recreando...`,
          );
          await collection.deleteOne({ _id: queryId });
          const newDoc = { ...doc, ...updateQuery };
          await collection.insertOne(newDoc);
        } else {
          await collection.updateOne({ _id: queryId }, { $set: updateQuery });
        }
        updatedCount++;
      }
    }

    console.log(
      `- Se normalizaron ${updatedCount} documentos en ${collectionName}.`,
    );
  }

  console.log('\nScript completado exitosamente.');
  await app.close();
}

bootstrap().catch((err) => {
  console.error('Error durante la normalización:', err);
  process.exit(1);
});
