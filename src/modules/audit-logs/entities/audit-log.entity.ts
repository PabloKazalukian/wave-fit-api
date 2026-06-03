// src/audit-logs/entities/audit-log.entity.ts
import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class AuditLogEntity {
  @Field(() => ID)
  _id: string;

  @Field()
  action: string;

  @Field()
  entity: string;

  @Field(() => ID, { nullable: true })
  entityId?: string;

  @Field(() => ID, { nullable: true })
  userId?: string;

  @Field({ nullable: true })
  userEmail?: string;

  @Field()
  success: boolean;

  @Field({ nullable: true })
  errorMessage?: string;

  //   @Field(() => GraphQLJSON, { nullable: true })
  //   metadata?: Record<string, any>;

  @Field({ nullable: true })
  ip?: string;

  @Field()
  timestamp: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
