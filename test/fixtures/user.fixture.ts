import * as bcrypt from 'bcryptjs';
import { UserService } from '../../src/modules/user/user.service';
import { User, UserRole } from '../../src/modules/user/schema/user.schema';

export const testUser = {
  email: 'test@wavefit.com',
  password: 'password123',
  name: 'Test User',
  role: UserRole.USER,
};

export async function createTestUser(userService: UserService): Promise<User> {
  const existingUser = await userService.findByEmail(testUser.email);
  if (existingUser) {
    return existingUser;
  }
  const user = await userService.create({
    ...testUser,
  });
  return user as User;
}

export function getTestUserCredentials() {
  return {
    identifier: testUser.email,
    password: testUser.password,
  };
}
