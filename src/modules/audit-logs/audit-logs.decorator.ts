// src/audit-logs/decorators/audit.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { AUDIT_METADATA_KEY } from './audit-logs.interceptor';

export const Audit = (action: string, entity: string) =>
  SetMetadata(AUDIT_METADATA_KEY, { action, entity });
