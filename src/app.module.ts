import { Module } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from './user/user.module';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { RoutinePlanModule } from './routine-plan/routine-plan.module';
dotenv.config();

// console.log('DB_MONGO_PASSWORD:', process.env.DB_MONGO_PASSWORD);
@Module({
  imports: [
    MongooseModule.forRoot(
      `mongodb+srv://kazalukianpablo_db_user:${process.env.DB_MONGO_PASSWORD}@wavefit.ofapyei.mongodb.net/ `,
    ),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      // autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      playground: true, // habilita GraphQL playground
    }),
    UserModule,
    AuthModule,
    RoutinePlanModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
