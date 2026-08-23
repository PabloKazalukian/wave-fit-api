import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { UserResolver } from './user.resolver';
import { UserService } from './user.service';
import { User } from './schema/user.schema';
import { StorageService } from '../storage/storage.service';

describe('UserResolver', () => {
  let resolver: UserResolver;
  let userService: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    findOneByName: jest.Mock;
    findOneByEmail: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    uploadAvatar: jest.Mock;
  };

  const createMockModel = (): Record<string, jest.Mock> => ({
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
  });

  beforeEach(async () => {
    userService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      findOneByName: jest.fn(),
      findOneByEmail: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      uploadAvatar: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserResolver,
        { provide: UserService, useValue: userService },
        {
          provide: getModelToken(User.name),
          useValue: createMockModel(),
        },
        {
          provide: StorageService,
          useValue: {
            uploadFile: jest.fn(),
            deleteFile: jest.fn(),
          },
        },
      ],
    }).compile();

    resolver = module.get<UserResolver>(UserResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('createUser delega en service.create con rol USER', async () => {
    userService.create.mockResolvedValue({ _id: 'u1' });

    await resolver.createUser({
      email: 'a@b.com',
      name: 'pablo',
      password: 'x',
    } as any);

    expect(userService.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'a@b.com', role: 'user' }),
    );
  });

  it('users mapea _id a id', async () => {
    userService.findAll.mockResolvedValue([
      { _id: 'u1', name: 'a', email: 'a@b.com', password: 'h', role: 'user' },
    ]);

    expect(await resolver.users()).toEqual([
      { id: 'u1', name: 'a', email: 'a@b.com', password: 'h', role: 'user' },
    ]);
  });

  it('findOne / findOneByName / findOneByEmail delegan', async () => {
    await resolver.findOne('u1');
    expect(userService.findOne).toHaveBeenCalledWith('u1');

    await resolver.findOneByName('pablo');
    expect(userService.findOneByName).toHaveBeenCalledWith('pablo');

    await resolver.findOneByEmail('a@b.com');
    expect(userService.findOneByEmail).toHaveBeenCalledWith('a@b.com');
  });

  it('updateUser y removeUser delegan con el id correcto', async () => {
    await resolver.updateUser({ id: 'u1', name: 'nuevo' } as any);
    expect(userService.update).toHaveBeenCalledWith('u1', {
      id: 'u1',
      name: 'nuevo',
    });

    await resolver.removeUser('u1');
    expect(userService.remove).toHaveBeenCalledWith('u1');
  });

  it('isEmailAvailable refleja si el usuario no existe', async () => {
    userService.findOneByEmail.mockResolvedValueOnce(null);
    expect(await resolver.isEmailAvailable('libre@b.com')).toBe(true);

    userService.findOneByEmail.mockResolvedValueOnce({ _id: 'u1' });
    expect(await resolver.isEmailAvailable('ocupado@b.com')).toBe(false);
  });

  it('updateAvatar usa el userId del contexto', async () => {
    userService.uploadAvatar.mockResolvedValue({ _id: 'u1' });
    const context = { req: { user: { _id: '64f0000000000000000000aa' } } };

    await resolver.updateAvatar('aGVsbG8=', context);

    expect(userService.uploadAvatar).toHaveBeenCalledWith(
      'aGVsbG8=',
      '64f0000000000000000000aa',
    );
  });
});
