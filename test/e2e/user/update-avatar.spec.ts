import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { json } from 'express';
import cookieParser from 'cookie-parser';
import { AppTestModule } from '../../utils/app-test.module';
import {
  closeInMongodConnection,
  clearDatabase,
} from '../../utils/db-handler';
import { UserService } from '../../../src/modules/user/user.service';
import { StorageService } from '../../../src/modules/storage/storage.service';
import {
  createTestUser,
  getTestUserCredentials,
} from '../../fixtures/user.fixture';
import { getCookieWithToken } from '../helpers/week-log.helper';

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const UPDATE_AVATAR_MUTATION = `
  mutation UpdateAvatar($base64Image: String!) {
    updateAvatar(base64Image: $base64Image) {
      id
      email
      avatar {
        storageKey
        url
        source
      }
    }
  }
`;

const ME_QUERY = `
  query {
    me {
      id
      email
      avatar {
        storageKey
        url
        source
      }
    }
  }
`;

describe('updateAvatar (e2e)', () => {
  let app: INestApplication<App>;
  let userService: UserService;
  let authCookie: string;
  let userId: string;
  let uploadFileMock: jest.Mock;
  let deleteFileMock: jest.Mock;

  const gql = (query: string, variables?: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie || ''])
      .send({ query, variables });

  beforeAll(async () => {
    uploadFileMock = jest.fn();
    deleteFileMock = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      imports: [AppTestModule],
    })
      .overrideProvider(StorageService)
      .useValue({
        uploadFile: uploadFileMock,
        deleteFile: deleteFileMock,
      })
      .compile();

    app = module.createNestApplication();
    userService = module.get<UserService>(UserService);

    // Payload grande para el caso >5MB (el límite por defecto de express es menor)
    app.use(json({ limit: '12mb' }));
    app.use(cookieParser());
    await app.init();
  });

  beforeEach(async () => {
    await clearDatabase();
    await createTestUser(userService);
    uploadFileMock.mockReset();
    uploadFileMock.mockResolvedValue('https://mock-bucket/avatar.jpg');
    deleteFileMock.mockClear();

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

    const meResponse = await gql(ME_QUERY);
    userId = meResponse.body.data.me.id;
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await closeInMongodConnection();
    await app.close();
  });

  it('rechaza la mutación sin cookie de autenticación', async () => {
    authCookie = '';

    const response = await gql(UPDATE_AVATAR_MUTATION, {
      base64Image: TINY_PNG,
    });

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeDefined();
    expect(uploadFileMock).not.toHaveBeenCalled();
  });

  it('procesa, sube y persiste el avatar con key y content-type correctos', async () => {
    const response = await gql(UPDATE_AVATAR_MUTATION, {
      base64Image: TINY_PNG,
    });

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeUndefined();

    const avatar = response.body.data.updateAvatar.avatar;
    expect(avatar.storageKey).toBe(`avatars/${userId}/avatar.jpg`);
    expect(avatar.url).toBe('https://mock-bucket/avatar.jpg');
    expect(avatar.source).toBe('upload');

    // sharp re-encodea el buffer a JPEG, pero el contentType conserva el formato origen
    expect(uploadFileMock).toHaveBeenCalledTimes(1);
    const [key, buffer, contentType] = uploadFileMock.mock.calls[0];
    expect(key).toBe(`avatars/${userId}/avatar.jpg`);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(contentType).toBe('image/png');
  });

  it('persiste el avatar y es visible vía me', async () => {
    await gql(UPDATE_AVATAR_MUTATION, { base64Image: TINY_PNG });

    const meResponse = await gql(ME_QUERY);
    const avatar = meResponse.body.data.me.avatar;
    expect(avatar.storageKey).toBe(`avatars/${userId}/avatar.jpg`);
    expect(avatar.url).toBe('https://mock-bucket/avatar.jpg');
  });

  it('rechaza un formato que no es data URI de imagen', async () => {
    const response = await gql(UPDATE_AVATAR_MUTATION, {
      base64Image: 'data:text/plain;base64,SGVsbG8=',
    });

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeDefined();
    expect(response.body.errors[0].message).toContain(
      'Invalid image format',
    );
    expect(uploadFileMock).not.toHaveBeenCalled();
  });

  it('rechaza imágenes mayores a 5MB', async () => {
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1024).toString('base64');

    const response = await gql(UPDATE_AVATAR_MUTATION, {
      base64Image: `data:image/png;base64,${oversized}`,
    });

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeDefined();
    expect(response.body.errors[0].message).toContain(
      'Image too large',
    );
    expect(uploadFileMock).not.toHaveBeenCalled();
  });
});
