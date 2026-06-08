import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { UserProfileResolver } from './user-profile.resolver';
import { UserProfileService } from './user-profile.service';
import { UserProfile } from './schema/user-profile.schema';

describe('UserProfileResolver', () => {
  let resolver: UserProfileResolver;

  const mockModel = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    exec: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserProfileResolver,
        UserProfileService,
        {
          provide: getModelToken(UserProfile.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    resolver = module.get<UserProfileResolver>(UserProfileResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
