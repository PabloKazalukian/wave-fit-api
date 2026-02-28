import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { CreateUserInput } from './dto/create-user.input';
import { UpdateUserInput } from './dto/update-user.input';
import { UserRole } from './schema/user.schema';
import { Audit } from '../audit-logs/audit-logs.decorator';

@Resolver(() => User)
export class UserResolver {
  constructor(private readonly userService: UserService) {}

  @Mutation(() => User)
  @Audit('CREATE_USER', 'User')
  async createUser(@Args('createUserInput') createUserInput: CreateUserInput) {
    return this.userService.create({
      ...createUserInput,
      role: UserRole.USER,
    });
  }

  @Query(() => [User])
  async users() {
    const all = await this.userService.findAll();
    return all.map((u) => ({
      id: u._id?.toString(),
      name: u.name,
      email: u.email,
      password: u.password,
      role: u.role,
    }));
  }

  @Query(() => User, { name: 'user' })
  async findOne(@Args('id', { type: () => String }) id: string) {
    return this.userService.findOne(id);
  }

  @Query(() => User, { name: 'userName' })
  async findOneByName(@Args('name', { type: () => String }) name: string) {
    return this.userService.findOneByName(name);
  }

  @Query(() => User, { name: 'userEmail' })
  async findOneByEmail(@Args('email', { type: () => String }) email: string) {
    return this.userService.findOneByEmail(email);
  }

  @Mutation(() => User)
  async updateUser(@Args('updateUserInput') updateUserInput: UpdateUserInput) {
    return this.userService.update(updateUserInput.id, updateUserInput);
  }

  @Mutation(() => User)
  async removeUser(@Args('id', { type: () => String }) id: string) {
    return this.userService.remove(id);
  }

  @Query(() => Boolean)
  async isEmailAvailable(@Args('email', { type: () => String }) email: string) {
    const user = await this.userService.findOneByEmail(email);
    return user === null;
  }
}
