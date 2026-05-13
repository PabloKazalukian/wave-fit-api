import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppTestModule } from '../../../utils/app-test.module';
import {
  closeInMongodConnection,
  clearDatabase,
} from '../../../utils/db-handler';
import { UserService } from '../../../../src/modules/user/user.service';
import {
  createTestUser,
  getTestUserCredentials,
} from '../../../fixtures/user.fixture';
import { getCookieWithToken } from '../../helpers/week-log.helper';
import cookieParser from 'cookie-parser';

describe('ExtraSession Catalog (e2e)', () => {
  let app: INestApplication<App>;
  let userService: UserService;
  let authCookie: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppTestModule],
    }).compile();

    app = module.createNestApplication();
    userService = module.get<UserService>(UserService);

    app.use(cookieParser());
    await app.init();
  });

  beforeEach(async () => {
    await clearDatabase();
    await createTestUser(userService);

    const loginResponse = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
            mutation {
                login(identifier: "${getTestUserCredentials().identifier}", password: "${getTestUserCredentials().password}")
            }
        `,
      });
    authCookie = getCookieWithToken(loginResponse);
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await closeInMongodConnection();
    await app.close();
  });

  it('should return all extra session disciplines', async () => {
    const catalogResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          query {
            extraSessionCatalog {
              key
              label
              category
              met
            }
          }
        `,
      });

    if (catalogResponse.body.errors) {
      console.log(
        'GraphQL Errors:',
        JSON.stringify(catalogResponse.body.errors, null, 2),
      );
    }

    expect(catalogResponse.status).toBe(200);
    expect(catalogResponse.body.data.extraSessionCatalog).toHaveLength(13);

    const keys = catalogResponse.body.data.extraSessionCatalog.map(
      (d: any) => d.key,
    );
    expect(keys).toContain('running');
    expect(keys).toContain('cycling');
    expect(keys).toContain('stationary_bike');
    expect(keys).toContain('swimming');
    expect(keys).toContain('walking');
    expect(keys).toContain('weightlifting');
    expect(keys).toContain('crossfit');
    expect(keys).toContain('football');
    expect(keys).toContain('basketball');
    expect(keys).toContain('tennis');
    expect(keys).toContain('yoga');
    expect(keys).toContain('pilates');
    expect(keys).toContain('mobility');
  });

  it('should return correct categories', async () => {
    const catalogResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          query {
            extraSessionCatalog {
              key
              category
            }
          }
        `,
      });

    expect(catalogResponse.status).toBe(200);

    const disciplines = catalogResponse.body.data.extraSessionCatalog;

    const cardioDisciplines = disciplines.filter(
      (d: any) => d.category === 'CARDIO',
    );
    expect(cardioDisciplines).toHaveLength(5);
    expect(cardioDisciplines.map((d: any) => d.key)).toEqual([
      'running',
      'cycling',
      'stationary_bike',
      'swimming',
      'walking',
    ]);

    const strengthDisciplines = disciplines.filter(
      (d: any) => d.category === 'STRENGTH',
    );
    expect(strengthDisciplines).toHaveLength(2);

    const sportDisciplines = disciplines.filter(
      (d: any) => d.category === 'SPORT',
    );
    expect(sportDisciplines).toHaveLength(3);

    const mindBodyDisciplines = disciplines.filter(
      (d: any) => d.category === 'MIND_BODY',
    );
    expect(mindBodyDisciplines).toHaveLength(3);
  });

  it('should return correct MET values', async () => {
    const catalogResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          query {
            extraSessionCatalog {
              key
              met
            }
          }
        `,
      });

    expect(catalogResponse.status).toBe(200);

    const disciplines = catalogResponse.body.data.extraSessionCatalog;
    const running = disciplines.find((d: any) => d.key === 'running');
    expect(running.met).toBe(8);

    const yoga = disciplines.find((d: any) => d.key === 'yoga');
    expect(yoga.met).toBe(3);

    const crossfit = disciplines.find((d: any) => d.key === 'crossfit');
    expect(crossfit.met).toBe(9);
  });

  it('should return labels in spanish', async () => {
    const catalogResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          query {
            extraSessionCatalog {
              key
              label
            }
          }
        `,
      });

    expect(catalogResponse.status).toBe(200);

    const disciplines = catalogResponse.body.data.extraSessionCatalog;

    const cycling = disciplines.find((d: any) => d.key === 'cycling');
    expect(cycling.label).toBe('Ciclismo');

    const walking = disciplines.find((d: any) => d.key === 'walking');
    expect(walking.label).toBe('Caminata');

    const pilates = disciplines.find((d: any) => d.key === 'pilates');
    expect(pilates.label).toBe('Pilates');
  });
});
