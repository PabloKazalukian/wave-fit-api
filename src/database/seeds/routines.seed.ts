import { Types } from 'mongoose';
import { ExerciseCategory } from 'src/modules/routines/templates/exercise/entities/exercise.entity';

// ─────────────────────────────────────────────
// 1. EXERCISES
// ─────────────────────────────────────────────

export const SEEDED_EXERCISES = [
  // PUSH - Chest
  {
    name: 'Press de banca plano',
    category: ExerciseCategory.CHEST,
    usesWeight: true,
    description: 'Ejercicio compuesto de empuje para pectoral mayor.',
  },
  {
    name: 'Press de banca inclinado',
    category: ExerciseCategory.CHEST,
    usesWeight: true,
    description: 'Variante inclinada para pectoral superior.',
  },
  {
    name: 'Aperturas con mancuernas',
    category: ExerciseCategory.CHEST,
    usesWeight: true,
    description: 'Aislamiento de pectoral con mancuernas.',
  },
  {
    name: 'Flexiones',
    category: ExerciseCategory.CHEST,
    usesWeight: false,
    description: 'Ejercicio de empuje con peso corporal.',
  },

  // PUSH - Shoulders
  {
    name: 'Press militar',
    category: ExerciseCategory.SHOULDERS,
    usesWeight: true,
    description: 'Ejercicio compuesto para deltoides.',
  },
  {
    name: 'Elevaciones laterales',
    category: ExerciseCategory.SHOULDERS,
    usesWeight: true,
    description: 'Aislamiento de deltoides lateral.',
  },
  {
    name: 'Elevaciones frontales',
    category: ExerciseCategory.SHOULDERS,
    usesWeight: true,
    description: 'Aislamiento de deltoides frontal.',
  },

  // PUSH - Triceps
  {
    name: 'Fondos en paralelas',
    category: ExerciseCategory.TRICEPS,
    usesWeight: false,
    description: 'Ejercicio compuesto para tríceps y pecho.',
  },
  {
    name: 'Extensión de tríceps en polea',
    category: ExerciseCategory.TRICEPS,
    usesWeight: true,
    description: 'Aislamiento de tríceps en polea alta.',
  },
  {
    name: 'Press francés',
    category: ExerciseCategory.TRICEPS,
    usesWeight: true,
    description: 'Extensión de tríceps con barra EZ.',
  },

  // PULL - Back
  {
    name: 'Dominadas',
    category: ExerciseCategory.BACK,
    usesWeight: false,
    description: 'Ejercicio compuesto de jalón con peso corporal.',
  },
  {
    name: 'Remo con barra',
    category: ExerciseCategory.BACK,
    usesWeight: true,
    description: 'Ejercicio compuesto de jalón horizontal.',
  },
  {
    name: 'Jalón al pecho en polea',
    category: ExerciseCategory.BACK,
    usesWeight: true,
    description: 'Jalón vertical en máquina de polea.',
  },
  {
    name: 'Remo con mancuerna',
    category: ExerciseCategory.BACK,
    usesWeight: true,
    description: 'Remo unilateral para dorsal.',
  },
  {
    name: 'Pullover con mancuerna',
    category: ExerciseCategory.BACK,
    usesWeight: true,
    description: 'Ejercicio de estiramiento para dorsal.',
  },

  // PULL - Biceps
  {
    name: 'Curl con barra',
    category: ExerciseCategory.BICEPS,
    usesWeight: true,
    description: 'Curl clásico para bíceps.',
  },
  {
    name: 'Curl con mancuernas alterno',
    category: ExerciseCategory.BICEPS,
    usesWeight: true,
    description: 'Curl alterno con mancuernas.',
  },
  {
    name: 'Curl martillo',
    category: ExerciseCategory.BICEPS,
    usesWeight: true,
    description: 'Curl con agarre neutro para braquial.',
  },

  // LEGS - Cuádriceps
  {
    name: 'Sentadilla',
    category: ExerciseCategory.LEGS_FRONT,
    usesWeight: true,
    description: 'Ejercicio compuesto rey para tren inferior.',
  },
  {
    name: 'Prensa de piernas',
    category: ExerciseCategory.LEGS_FRONT,
    usesWeight: true,
    description: 'Ejercicio de cuádriceps en máquina.',
  },
  {
    name: 'Extensión de cuádriceps',
    category: ExerciseCategory.LEGS_FRONT,
    usesWeight: true,
    description: 'Aislamiento de cuádriceps en máquina.',
  },
  {
    name: 'Zancadas',
    category: ExerciseCategory.LEGS,
    usesWeight: true,
    description: 'Ejercicio unilateral para tren inferior.',
  },

  // LEGS - Posterior
  {
    name: 'Peso muerto rumano',
    category: ExerciseCategory.LEGS_POSTERIOR,
    usesWeight: true,
    description: 'Ejercicio para isquiotibiales y glúteos.',
  },
  {
    name: 'Curl femoral tumbado',
    category: ExerciseCategory.LEGS_POSTERIOR,
    usesWeight: true,
    description: 'Aislamiento de isquiotibiales en máquina.',
  },
  {
    name: 'Hip thrust',
    category: ExerciseCategory.LEGS_POSTERIOR,
    usesWeight: true,
    description: 'Ejercicio principal para glúteos.',
  },
  {
    name: 'Elevación de talones de pie',
    category: ExerciseCategory.LEGS,
    usesWeight: true,
    description: 'Ejercicio para gemelos.',
  },

  // CORE
  {
    name: 'Plancha',
    category: ExerciseCategory.CORE,
    usesWeight: false,
    description: 'Ejercicio isométrico para core.',
  },
  {
    name: 'Crunch abdominal',
    category: ExerciseCategory.CORE,
    usesWeight: false,
    description: 'Aislamiento de recto abdominal.',
  },
  {
    name: 'Elevación de piernas',
    category: ExerciseCategory.CORE,
    usesWeight: false,
    description: 'Ejercicio para core bajo.',
  },
  {
    name: 'Russian twist',
    category: ExerciseCategory.CORE,
    usesWeight: false,
    description: 'Ejercicio rotacional para oblicuos.',
  },
];

