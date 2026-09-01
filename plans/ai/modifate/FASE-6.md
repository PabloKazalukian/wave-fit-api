# Fase 6 — Validación final y documentación

## Objetivo

Verificar que todo compila, pasa lint y tests, y actualizar la documentación canónica del módulo.

## Comandos de verificación

```bash
npm run build        # compilar TypeScript
npm run lint         # ESLint
npm run format       # Prettier
npm test             # tests unitarios
npm run test:e2e     # tests end-to-end
```

## Documentación

Actualizar `src/modules/training-plan/README.md`:

- Añadir la mutation `modifyPlan(id, comment)` a la sección `API GraphQL`.
- Explicar el contrato: sobrescribe el mismo documento, incrementa `version`, solo en planes
  no confirmados.
- Documentar el supuesto de contexto (actual vs snapshot) elegido.
- Añadir `plan-modifier/` a la sección `Arquitectura por archivo`.

> Según `AGENTS.md` §12: "Antes de modificar código de autenticación, tracking o IA, leer los
> documentos de referencia." La implementación toca `training-plan` (que usa IA), por lo que se
> deben revisar `documents/config/ai.md` antes de ejecutar esta feature.

## Criterio de término

- `build` OK, `lint` OK, `test` verde (incluidos los nuevos specs de `plan-modifier`).
- `modifyPlan` expuesto y funcionando en el schema GraphQL.
- README de `training-plan` actualizado.
