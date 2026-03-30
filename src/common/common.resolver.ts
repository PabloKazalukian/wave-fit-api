import { Resolver, Query } from '@nestjs/graphql';

@Resolver()
export class CommonResolver {
  @Query(() => String, {
    name: 'warmup',
    description: 'Ping the server to prevent sleep on free tiers',
  })
  warmup(): string {
    return 'Server is warm!';
  }
}
