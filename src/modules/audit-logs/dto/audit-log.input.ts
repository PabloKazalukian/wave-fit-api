// src/audit-logs/dto/audit-log-filters.input.ts
import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class AuditLogFiltersInput {
  @Field({ nullable: true })
  userId?: string;

  @Field({ nullable: true })
  entity?: string;

  @Field({ nullable: true })
  action?: string;

  @Field({ nullable: true })
  success?: boolean;

  @Field({ nullable: true })
  startDate?: Date;

  @Field({ nullable: true })
  endDate?: Date;
}
