import { Test, TestingModule } from '@nestjs/testing';
import { GoogleResolver } from './google.resolver';
import { GoogleService } from './google.service';
import { UserService } from '../../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { GoogleTokenStrategy } from './google-token.strategy';
import { StorageService } from '../../storage/storage.service';

describe('GoogleAuth Integration', () => {
  let resolver: GoogleResolver;
  let userService: UserService;
  let jwtService: JwtService;
  let googleService: GoogleService;
  let strategy: GoogleTokenStrategy;

  const mockUser = {
    _id: 'user123',
    email: 'test@gmail.com',
    name: 'Test User',
    role: 'user',
    googleId: 'google123',
  };

  const mockGoogleInfo = {
    email: 'test@gmail.com',
    name: 'Test User',
    picture: 'http://pic.com',
    googleId: 'google123',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleResolver,
        GoogleTokenStrategy,
        {
          provide: GoogleService,
          useValue: {
            getTokens: jest
              .fn()
              .mockResolvedValue({ id_token: 'mock_id_token' }),
            getUserInfo: jest.fn().mockResolvedValue(mockGoogleInfo),
            getAvatarGoogle: jest.fn().mockResolvedValue({
              buffer: Buffer.from('avatar'),
              contentType: 'image/png',
            }),
          },
        },
        {
          provide: UserService,
          useValue: {
            findByEmail: jest.fn(),
            createGoogleUser: jest.fn().mockResolvedValue(mockUser),
            updateAvatar: jest.fn().mockResolvedValue(mockUser),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock_jwt_token'),
          },
        },
        {
          provide: StorageService,
          useValue: {
            uploadFile: jest
              .fn()
              .mockResolvedValue('http://cdn.example.com/avatar.png'),
          },
        },
      ],
    }).compile();

    resolver = module.get<GoogleResolver>(GoogleResolver);
    userService = module.get<UserService>(UserService);
    jwtService = module.get<JwtService>(JwtService);
    googleService = module.get<GoogleService>(GoogleService);
    strategy = module.get<GoogleTokenStrategy>(GoogleTokenStrategy);
  });

  it('should login and set cookie, and return user object', async () => {
    jest.spyOn(userService, 'findByEmail').mockResolvedValue(null); // User doesn't exist, will be created
    const mockContext = { res: { cookie: jest.fn() } };

    const result = await resolver.loginWithGoogle(
      'code',
      'verifier',
      mockContext,
    );

    expect(result).toBeDefined();
    expect(mockContext.res.cookie).toHaveBeenCalledWith(
      'token',
      'mock_jwt_token',
      expect.any(Object),
    );
    expect(result.user).toBeDefined();
    expect(result.user._id).toBe('user123');
    expect(userService.createGoogleUser).toHaveBeenCalledWith(mockGoogleInfo);
  });

  it('should return existing user and set cookie', async () => {
    jest.spyOn(userService, 'findByEmail').mockResolvedValue(mockUser as any);
    const mockContext = { res: { cookie: jest.fn() } };

    const result = await resolver.loginWithGoogle(
      'code',
      'verifier',
      mockContext,
    );

    expect(result.user._id).toBe('user123');
    expect(mockContext.res.cookie).toHaveBeenCalled();
    expect(userService.createGoogleUser).not.toHaveBeenCalled();
  });

  it('should throw error if code or verifier is missing', async () => {
    await expect(
      resolver.loginWithGoogle(null as any, 'verifier', {} as any),
    ).rejects.toThrow('Code or Code Verifier is null');
  });

  describe('GoogleTokenStrategy', () => {
    it('should validate valid id_token and return user', async () => {
      jest.spyOn(userService, 'findByEmail').mockResolvedValue(mockUser as any);

      const req = {
        headers: {
          authorization: 'Bearer valid_google_token',
        },
      };

      const result = await strategy.validate(req);

      expect(result).toBeDefined();
      expect(result._id).toBe('user123');
      expect(googleService.getUserInfo).toHaveBeenCalledWith(
        'valid_google_token',
      );
    });

    it('should throw UnauthorizedException if no auth header', async () => {
      const req = { headers: {} };
      await expect(strategy.validate(req)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if invalid token format', async () => {
      const req = { headers: { authorization: 'Basic token' } };
      await expect(strategy.validate(req)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return null if googleService.getUserInfo fails', async () => {
      jest
        .spyOn(googleService, 'getUserInfo')
        .mockRejectedValue(new Error('Invalid token'));
      const req = { headers: { authorization: 'Bearer invalid' } };
      expect(await strategy.validate(req)).toBeNull();
    });
  });
});
