import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogsResolver } from './audit-logs.resolver';
import { AuditLogsService } from './audit-logs.service';

describe('AuditLogsResolver', () => {
  let resolver: AuditLogsResolver;

  const auditLogsServiceMock = {
    findAll: jest.fn(),
    logAsync: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogsResolver,
        {
          provide: AuditLogsService,
          useValue: auditLogsServiceMock,
        },
      ],
    }).compile();

    resolver = module.get<AuditLogsResolver>(AuditLogsResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
