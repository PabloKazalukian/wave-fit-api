import { Injectable } from '@nestjs/common';
import { UserProfileService } from '../../user/user-profile';

export interface PlanValidationResult {
  valid: boolean;
  missing: string[];
  recommended: string[];
}

@Injectable()
export class PlanValidatorService {
  constructor(
    private readonly userProfileService: UserProfileService,
  ) {}

  async validate(userId: string): Promise<PlanValidationResult> {
    const ctx = await this.userProfileService.getFullProfileContext(userId);
    const missing: string[] = [];
    const recommended: string[] = [];

    // ── Indispensables ──

    if (!ctx.profile) {
      missing.push('UserProfile: No existe perfil de usuario');
    } else {
      if (!ctx.profile.birthDate)
        missing.push(
          'UserProfile.birthDate: Fecha de nacimiento no especificada',
        );
      if (!ctx.profile.heightCm)
        missing.push('UserProfile.heightCm: Altura no especificada');
      if (!ctx.profile.weightKg)
        missing.push('UserProfile.weightKg: Peso no especificado');
    }

    if (!ctx.goal) {
      missing.push('UserGoal: No hay un objetivo activo');
    } else {
      if (!ctx.goal.primaryGoal)
        missing.push(
          'UserGoal.primaryGoal: Objetivo principal no especificado',
        );
      if (!ctx.goal.trainingExperience)
        missing.push(
          'UserGoal.trainingExperience: Nivel de experiencia no especificado',
        );
    }

    if (!ctx.schedule) {
      missing.push('UserSchedule: No hay configuración de horario');
    } else {
      const hasDaysPerWeek =
        ctx.schedule.daysPerWeek && ctx.schedule.daysPerWeek > 0;
      const hasPreferredDays =
        ctx.schedule.preferredDays && ctx.schedule.preferredDays.length > 0;
      if (!hasDaysPerWeek && !hasPreferredDays)
        missing.push(
          'UserSchedule: Días de entrenamiento por semana no especificados (daysPerWeek o preferredDays)',
        );
    }

    // ── Recomendados (no bloquean, pero mejoran la calidad del plan) ──

    if (!ctx.resources) {
      recommended.push(
        'UserResource: Equipamiento y entorno de entrenamiento (ayuda a personalizar ejercicios)',
      );
    } else {
      if (
        !ctx.resources.trainingEnvironments ||
        ctx.resources.trainingEnvironments.length === 0
      )
        recommended.push(
          'UserResource.trainingEnvironments: Entorno de entrenamiento no especificado',
        );
    }

    if (!ctx.trainingPreferences) {
      recommended.push(
        'UserTrainingPreference: Preferencias de entrenamiento (estilos, intensidad)',
      );
    } else {
      if (
        !ctx.trainingPreferences.preferredStyles ||
        ctx.trainingPreferences.preferredStyles.length === 0
      )
        recommended.push(
          'UserTrainingPreference.preferredStyles: Estilos de entrenamiento preferidos no especificados',
        );
    }

    if (!ctx.strengthMetrics || ctx.strengthMetrics.length === 0) {
      recommended.push(
        'UserStrengthMetric: Métricas de fuerza (1RM) — genera un plan más preciso',
      );
    }

    return {
      valid: missing.length === 0,
      missing,
      recommended,
    };
  }
}
