import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ResourceResolver } from './resource.resolver';
import { ResourceService } from './resource.service';
import { UserResource } from '../schema/resourse.schema';

describe('ResourceResolver', () => {
  let resolver: ResourceResolver;

  const mockModel = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    exists: jest.fn(),
    exec: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResourceResolver,
        ResourceService,
        {
          provide: getModelToken(UserResource.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    resolver = module.get<ResourceResolver>(ResourceResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
