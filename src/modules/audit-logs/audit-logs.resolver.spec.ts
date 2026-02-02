import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogsResolver } from './audit-logs.resolver';

describe('AuditLogsResolver', () => {
  let resolver: AuditLogsResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditLogsResolver],
    }).compile();

    resolver = module.get<AuditLogsResolver>(AuditLogsResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
