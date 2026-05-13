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
  const collections = targetConnection.collections;
  const promises = Object.values(collections).map((collection) =>
    collection.deleteMany({}),
  );
  await Promise.all(promises);
};
