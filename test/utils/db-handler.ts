import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryServer;

export const rootMongooseTestModule = (options: MongooseModuleOptions = {}) =>
  MongooseModule.forRootAsync({
    useFactory: async () => {
      mongoServer = await MongoMemoryServer.create();
      const uri = mongoServer.getUri();
      await mongoose.connect(uri);
      return { uri, ...options };
    },
  });

export const closeInMongodConnection = async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
};

export const clearDatabase = async (connection?: mongoose.Connection) => {
  const targetConnection = connection || mongoose.connection;
  // Los modelos pueden vivir en conexiones distintas a la default
  // (MongooseCoreModule usa createConnection), por lo que se enumeran
  // las colecciones desde la base, no desde connection.collections.
  const collections = await targetConnection.db.listCollections().toArray();
  const promises = collections.map((collection) =>
    targetConnection.db.collection(collection.name).deleteMany({}),
  );
  await Promise.all(promises);
};
