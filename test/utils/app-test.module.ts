import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { UserModule } from '../../src/modules/user/user.module';
import { AuthModule } from '../../src/modules/auth/auth.module';
import { RoutinePlanModule } from '../../src/modules/routines/templates/routine-plan/routine-plan.module';
import { RoutineDayModule } from '../../src/modules/routines/templates/routine-day/routine-day.module';
import { WorkoutSessionModule } from '../../src/modules/routines/tracking/workout-session/workout-session.module';
import { ExerciseModule } from '../../src/modules/routines/templates/exercise/exercise.module';
import { WeekLogModule } from '../../src/modules/routines/tracking/week-log/week-log.module';
import { ExtraSessionModule } from '../../src/modules/routines/tracking/extra-session/extra-session.module';
import { GoogleModule } from '../../src/modules/auth/google/google.module';
import { AuditLogsModule } from '../../src/modules/audit-logs/audit-logs.module';
import { rootMongooseTestModule } from './db-handler';
import { AppModule } from 'src/app.module';

/**
 * Módulo NestJS para tests e2e.
 * Reemplaza MongooseModule.forRoot (conexión real a Atlas) por
 * rootMongooseTestModule() que levanta un servidor MongoDB en memoria.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    rootMongooseTestModule(),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      context: ({ req, res }) => ({ req, res }),
      playground: false,
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
    AuditLogsModule,
  ],
})
export class AppTestModule {}
