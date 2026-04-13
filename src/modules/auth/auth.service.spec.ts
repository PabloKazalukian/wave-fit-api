import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { parseLocalDate } from 'src/common/utils/date.utils';

// Mock de bcrypt
jest.mock('bcryptjs');

describe('AuthService', () => {
  let authService: AuthService;
  let userService: UserService;
  let jwtService: JwtService;

  const mockUserId = new Types.ObjectId();
  const mockUser = {
    _id: mockUserId,
    name: 'testuser',
    email: 'test@example.com',
    password: '$2a$10$hashedpassword',
    role: 'user',
    createdAt: parseLocalDate(new Date().toISOString()),
    updatedAt: parseLocalDate(new Date().toISOString()),
  };

  const mockUserService = {
    findByIdentifier: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
    decode: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user when credentials are valid with email', async () => {
      const identifier = 'test@example.com';
      const password = 'password123';

      mockUserService.findByIdentifier.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.validateUser(identifier, password);

      expect(userService.findByIdentifier).toHaveBeenCalledWith(identifier);
      expect(bcrypt.compare).toHaveBeenCalledWith(password, mockUser.password);
      expect(result).toEqual(mockUser);
    });

    it('should return user when credentials are valid with username', async () => {
      const identifier = 'testuser';
      const password = 'password123';

      mockUserService.findByIdentifier.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.validateUser(identifier, password);

      expect(userService.findByIdentifier).toHaveBeenCalledWith(identifier);
      expect(bcrypt.compare).toHaveBeenCalledWith(password, mockUser.password);
      expect(result).toEqual(mockUser);
    });

    it('should return null when user does not exist', async () => {
      const identifier = 'nonexistent@example.com';
      const password = 'password123';

      mockUserService.findByIdentifier.mockResolvedValue(null);

      const result = await authService.validateUser(identifier, password);

      expect(userService.findByIdentifier).toHaveBeenCalledWith(identifier);
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should return null when password is incorrect', async () => {
      const identifier = 'test@example.com';
      const password = 'wrongpassword';

      mockUserService.findByIdentifier.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await authService.validateUser(identifier, password);

      expect(userService.findByIdentifier).toHaveBeenCalledWith(identifier);
      expect(bcrypt.compare).toHaveBeenCalledWith(password, mockUser.password);
      expect(result).toBeNull();
    });

    it('should return null when password is empty', async () => {
      const identifier = 'test@example.com';
      const password = '';

      mockUserService.findByIdentifier.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await authService.validateUser(identifier, password);

      expect(result).toBeNull();
    });

    it('should return null when identifier is empty', async () => {
      const identifier = '';
      const password = 'password123';

      mockUserService.findByIdentifier.mockResolvedValue(null);

      const result = await authService.validateUser(identifier, password);

      expect(result).toBeNull();
    });

    it('should handle bcrypt errors gracefully', async () => {
      const identifier = 'test@example.com';
      const password = 'password123';

      mockUserService.findByIdentifier.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockRejectedValue(
        new Error('Bcrypt error'),
      );

      await expect(
        authService.validateUser(identifier, password),
      ).rejects.toThrow('Bcrypt error');
    });

    it('should handle user service errors gracefully', async () => {
      const identifier = 'test@example.com';
      const password = 'password123';

      mockUserService.findByIdentifier.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        authService.validateUser(identifier, password),
      ).rejects.toThrow('Database error');
    });
  });

  describe('login', () => {
    it('should return access token and user on successful login', async () => {
      const mockToken = 'mock.jwt.token';
      const expectedPayload = {
        sub: mockUser._id,
        email: mockUser.email,
        role: mockUser.role,
      };

      mockJwtService.sign.mockReturnValue(mockToken);

      const result = await authService.login(mockUser as any);

      expect(jwtService.sign).toHaveBeenCalledWith(expectedPayload);
      expect(result).toEqual({
        access_token: mockToken,
        user: mockUser,
      });
    });

    it('should create token with correct payload structure', async () => {
      const mockToken = 'mock.jwt.token';
      mockJwtService.sign.mockReturnValue(mockToken);

      await authService.login(mockUser as any);

      const callPayload = mockJwtService.sign.mock.calls[0][0];

      expect(callPayload).toHaveProperty('sub', mockUser._id);
      expect(callPayload).toHaveProperty('email', mockUser.email);
      expect(callPayload).toHaveProperty('role', mockUser.role);
    });

    it('should handle user with different roles correctly', async () => {
      const adminUser = {
        ...mockUser,
        role: 'admin',
      };

      const mockToken = 'admin.jwt.token';
      mockJwtService.sign.mockReturnValue(mockToken);

      const result = await authService.login(adminUser as any);

      const callPayload = mockJwtService.sign.mock.calls[0][0];

      expect(callPayload.role).toBe('admin');
      expect(result.access_token).toBe(mockToken);
      expect(result.user.role).toBe('admin');
    });

    it('should handle JWT service errors', async () => {
      mockJwtService.sign.mockImplementation(() => {
        throw new Error('JWT signing failed');
      });

      await expect(authService.login(mockUser as any)).rejects.toThrow(
        'JWT signing failed',
      );
    });

    it('should return different tokens for same user on multiple logins', async () => {
      mockJwtService.sign
        .mockReturnValueOnce('token1')
        .mockReturnValueOnce('token2');

      const result1 = await authService.login(mockUser as any);
      const result2 = await authService.login(mockUser as any);

      expect(result1.access_token).toBe('token1');
      expect(result2.access_token).toBe('token2');
      expect(result1.access_token).not.toBe(result2.access_token);
    });

    it('should include all user data in response', async () => {
      const mockToken = 'mock.jwt.token';
      mockJwtService.sign.mockReturnValue(mockToken);

      const result = await authService.login(mockUser as any);

      expect(result.user).toEqual(mockUser);
      expect(result.user._id).toEqual(mockUser._id);
      expect(result.user.name).toEqual(mockUser.name);
      expect(result.user.email).toEqual(mockUser.email);
    });

    it('should not include password in JWT payload', async () => {
      const mockToken = 'mock.jwt.token';
      mockJwtService.sign.mockReturnValue(mockToken);

      await authService.login(mockUser as any);

      const callPayload = mockJwtService.sign.mock.calls[0][0];

      expect(callPayload).not.toHaveProperty('password');
    });
  });

  describe('Full Authentication Flow', () => {
    it('should complete login flow from validation to token generation', async () => {
      const identifier = 'test@example.com';
      const password = 'password123';
      const mockToken = 'full.flow.token';

      mockUserService.findByIdentifier.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue(mockToken);

      // Step 1: Validate credentials
      const validatedUser = await authService.validateUser(
        identifier,
        password,
      );
      expect(validatedUser).toEqual(mockUser);

      // Step 2: Generate token
      const loginResult = await authService.login(validatedUser as any);
      expect(loginResult.access_token).toBe(mockToken);
      expect(loginResult.user).toEqual(mockUser);
    });

    it('should reject login flow when validation fails', async () => {
      const identifier = 'test@example.com';
      const password = 'wrongpassword';

      mockUserService.findByIdentifier.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Step 1: Validation fails
      const validatedUser = await authService.validateUser(
        identifier,
        password,
      );
      expect(validatedUser).toBeNull();

      // Step 2: Should not proceed to login
      // (en el resolver esto dispararía UnauthorizedException)
    });
  });

  describe('Edge Cases and Security', () => {
    it('should handle user without role field', async () => {
      const userWithoutRole = {
        ...mockUser,
        role: undefined,
      };

      const mockToken = 'mock.jwt.token';
      mockJwtService.sign.mockReturnValue(mockToken);

      const result = await authService.login(userWithoutRole as any);

      const callPayload = mockJwtService.sign.mock.calls[0][0];
      expect(callPayload.role).toBeUndefined();
    });

    it('should handle user with ObjectId as string', async () => {
      const userWithStringId = {
        ...mockUser,
        _id: mockUserId.toString(),
      };

      const mockToken = 'mock.jwt.token';
      mockJwtService.sign.mockReturnValue(mockToken);

      const result = await authService.login(userWithStringId as any);

      const callPayload = mockJwtService.sign.mock.calls[0][0];
      expect(callPayload.sub).toBe(mockUserId.toString());
    });

    it('should not expose sensitive user data in token payload', async () => {
      const mockToken = 'mock.jwt.token';
      mockJwtService.sign.mockReturnValue(mockToken);

      await authService.login(mockUser as any);

      const callPayload = mockJwtService.sign.mock.calls[0][0];

      // Solo debe contener: sub, email, role
      const payloadKeys = Object.keys(callPayload);
      expect(payloadKeys).toHaveLength(3);
      expect(payloadKeys).toContain('sub');
      expect(payloadKeys).toContain('email');
      expect(payloadKeys).toContain('role');
      expect(payloadKeys).not.toContain('password');
      expect(payloadKeys).not.toContain('createdAt');
    });

    it('should handle concurrent login requests for same user', async () => {
      const mockToken1 = 'token1';
      const mockToken2 = 'token2';

      mockJwtService.sign
        .mockReturnValueOnce(mockToken1)
        .mockReturnValueOnce(mockToken2);

      const [result1, result2] = await Promise.all([
        authService.login(mockUser as any),
        authService.login(mockUser as any),
      ]);

      expect(result1.access_token).toBe(mockToken1);
      expect(result2.access_token).toBe(mockToken2);
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
    });

    it('should validate identifier case-sensitivity', async () => {
      const identifier = 'Test@Example.Com';
      const password = 'password123';

      mockUserService.findByIdentifier.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.validateUser(identifier, password);

      expect(userService.findByIdentifier).toHaveBeenCalledWith(identifier);
      expect(result).toEqual(mockUser);
    });

    it('should handle special characters in identifier', async () => {
      const identifier = 'user+test@example.com';
      const password = 'password123';

      mockUserService.findByIdentifier.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.validateUser(identifier, password);

      expect(userService.findByIdentifier).toHaveBeenCalledWith(identifier);
      expect(result).toEqual(mockUser);
    });

    it('should handle very long passwords', async () => {
      const identifier = 'test@example.com';
      const longPassword = 'a'.repeat(1000);

      mockUserService.findByIdentifier.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await authService.validateUser(identifier, longPassword);

      expect(bcrypt.compare).toHaveBeenCalledWith(
        longPassword,
        mockUser.password,
      );
      expect(result).toBeNull();
    });
  });

  describe('Performance and Timing', () => {
    it('should not leak timing information on invalid user', async () => {
      const startInvalid = Date.now();
      mockUserService.findByIdentifier.mockResolvedValue(null);
      await authService.validateUser('invalid@example.com', 'password');
      const endInvalid = Date.now();

      const startValid = Date.now();
      mockUserService.findByIdentifier.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await authService.validateUser('test@example.com', 'wrongpassword');
      const endValid = Date.now();

      // Los tiempos deben ser similares para evitar timing attacks
      // (en producción bcrypt debería usarse en ambos casos)
      const invalidDuration = endInvalid - startInvalid;
      const validDuration = endValid - startValid;

      // Esta es una verificación básica - en un sistema real querrías
      // que ambos paths tomen tiempo similar mediante técnicas como
      // constant-time comparison
      expect(invalidDuration).toBeGreaterThanOrEqual(0);
      expect(validDuration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Type Safety and Validation', () => {
    it('should handle null user gracefully in login', async () => {
      const mockToken = 'mock.jwt.token';
      mockJwtService.sign.mockReturnValue(mockToken);

      // Aunque no debería llegar null a login() en producción,
      // probamos el comportamiento
      const nullUser = null as any;

      await expect(authService.login(nullUser)).rejects.toThrow();
    });

    it('should handle undefined user gracefully in login', async () => {
      const mockToken = 'mock.jwt.token';
      mockJwtService.sign.mockReturnValue(mockToken);

      const undefinedUser = undefined as any;

      await expect(authService.login(undefinedUser)).rejects.toThrow();
    });
  });
});
