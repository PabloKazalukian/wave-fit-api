import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { UserService } from '../user/user.service';

describe('JwtStrategy', () => {
  const userServiceMock = {
    findOne: jest.fn(),
  };

  const buildStrategy = (jwtSecret?: string) => {
    const configServiceMock = {
      get: jest.fn().mockReturnValue(jwtSecret),
    };
    return new JwtStrategy(
      userServiceMock as unknown as UserService,
      configServiceMock as unknown as ConfigService,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(buildStrategy()).toBeDefined();
  });

  describe('extractor de cookie', () => {
    it('extrae el token desde la cookie "token"', () => {
      const extractor = (buildStrategy() as any)._jwtFromRequest;
      expect(extractor({ cookies: { token: 'jwt-123' } })).toBe('jwt-123');
    });

    it('retorna undefined si no hay cookies en el request', () => {
      const extractor = (buildStrategy() as any)._jwtFromRequest;
      expect(extractor(undefined)).toBeUndefined();
      expect(extractor({})).toBeUndefined();
    });
  });

  describe('secretOrKey', () => {
    const resolveSecret = (strategy: any, done = jest.fn()) => {
      strategy._secretOrKeyProvider({}, null, done);
      return done;
    };

    it('usa JWT_SECRET de configuración cuando existe', () => {
      const done = resolveSecret(buildStrategy('secret-config'));

      expect(done).toHaveBeenCalledWith(null, 'secret-config');
    });

    it('cae al fallback si JWT_SECRET no está configurado', () => {
      const done = resolveSecret(buildStrategy(undefined));

      expect(done).toHaveBeenCalledWith(null, 'supersecretkey');
    });
  });

  describe('validate', () => {
    it('retorna el usuario cuando existe', async () => {
      const strategy = buildStrategy('test-secret');
      const user = { id: 'user-1', name: 'pablo' };
      userServiceMock.findOne.mockResolvedValue(user);

      const result = await strategy.validate({ sub: 'user-1' });

      expect(userServiceMock.findOne).toHaveBeenCalledWith('user-1');
      expect(result).toBe(user);
    });

    it('lanza error si el usuario no existe', async () => {
      const strategy = buildStrategy('test-secret');
      userServiceMock.findOne.mockResolvedValue(null);

      await expect(strategy.validate({ sub: 'ghost' })).rejects.toThrow(
        'User not found',
      );
    });
  });
});
