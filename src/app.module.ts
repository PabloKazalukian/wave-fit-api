import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLExceptionFilter } from './common/filters/gql-exception.filter';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { RoutinePlanModule } from './modules/routines/templates/routine-plan/routine-plan.module';
import { RoutineDayModule } from './modules/routines/templates/routine-day/routine-day.module';
import { WorkoutSessionModule } from './modules/routines/tracking/workout-session/workout-session.module';
import { ExerciseModule } from './modules/routines/templates/exercise/exercise.module';
import { WeekLogModule } from './modules/routines/tracking/week-log/week-log.module';
import { ExtraSessionModule } from './modules/routines/tracking/extra-session/extra-session.module';
import { GoogleModule } from './modules/auth/google/google.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { SeedModule } from './database/seed.module';
import { CommonResolver } from './common/common.resolver';
import { DayLogModule } from './modules/routines/tracking/day-log/day-log.module';
import { StatsModule } from './modules/stats/stats.module';
import { StorageModule } from './modules/storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRoot(
      `mongodb+srv://kazalukianpablo_db_user:${process.env.DB_MONGO_PASSWORD}@wavefit.ofapyei.mongodb.net/ `,
    ),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      context: ({ req, res }) => ({ req, res }),
      // autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      playground: true,
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
    SeedModule,
    DayLogModule,
    StatsModule,
    StorageModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    CommonResolver,
    {
      provide: APP_FILTER,
      useClass: GraphQLExceptionFilter,
    },
  ],
})
export class AppModule {}
