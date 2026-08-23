import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalStrategy } from './local.strategy';

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;

  const authServiceMock = {
    validateUser: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new LocalStrategy(
      authServiceMock as unknown as AuthService,
    );
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('usa "identifier" como campo de usuario (name o email)', () => {
    expect((strategy as any)._usernameField).toBe('identifier');
  });

  it('retorna el usuario cuando las credenciales son válidas', async () => {
    const user = { id: 'user-1', name: 'pablo' };
    authServiceMock.validateUser.mockResolvedValue(user);

    const result = await strategy.validate('pablo', 'secret-pass');

    expect(authServiceMock.validateUser).toHaveBeenCalledWith(
      'pablo',
      'secret-pass',
    );
    expect(result).toBe(user);
  });

  it('lanza UnauthorizedException si validateUser retorna null', async () => {
    authServiceMock.validateUser.mockResolvedValue(null);

    await expect(
      strategy.validate('intruso', 'wrong-pass'),
    ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
  });
});
