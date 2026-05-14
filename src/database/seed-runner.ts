import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  SEEDED_EXERCISES,
  buildRoutineDays,
  buildRoutinePlan,
} from './seeds/routines.seed';
import { Exercise } from 'src/modules/routines/templates/exercise/schema/exercise.schema';
import { RoutineDay } from 'src/modules/routines/templates/routine-day/schema/routine-day.schema';
import { RoutinePlan } from 'src/modules/routines/templates/routine-plan/schema/routine-plan.schema';
import { normalizeString } from 'src/common/utils/string.utils';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectModel(Exercise.name) private exerciseModel: Model<Exercise>,
    @InjectModel(RoutineDay.name) private routineDayModel: Model<RoutineDay>,
    @InjectModel(RoutinePlan.name) private routinePlanModel: Model<RoutinePlan>,
  ) {}

  // Se ejecuta automáticamente al arrancar la app
  async onApplicationBootstrap() {
    await this.run();
  }

  // async run() {
  //   const alreadySeeded = await this.exerciseModel.countDocuments({
  //     name: SEEDED_EXERCISES[0].name,
  //   });

  //   if (alreadySeeded > 0) {
  //     this.logger.log('⏭️  Seed ya ejecutado, omitiendo...');
  //     return;
  //   }

  //   this.logger.log('🌱 Ejecutando seed...');

  //   try {
  //     // 1️⃣ Exercises
  //     const savedExercises =
  //       await this.exerciseModel.insertMany(SEEDED_EXERCISES);
  //     this.logger.log(`✅ ${savedExercises.length} ejercicios insertados`);

  //     // 2️⃣ Routine Days (con referencias a exercises)
  //     const routineDaysData = buildRoutineDays(savedExercises);
  //     const savedDays = await this.routineDayModel.insertMany(routineDaysData);
  //     this.logger.log(`✅ ${savedDays.length} días de rutina insertados`);

  //     // 3️⃣ Routine Plan (con referencias a days)
  //     const routinePlanData = buildRoutinePlan(savedDays);
  //     await this.routinePlanModel.create(routinePlanData);
  //     this.logger.log(`✅ Rutina PPL creada`);

  //     this.logger.log('🎉 Seed completado exitosamente');
  //   } catch (error) {
  //     this.logger.error('❌ Error durante el seed:', error);
  //     throw error;
  //   }
  // }
  async run() {
    this.logger.log('🌱 Verificando seed...');

    try {
      // 1️⃣ Exercises
      const exerciseCount = await this.exerciseModel.countDocuments();
      if (exerciseCount === 0) {
        const exercisesToSave = SEEDED_EXERCISES.map((ex) => ({
          ...ex,
          normalizedName: normalizeString(ex.name),
        }));
        const savedExercises =
          await this.exerciseModel.insertMany(exercisesToSave);
        this.logger.log(`✅ ${savedExercises.length} ejercicios insertados`);
      } else {
        this.logger.log(
          `⏭️  Ejercicios ya existentes (${exerciseCount}), verificando normalización...`,
        );
        // Opcional: Asegurar que los existentes tengan normalizedName (migración rápida)
        const exercisesWithoutNormalized = await this.exerciseModel.find({
          normalizedName: { $exists: false },
        });

        if (exercisesWithoutNormalized.length > 0) {
          for (const ex of exercisesWithoutNormalized) {
            await this.exerciseModel.updateOne(
              { _id: ex._id },
              { $set: { normalizedName: normalizeString(ex.name) } },
            );
          }
          this.logger.log(
            `✅ ${exercisesWithoutNormalized.length} ejercicios normalizados`,
          );
        }
      }

      // 2️⃣ Routine Days
      const dayCount = await this.routineDayModel.countDocuments();
      if (dayCount === 0) {
        const savedExercises = await this.exerciseModel.find(); // traer los existentes
        const routineDaysData = buildRoutineDays(savedExercises);
        const savedDays =
          await this.routineDayModel.insertMany(routineDaysData);
        this.logger.log(`✅ ${savedDays.length} días de rutina insertados`);
      } else {
        this.logger.log(
          `⏭️  Routine days ya existentes (${dayCount}), omitiendo...`,
        );
      }

      // 3️⃣ Routine Plan
      const planCount = await this.routinePlanModel.findOne({
        name: 'PPL 6 días — Principiante/Intermedio',
      });
      if (!planCount) {
        const savedDays = await this.routineDayModel.find(); // traer los existentes
        const routinePlanData = buildRoutinePlan(savedDays);
        await this.routinePlanModel.create(routinePlanData);
        this.logger.log(`✅ Rutina PPL creada`);
      } else {
        this.logger.log(
          `⏭️  Routine plan ya existente (${planCount._id}), omitiendo...`,
        );
      }

      this.logger.log('🎉 Seed completado exitosamente');
    } catch (error) {
      this.logger.error('❌ Error durante el seed:', error);
      throw error;
    }
  }
}