// ─────────────────────────────────────────────
// 2. ROUTINE DAYS (PPL x2 + descanso)
//    Lunes: Push A | Martes: Pull A | Miércoles: Legs A
//    Jueves: Descanso | Viernes: Push B | Sábado: Pull B | Domingo: Legs B
// ─────────────────────────────────────────────

// Helpers para buscar ejercicios por nombre
const findId = (saved: any[], name: string): Types.ObjectId =>
  saved.find((e) => e.name === name)?._id;

export function buildRoutineDays(savedExercises: any[]) {
  const f = (name: string) => findId(savedExercises, name);

  return [
    // ── DÍA 1: Push A ──────────────────────────
    {
      title: 'Push A',
      type: [
        ExerciseCategory.CHEST,
        ExerciseCategory.SHOULDERS,
        ExerciseCategory.TRICEPS,
      ],
      exercises: [
        { exercise: f('Press de banca plano'), order: 1 },
        { exercise: f('Press militar'), order: 2 },
        { exercise: f('Aperturas con mancuernas'), order: 3 },
        { exercise: f('Elevaciones laterales'), order: 4 },
        { exercise: f('Extensión de tríceps en polea'), order: 5 },
      ],
    },

    // ── DÍA 2: Pull A ──────────────────────────
    {
      title: 'Pull A',
      type: [ExerciseCategory.BACK, ExerciseCategory.BICEPS],
      exercises: [
        { exercise: f('Dominadas'), order: 1 },
        { exercise: f('Remo con barra'), order: 2 },
        { exercise: f('Jalón al pecho en polea'), order: 3 },
        { exercise: f('Curl con barra'), order: 4 },
        { exercise: f('Curl martillo'), order: 5 },
      ],
    },

    // ── DÍA 3: Legs A ──────────────────────────
    {
      title: 'Legs A',
      type: [
        ExerciseCategory.LEGS_FRONT,
        ExerciseCategory.LEGS_POSTERIOR,
        ExerciseCategory.CORE,
      ],
      exercises: [
        { exercise: f('Sentadilla'), order: 1 },
        { exercise: f('Peso muerto rumano'), order: 2 },
        { exercise: f('Prensa de piernas'), order: 3 },
        { exercise: f('Curl femoral tumbado'), order: 4 },
        { exercise: f('Plancha'), order: 5 },
      ],
    },

    // ── DÍA 4: Push B ──────────────────────────
    {
      title: 'Push B',
      type: [
        ExerciseCategory.CHEST,
        ExerciseCategory.SHOULDERS,
        ExerciseCategory.TRICEPS,
      ],
      exercises: [
        { exercise: f('Press de banca inclinado'), order: 1 },
        { exercise: f('Press de banca plano'), order: 2 },
        { exercise: f('Elevaciones frontales'), order: 3 },
        { exercise: f('Elevaciones laterales'), order: 4 },
        { exercise: f('Press francés'), order: 5 },
        { exercise: f('Fondos en paralelas'), order: 6 },
      ],
    },

    // ── DÍA 5: Pull B ──────────────────────────
    {
      title: 'Pull B',
      type: [ExerciseCategory.BACK, ExerciseCategory.BICEPS],
      exercises: [
        { exercise: f('Remo con mancuerna'), order: 1 },
        { exercise: f('Jalón al pecho en polea'), order: 2 },
        { exercise: f('Pullover con mancuerna'), order: 3 },
        { exercise: f('Curl con mancuernas alterno'), order: 4 },
        { exercise: f('Curl martillo'), order: 5 },
      ],
    },

    // ── DÍA 6: Legs B ──────────────────────────
    {
      title: 'Legs B',
      type: [
        ExerciseCategory.LEGS_FRONT,
        ExerciseCategory.LEGS_POSTERIOR,
        ExerciseCategory.LEGS,
        ExerciseCategory.CORE,
      ],
      exercises: [
        { exercise: f('Zancadas'), order: 1 },
        { exercise: f('Hip thrust'), order: 2 },
        { exercise: f('Extensión de cuádriceps'), order: 3 },
        { exercise: f('Elevación de talones de pie'), order: 4 },
        { exercise: f('Elevación de piernas'), order: 5 },
        { exercise: f('Russian twist'), order: 6 },
      ],
    },
  ];
}

export function buildRoutinePlan(savedDays: any[]) {
  const findDay = (title: string) => {
    const day = savedDays.find((d) => d.title === title);
    // Extraer _id ya sea de doc Mongoose o de objeto plano
    return day?._id ?? undefined;
  };

  return {
    name: 'PPL 6 días — Principiante/Intermedio',
    description:
      'Push Pull Legs con doble frecuencia semanal. Alterna entre variantes A y B para máxima progresión.',
    weekly_distribution: '6',
    week: [
      { day: findDay('Push A'), isRest: false, order: 1 },
      { day: findDay('Pull A'), isRest: false, order: 2 },
      { day: findDay('Legs A'), isRest: false, order: 3 },
      { day: undefined, isRest: true, order: 4 },
      { day: findDay('Push B'), isRest: false, order: 5 },
      { day: findDay('Pull B'), isRest: false, order: 6 },
      { day: findDay('Legs B'), isRest: false, order: 7 },
    ],
  };
}
