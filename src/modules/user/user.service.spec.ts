import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { UserService } from './user.service';
import { User } from './schema/user.schema';
import { StorageService } from '../storage/storage.service';
import sharp from 'sharp';

jest.mock('sharp', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const sharpMock = sharp as unknown as jest.Mock;

describe('UserService', () => {
  let service: UserService;
  let userModel: Record<string, jest.Mock>;
  let storageService: {
    uploadFile: jest.Mock;
    deleteFile: jest.Mock;
  };

  const validJpegBase64 =
    'data:image/jpeg;base64,' +
    Buffer.from('fake-jpeg-data').toString('base64');

  beforeEach(async () => {
    userModel = jest.fn() as unknown as Record<string, jest.Mock>;
    userModel.create = jest.fn();
    userModel.find = jest.fn();
    userModel.findOne = jest.fn();
    userModel.findById = jest.fn();
    userModel.findByIdAndUpdate = jest.fn();
    userModel.updateOne = jest.fn();
    userModel.deleteOne = jest.fn();

    storageService = {
      uploadFile: jest.fn(),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getModelToken(User.name),
          useValue: userModel,
        },
        {
          provide: StorageService,
          useValue: storageService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    sharpMock.mockReset();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const baseInput = {
      email: 'a@b.com',
      name: 'pablo',
      password: 'secret123',
    } as any;

    it('hashea la password, asigna rol USER y crea el usuario', async () => {
      userModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      userModel.create.mockResolvedValue({ _id: 'u1' });

      const result = await service.create(baseInput);

      const args = userModel.create.mock.calls[0][0];
      expect(args.password).not.toBe('secret123');
      expect(args.password).toMatch(/^\$2[aby]\$/);
      expect(args.role).toBe('user');
      expect(result).toEqual({ _id: 'u1' });
    });

    it('rechaza si el email ya existe', async () => {
      userModel.findOne
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue({ _id: 'existing' }),
        })
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue(null),
        });

      await expect(service.create(baseInput)).rejects.toThrow(
        'User already exists',
      );
      expect(userModel.create).not.toHaveBeenCalled();
    });

    it('rechaza si el nombre ya existe', async () => {
      userModel.findOne
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(null) })
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue({ _id: 'existing-name' }),
        });

      await expect(
        service.create({ ...baseInput, email: 'nuevo@b.com' }),
      ).rejects.toThrow('User already exists');
      expect(userModel.create).not.toHaveBeenCalled();
    });

    it('rechaza si falta la password (bcrypt falla con undefined)', async () => {
      userModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.create({ ...baseInput, password: undefined }),
      ).rejects.toThrow('Illegal arguments');
    });
  });

  describe('consultas simples', () => {
    const execOf = (value: any) => ({ exec: jest.fn().mockResolvedValue(value) });

    it('findAll retorna el resultado del modelo', async () => {
      const users = [{ _id: 'u1' }];
      userModel.find.mockReturnValue(execOf(users));

      expect(await service.findAll()).toBe(users);
    });

    it('findByIdentifier busca por email O nombre', async () => {
      userModel.findOne.mockReturnValue(execOf({ _id: 'u1' }));

      await service.findByIdentifier('a@b.com');

      expect(userModel.findOne).toHaveBeenCalledWith({
        $or: [{ email: 'a@b.com' }, { name: 'a@b.com' }],
      });
    });

    it('findByEmail / findOneByEmail buscan por email', async () => {
      userModel.findOne.mockReturnValue(execOf(null));

      await service.findByEmail('a@b.com');
      expect(userModel.findOne).toHaveBeenLastCalledWith({ email: 'a@b.com' });

      await service.findOneByEmail('c@d.com');
      expect(userModel.findOne).toHaveBeenLastCalledWith({ email: 'c@d.com' });
    });

    it('findOne delega en findById sin exec', async () => {
      userModel.findById.mockResolvedValue({ _id: 'u1' });

      expect(await service.findOne('u1')).toEqual({ _id: 'u1' });
      expect(userModel.findById).toHaveBeenCalledWith('u1');
    });

    it('findOneByName busca por nombre', async () => {
      userModel.findOne.mockReturnValue(execOf({ _id: 'u1', name: 'pablo' }));

      expect(await service.findOneByName('pablo')).toBeDefined();
      expect(userModel.findOne).toHaveBeenCalledWith({ name: 'pablo' });
    });
  });

  describe('update / remove', () => {
    it('update delega en updateOne', async () => {
      const updateResult = { modifiedCount: 1 };
      userModel.updateOne.mockReturnValue(
        jest.fn().mockReturnThis() && {
          exec: jest.fn().mockResolvedValue(updateResult),
        },
      );

      expect(await service.update('u1', { name: 'nuevo' } as any)).toBe(
        updateResult,
      );
      expect(userModel.updateOne).toHaveBeenCalledWith(
        { _id: 'u1' },
        { name: 'nuevo' },
      );
    });

    it('remove delega en deleteOne', async () => {
      const deleteResult = { deletedCount: 1 };
      userModel.deleteOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(deleteResult),
      });

      expect(await service.remove('u1')).toBe(deleteResult);
      expect(userModel.deleteOne).toHaveBeenCalledWith({ _id: 'u1' });
    });
  });

  describe('createGoogleUser', () => {
    it('crea usuario con password aleatoria hasheada y rol USER', async () => {
      const saveMock = jest.fn().mockResolvedValue({ _id: 'g1' });
      (userModel as unknown as jest.Mock).mockImplementation(
        (doc: any) => ({
          save: saveMock,
          doc,
        }),
      );

      const result = await service.createGoogleUser({
        email: 'g@gmail.com',
        name: 'google-user',
        picture: 'https://pic',
        googleId: 'gid-123',
      } as any);

      expect(userModel).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'g@gmail.com',
          googleId: 'gid-123',
          role: 'user',
        }),
      );
      const createdArg = (userModel as unknown as jest.Mock).mock.calls[0][0];
      expect(createdArg.password).toMatch(/^\$2[aby]\$/);
      expect(result).toEqual({ _id: 'g1' });
    });
  });

  describe('isEmailAvailable', () => {
    it('retorna true si no existe un usuario con ese email', async () => {
      userModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      expect(await service.isEmailAvailable('libre@b.com')).toBe(true);
    });

    it('retorna false si el email está registrado', async () => {
      userModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'u1' }),
      });

      expect(await service.isEmailAvailable('ocupado@b.com')).toBe(false);
    });
  });

  describe('updateAvatar', () => {
    it('should persist the avatar object and return the updated user', async () => {
      const avatar = {
        storageKey: 'avatars/u1/avatar.jpg',
        url: 'https://cdn/avatar.jpg',
        source: 'upload',
      };
      const updated = { _id: 'u1', avatar };
      userModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updated),
      });

      const result = await service.updateAvatar('u1', avatar);

      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'u1',
        { $set: { avatar } },
        { new: true },
      );
      expect(result).toBe(updated);
    });
  });

  describe('uploadAvatar', () => {
    it('should reject an invalid base64 image format', async () => {
      await expect(
        service.uploadAvatar('not-a-valid-image', 'u1'),
      ).rejects.toThrow('Invalid image format');
      expect(storageService.uploadFile).not.toHaveBeenCalled();
    });

    it('should reject images larger than 5MB', async () => {
      const tooBig =
        'data:image/jpeg;base64,' +
        Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64');

      await expect(service.uploadAvatar(tooBig, 'u1')).rejects.toThrow(
        'Image too large',
      );
      expect(sharpMock).not.toHaveBeenCalled();
      expect(storageService.uploadFile).not.toHaveBeenCalled();
    });

    it('should process the image, upload it and persist the avatar', async () => {
      const processed = Buffer.from('processed-image');
      sharpMock.mockReturnValue({
        resize: jest.fn().mockReturnThis(),
        jpeg: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(processed),
      });
      userModel.findById.mockResolvedValue(null);
      storageService.uploadFile.mockImplementation(
        (key: string) =>
          `https://bucket.s3.amazonaws.com/${key}`,
      );
      const updated = { _id: 'u1', avatar: { url: 'https://...' } };
      userModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updated),
      });

      const result = await service.uploadAvatar(validJpegBase64, 'u1');

      expect(sharpMock).toHaveBeenCalledWith(expect.any(Buffer));
      const expectedKey = expect.stringMatching(
        /^avatars\/u1\/avatar-\d+\.jpg$/,
      );
      expect(storageService.uploadFile).toHaveBeenCalledWith(
        expectedKey,
        processed,
        'image/jpeg',
      );
      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'u1',
        {
          $set: {
            avatar: {
              storageKey: expectedKey,
              url: expect.stringMatching(
                /^https:\/\/bucket\.s3\.amazonaws\.com\/avatars\/u1\/avatar-\d+\.jpg$/,
              ),
              source: 'upload',
            },
          },
        },
        { new: true },
      );
      expect(result).toBe(updated);
    });

    it('should delete the previous avatar when the storage key changes', async () => {
      const processed = Buffer.from('processed-image');
      sharpMock.mockReturnValue({
        resize: jest.fn().mockReturnThis(),
        jpeg: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(processed),
      });
      userModel.findById.mockResolvedValue({
        _id: 'u1',
        avatar: { storageKey: 'avatars/u1/old.png' },
      });
      storageService.uploadFile.mockResolvedValue('https://new-url');
      userModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'u1' }),
      });

      await service.uploadAvatar(validJpegBase64, 'u1');

      expect(storageService.deleteFile).toHaveBeenCalledWith(
        'avatars/u1/old.png',
      );
    });

    it('should delete the previous avatar whenever a new upload generates a new key', async () => {
      const processed = Buffer.from('processed-image');
      sharpMock.mockReturnValue({
        resize: jest.fn().mockReturnThis(),
        jpeg: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(processed),
      });
      userModel.findById.mockResolvedValue({
        _id: 'u1',
        avatar: { storageKey: 'avatars/u1/avatar-123.jpg' },
      });
      storageService.uploadFile.mockResolvedValue('https://new-url');
      userModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'u1' }),
      });

      await service.uploadAvatar(validJpegBase64, 'u1');

      expect(storageService.uploadFile).toHaveBeenCalledWith(
        expect.stringMatching(/^avatars\/u1\/avatar-\d+\.jpg$/),
        expect.any(Buffer),
        expect.any(String),
      );
      expect(storageService.deleteFile).toHaveBeenCalledWith(
        'avatars/u1/avatar-123.jpg',
      );
    });
  });
});
