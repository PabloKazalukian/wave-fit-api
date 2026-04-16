import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';

export function getCookieWithToken(loginResponse: any): string {
  const cookies = loginResponse.headers['set-cookie'] as
    | string
    | string[]
    | undefined;
  if (!cookies) return '';
  const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
  const tokenCookie = cookieArray.find((c: string) => c.startsWith('token='));
  return tokenCookie || '';
}

export function createWeekLog(app: INestApplication<App>, cookie: string) {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  return request(app.getHttpServer())
    .post('/graphql')
    .set('Cookie', [cookie || ''])
    .send({
      query: `
          mutation {
            createWeekLog(createWeekLogInput: {
              startDate: "${startOfWeek.toISOString().split('T')[0]}",
              endDate: "${endOfWeek.toISOString().split('T')[0]}",
              timezone: "America/Argentina/Buenos_Aires"
            }) {
              id
              startDate
              endDate
            }
          }
        `,
    })
    .expect(200);
}

export function getActiveWeekLog(app: INestApplication<App>, cookie: string) {
  return request(app.getHttpServer())
    .post('/graphql')
    .set('Cookie', [cookie || ''])
    .send({
      query: `
        query findActiveWeekLog {
          activeWeekLog {
            hasActiveWeek
            week {
                id
                startDate
                endDate
                userId
                days {
                  order
                  date
                  isRest
                  workoutSessionId
                  exercises {
                      exerciseId
                      series
                      sets {
                          weights
                          reps
                      }
                      notes
                  }
                  extraSessionIds
                  status
                }
                planId
                notes
                completed
            }
          }
      }
      `,
    });
}

export function getActiveWeekLogBasic(
  app: INestApplication<App>,
  cookie: string,
) {
  return request(app.getHttpServer())
    .post('/graphql')
    .set('Cookie', [cookie || ''])
    .send({
      query: `
        query findActiveWeekLog {
          activeWeekLog {
            hasActiveWeek
            week {
                id
                startDate
                endDate
                userId
                planId
                notes
                completed
            }
          }
      }
      `,
    });
}
