// tests/load/auth-smoke.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { FIND_ACTIVE_WEEK_LOG, FIND_ALL_TRACKING_BY_USER } from '../apollo/week-log.queries.js';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = 'http://localhost:3000/graphql';

// Usuario de prueba (asegurate de tenerlo seedeado o crearlo antes)
const TEST_USER = {
  identifier: 'asd@123.com',
  password: 'asd123'
};

export default function () {
  // 1. Login
  const loginRes = http.post(BASE_URL, JSON.stringify({
    query: `
      mutation Login($identifier: String!, $password: String!) {
        login(identifier: $identifier, password: $password)
      }
    `,
    variables: TEST_USER
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const loginCheck = check(loginRes, {
    'Login successful': (r) => r.status === 200,
    'Token recibido': (r) => {
      const body = JSON.parse(r.body);
      console.log(body)
      return body.data?.login !== undefined;
    },
  });

  if (!loginCheck) {
    console.error('Login falló:', loginRes.body);
    return; // Skip resto si login falla
  }

  const token = JSON.parse(loginRes.body).data.login;
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  sleep(1);

  // 2. Query mis workout sessions
  const sessionsRes = http.post(BASE_URL, JSON.stringify({
    query: FIND_ALL_TRACKING_BY_USER,
  }), { headers: authHeaders });

  check(sessionsRes, {
    'Find all tracking by user query OK': (r) => r.status === 200,
    'Data estructura correcta: findAll': (r) => {
      const body = JSON.parse(r.body);
      return Array.isArray(body.data?.findAll);
    },
  });

  sleep(1);

  // 3. Query mi routine plan actual
  const planRes = http.post(BASE_URL, JSON.stringify({
    query: FIND_ACTIVE_WEEK_LOG,
  }), { headers: authHeaders });

  check(planRes, {
    'Active Week-Log query OK': (r) => r.status === 200,
    'Tiene plan activo': (r) => {
      const body = JSON.parse(r.body);
      return body.data?.myActiveRoutinePlan !== null;
    },
  });

  sleep(1);

//   // 4. Crear una workout session
//   const createSessionRes = http.post(BASE_URL, JSON.stringify({
//     query: `
//       mutation CreateSession($input: CreateWorkoutSessionInput!) {
//         createWorkoutSession(input: $input) {
//           id
//           date
//           exercises {
//             exercise {
//               name
//             }
//             sets {
//               reps
//               weight
//             }
//           }
//         }
//       }
//     `,
//     variables: {
//       input: {
//         date: new Date().toISOString(),
//         routineDayId: '507f1f77bcf86cd799439011', // ID de ejemplo, ajustá según tus seeds
//         exercises: [
//           {
//             exerciseId: '507f1f77bcf86cd799439012',
//             sets: [
//               { reps: 10, weight: 50 },
//               { reps: 10, weight: 50 },
//               { reps: 8, weight: 55 }
//             ]
//           }
//         ]
//       }
//     }
//   }), { headers: authHeaders });

//   check(createSessionRes, {
//     'Create session OK': (r) => r.status === 200,
//     'Session creada': (r) => {
//       const body = JSON.parse(r.body);
//       return body.data?.createWorkoutSession?.id !== undefined;
//     },
//   });

  sleep(1);
}