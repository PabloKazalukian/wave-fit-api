import { AuditLogsInterceptor } from './audit-logs.interceptor';

describe('AuditLogsInterceptor', () => {
  it('should be defined', () => {
    expect(new AuditLogsInterceptor()).toBeDefined();
  });
});
