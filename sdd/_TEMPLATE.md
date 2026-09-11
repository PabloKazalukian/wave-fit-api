---
title: <Nombre corto de la feature>
description: <Una o dos líneas. Qué hace y para qué sirve>
status: draft # draft | in_progress | done
priority: <alta | media | baja>
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
depends_on: <spec del backlog de la que depende, si aplica>
---

# <Title>

## Context

<Por qué existe esta spec. Qué hay hoy y qué falta. Vincular a documentos/plan existente si lo hay.>

## Requirements

### MUST

1. <Requisito obligatorio, verificable. Mencionar archivos y comportamiento esperado.>
2. ...

### SHOULD

1. ...

### MAY

1. ...

## ai_instructions

<Instrucciones directas para un agente IA que ejecute esta spec sin contexto previo.>
<Máximo 5-8 bullets. Lenguaje del repo (español). Sin ambigüedad.>

1. Leer `AGENTS.md` y `documents/config/testing.md` antes de tocar código.
2. Seguir el patrón hexagonal de referencia indicado en `tech_context` (no inventar otro).
3. Test-first por capa: escribir tests de la capa antes de la implementación de esa capa.
4. Todos los `MUST` deben tener al menos un test que los cubra.
5. Verificar con los comandos de `Tests to Run`. No dejar rojos de la suite existente.
6. No tocar archivos fuera del checklist sin justificarlo en el PR/commit.

## tech_context

<Rutas de archivos reales, patrones a imitar, utilidades existentes. Con `archivo:línea`.>

## References

- <Enlaces a código/documentos relevantes>

## Files to Change

<Checklist de archivos: [-] Nuevo / [+] Modificado. Uno por línea.>

- [-] `src/modules/<feature>/...`

## Unit Tests to Implement

<Descripción de cada suite de tests a crear/ampliar. Un bullet por suite.>

- `src/modules/<feature>/...spec.ts` — <qué cubre>

## Tests to Run

```bash
npx jest --config jest.config.js <ruta/s de la feature>
npm run build
npm run lint
npm test
npm run test:e2e
```

## Failure Analysis

<Runbook: qué hacer si un test de esta spec falla en CI o en producción. Casos conocidos y sus síntomas.>

| Síntoma | Causa probable | Acción |
| ------- | -------------- | ------ |
| <...>   | <...>          | <...>  |
