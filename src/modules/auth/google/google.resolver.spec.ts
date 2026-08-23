import { Test, TestingModule } from '@nestjs/testing';
import { GoogleResolver } from './google.resolver';
import { GoogleService } from './google.service';
import { UserService } from '../../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { StorageService } from '../../storage/storage.service';

describe('GoogleResolver', () => {
  let resolver: GoogleResolver;

  const googleServiceMock = {
    getTokens: jest.fn(),
    getUserInfo: jest.fn(),
  };

  const userServiceMock = {
    findByEmail: jest.fn(),
    createGoogleUser: jest.fn(),
  };

  const jwtServiceMock = {
    sign: jest.fn(),
  };

  const storageServiceMock = {
    uploadFile: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleResolver,
        {
          provide: GoogleService,
          useValue: googleServiceMock,
        },
        {
          provide: UserService,
          useValue: userServiceMock,
        },
        {
          provide: JwtService,
          useValue: jwtServiceMock,
        },
        {
          provide: StorageService,
          useValue: storageServiceMock,
        },
      ],
    }).compile();

    resolver = module.get<GoogleResolver>(GoogleResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
