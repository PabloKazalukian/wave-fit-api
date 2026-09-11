import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';

export const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

export function createDayLog(
  app: INestApplication<App>,
  cookie: string,
  options: {
    date?: string;
    timezone?: string;
    planId?: string;
    routineDayId?: string;
    notes?: string;
  } = {},
) {
  const date = options.date || todayLocalDate();

  const fields = `
    date: "${date}",
    timezone: "${options.timezone || DEFAULT_TIMEZONE}"
    ${options.planId ? `, planId: "${options.planId}"` : ''}
    ${options.routineDayId ? `, routineDayId: "${options.routineDayId}"` : ''}
    ${options.notes ? `, notes: "${options.notes}"` : ''}
  `;

  return request(app.getHttpServer())
    .post('/graphql')
    .set('Cookie', [cookie || ''])
    .send({
      query: `
        mutation {
          createDayLog(createDayLogInput: { ${fields} }) {
            id
            userId
            date
            planId
            routineDayId
            workoutSessionId
            exercises {
              exerciseId
              series
              sets {
                reps
                weights
              }
            }
            extraSessionIds
            status
            active
            completed
            notes
          }
        }
      `,
    });
}

export function getActiveDayLog(app: INestApplication<App>, cookie: string) {
  return request(app.getHttpServer())
    .post('/graphql')
    .set('Cookie', [cookie || ''])
    .send({
      query: `
        query findActiveDayLog {
          activeDayLog {
            hasActiveDay
            day {
              id
              userId
              date
              planId
              routineDayId
              workoutSessionId
              extraSessionIds
              status
              active
              completed
              notes
            }
          }
        }
      `,
    });
}

export function getActiveTracking(app: INestApplication<App>, cookie: string) {
  return request(app.getHttpServer())
    .post('/graphql')
    .set('Cookie', [cookie || ''])
    .send({
      query: `
        query activeTracking {
          activeTracking {
            hasActive
            type
            week { id }
            day { id }
          }
        }
      `,
    });
}

export function todayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
