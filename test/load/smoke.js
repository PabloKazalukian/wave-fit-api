// tests/load/smoke.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,              // 1 usuario virtual
  duration: '30s',     // por 30 segundos
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% de requests < 500ms
    http_req_failed: ['rate<0.01'],    // < 1% errores
  },
};

const BASE_URL = 'http://localhost:3000/graphql';

export default function () {
  // 1. Health check
  const healthRes = http.post(BASE_URL, JSON.stringify({
    query: `query { __typename }`,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  check(healthRes, {
    'GraphQL está up': (r) => r.status === 200,
  });

  sleep(1);

  // 2. Query de ejercicios (datos seedeados)
  const exercisesRes = http.post(BASE_URL, JSON.stringify({
    query: `
      query GetExercises {
        exercises {
          id
          name
          category
        }
      }
    `,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(exercisesRes, {
    'Exercises query OK': (r) => r.status === 200,
    'Tiene datos': (r) => JSON.parse(r.body).data.exercises.length > 0,
  });

  sleep(1);

  // 3. Query del routine plan seedeado
  const planRes = http.post(BASE_URL, JSON.stringify({
    query: `
      query GetPlans {
        routinePlans {
          id
          name
        }
      }
    `,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(planRes, {
    'Plans query OK': (r) => r.status === 200,
    'Tiene plan PPL': (r) => JSON.parse(r.body).data.routinePlans.length > 0,
  });

  sleep(1);
  
}