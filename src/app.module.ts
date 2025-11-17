import { Module } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { RoutinePlanModule } from './modules/routines/templates/routine-plan/routine-plan.module';
import { RoutineDayModule } from './modules/routines/templates/routine-day/routine-day.module';
import { WorkoutSessionModule } from './modules/routines/tracking/workout-session/workout-session.module';
import { ExerciseModule } from './modules/routines/templates/exercise/exercise.module';
import { WeekLogModule } from './modules/routines/tracking/week-log/week-log.module';
import { ExtraSessionModule } from './modules/routines/tracking/extra-session/extra-session.module';
import { GoogleModule } from './modules/auth/google/google.module';
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
    RoutineDayModule,
    WorkoutSessionModule,
    ExerciseModule,
    WeekLogModule,
    ExtraSessionModule,
    GoogleModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
