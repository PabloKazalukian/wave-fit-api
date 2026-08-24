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

// Login una vez antes de las VUs; devuelve la cookie "token=..."
export function setup() {
  const res = http.post(BASE_URL, JSON.stringify({
    query: `
      mutation Login($identifier: String!, $password: String!) {
        login(identifier: $identifier, password: $password)
      }
    `,
    variables: {
      identifier: __ENV.USER_EMAIL,
      password: __ENV.USER_PASSWORD,
    },
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'Login OK': (r) =>
      r.status === 200 && JSON.parse(r.body)?.data?.login === true,
  });

  const setCookie = res.headers['set-cookie'] || res.headers['Set-Cookie'] || '';
  const match = setCookie.match(/token=([^;]+)/);
  if (!match) {
    throw new Error(
      'No se recibió la cookie token. Definí USER_EMAIL y USER_PASSWORD con un usuario válido.',
    );
  }
  return `token=${match[1]}`;
}

export default function (tokenCookie) {
  const authHeaders = {
    'Content-Type': 'application/json',
    Cookie: tokenCookie,
  };

  // 1. Health check (público)
  const healthRes = http.post(BASE_URL, JSON.stringify({
    query: `query { __typename }`,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(healthRes, {
    'GraphQL está up': (r) => r.status === 200,
  });

  sleep(1);

  // 2. Query de ejercicios (protegida)
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
    headers: authHeaders,
  });

  check(exercisesRes, {
    'Exercises query OK': (r) => r.status === 200,
    'Tiene datos': (r) => JSON.parse(r.body).data.exercises.length > 0,
  });

  sleep(1);

  // 3. Query del routine plan seedeado (protegida)
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
    headers: authHeaders,
  });

  check(planRes, {
    'Plans query OK': (r) => r.status === 200,
    'Tiene plan PPL': (r) => JSON.parse(r.body).data.routinePlans.length > 0,
  });

  sleep(1);
}
