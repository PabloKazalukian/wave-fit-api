import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { CreateUserInput } from './dto/create-user.input';
import { UpdateUserInput } from './dto/update-user.input';
import { UserRole } from './schema/user.schema';
import passport from 'passport';
import { handleError } from 'src/common/utils/handle-error';

@Resolver(() => User)
export class UserResolver {
  constructor(private readonly userService: UserService) {}

  @Mutation(() => User)
  async createUser(@Args('createUserInput') createUserInput: CreateUserInput) {
    try {
      const created = await this.userService.create({
        ...createUserInput,
        role: createUserInput.role ?? UserRole.USER,
      });

      return created;
    } catch (err) {
      handleError(err);
    }
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
  async findOne(@Args('id', { type: () => String }) id: String) {
    return this.userService.findOne(id);
  }

  @Query(() => User, { name: 'userName' })
  async findOneByName(@Args('name', { type: () => String }) name: String) {
    return this.userService.findOneByName(name);
  }

  @Mutation(() => User)
  async updateUser(@Args('updateUserInput') updateUserInput: UpdateUserInput) {
    return this.userService.update(updateUserInput.id, updateUserInput);
  }

  @Mutation(() => User)
  async removeUser(@Args('id', { type: () => String }) id: String) {
    return this.userService.remove(id);
  }
}
