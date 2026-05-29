# Seed — Sistema de Autoseeding

## 1. Propósito

Población inicial automática de la base de datos al levantar la aplicación. Se ejecuta **una sola vez** cuando la colección de ejercicios está vacía.

---

## 2. Arquitectura

| Archivo | Rol |
|---------|-----|
| `src/database/seed-runner.ts` | `SeedService` — orquestador, implementa `OnApplicationBootstrap` |
| `src/database/seed.module.ts` | Módulo NestJS que importa modelos Mongoose y provee `SeedService` |
| `src/database/seeds/routines.seed.ts` | Datos semilla: ejercicios, días de rutina, plan PPL |

### Flujo

```
App bootstrap
  → SeedService.onApplicationBootstrap()
    → SeedService.run()
      1. ¿Exercise.countDocuments() === 0?
         Sí → inserta 28 ejercicios con normalizedName
         No  → salta (log: ⏭️ Ejercicios ya existentes)
               Verifica normalización pendiente (migración)
      2. ¿RoutineDay.countDocuments() === 0?
         Sí → construye y inserta 6 días (Push A, Pull A, Legs A, Push B, Pull B, Legs B)
         No  → salta
      3. ¿RoutinePlan.findOne(name: 'PPL 6 días...')?
         No  → crea el plan semanal PPL
         Sí  → salta
```

---

## 3. Datos Sembrados

### Ejercicios (28)

Organizados por categoría:

| Categoría | Ejercicios |
|-----------|------------|
| CHEST (4) | Press banca plano, Press banca inclinado, Aperturas mancuernas, Flexiones |
| SHOULDERS (3) | Press militar, Elevaciones laterales, Elevaciones frontales |
| TRICEPS (3) | Fondos paralelas, Extensión tríceps polea, Press francés |
| BACK (5) | Dominadas, Remo barra, Jalón pecho polea, Remo mancuerna, Pullover mancuerna |
| BICEPS (3) | Curl barra, Curl mancuernas alterno, Curl martillo |
| LEGS_FRONT (4) | Sentadilla, Prensa piernas, Extensión cuádriceps, Zancadas |
| LEGS_POSTERIOR (4) | Peso muerto rumano, Curl femoral tumbado, Hip thrust, Elevación talones |
| CORE (4) | Plancha, Crunch abdominal, Elevación piernas, Russian twist |

### Días de Rutina (6)

Push A → Pull A → Legs A → (descanso) → Push B → Pull B → Legs B

Cada día contiene referencias a los ejercicios del catálogo con su orden de ejecución.

### Plan Semanal

- **Nombre:** PPL 6 días — Principiante/Intermedio
- **Esquema:** Lunes Push A, Martes Pull A, Miércoles Legs A, Jueves descanso, Viernes Push B, Sábado Pull B, Domingo Legs B
- **Distribución semanal:** 6 días de entrenamiento, 1 descanso

---

## 4. Normalización de Nombres

Cada ejercicio se guarda con un campo `normalizedName` calculado mediante `normalizeString()`:

1. Minúsculas
2. Eliminación de acentos (NFD)
3. Eliminación de caracteres especiales
4. Tokenización y re-join

Esto permite búsquedas y comparaciones sin depender de tildes, mayúsculas o espaciado.

```typescript
// src/common/utils/string.utils.ts
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .join(' ');
}
```

---

## 5. Control de Nombres Similares (fastest-levenshtein)

### Algoritmo

La función `isSimilar()` en `src/common/utils/string.utils.ts` usa `fastest-levenshtein` para detectar nombres duplicados o sospechosamente parecidos:

```
string1, string2 → normalizeString() → detectar opuestos → Levenshtein distance ≤ 2
```

### Palabras Opuestas

Antes de aplicar Levenshtein, se verifica que los nombres no contengan términos opuestos (ej. "pull" vs "push", "inclinado" vs "declinado"). Si se detectan opuestos, se descarta la similitud para evitar falsos positivos.

### Alcance Actual

| Módulo | Uso | Estado |
|--------|-----|--------|
| Exercise (create) | Evita duplicados y nombres similares al crear | ✅ Implementado |
| Exercise (update) | Re-verifica si cambia el nombre | ✅ Implementado |
| RoutineDay (title) | Pendiente | ❌ No implementado |
| RoutinePlan (name) | Pendiente | ❌ No implementado |

### Pendiente

Extender `isSimilar()` a los campos `title` de `RoutineDay` y `name` de `RoutinePlan` siguiendo el mismo patrón de `ExerciseService`.

---

## 6. Cómo Agregar Nuevos Seeds

1. Agregar ejercicios al array `SEEDED_EXERCISES` en `routines.seed.ts`
2. Si se necesita un nuevo día de rutina, agregarlo en `buildRoutineDays()`
3. Si se necesita un nuevo plan, crear función similar a `buildRoutinePlan()`
4. En `seed-runner.ts` agregar la lógica de verificación e inserción
5. Agregar el modelo correspondiente al `imports` de `SeedModule`

> **Importante:** Toda inserción debe verificar existencia previa para evitar duplicados en rearranques.
