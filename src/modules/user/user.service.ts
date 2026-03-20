import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { CreateUser, CreateUserInput } from './dto/create-user.input';
import { UpdateUserInput } from './dto/update-user.input';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User as UserMongoose, UserRole } from './schema/user.schema';
import { UserGoogle } from '../../common/interfaces/user.interface';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(UserMongoose.name) private userModel: Model<UserMongoose>,
  ) {}

  async create(createUserInput: CreateUser): Promise<UserMongoose | undefined> {
    const hashed = await bcrypt.hash(createUserInput.password, 10);
    //control if exist a email
    const user = await this.userModel
      .findOne({ email: createUserInput.email })
      .exec();
    if (user) {
      throw new Error('User already exists');
    }
    //control if exist a name
    const userName = await this.userModel
      .findOne({ name: createUserInput.name })
      .exec();
    if (userName) {
      throw new Error('User already exists');
    }
    //control if exist a password
    if (!createUserInput.password) {
      throw new Error('Password is required');
    }
    return this.userModel.create({
      ...createUserInput,
      password: hashed,
      role: UserRole.USER,
    });
  }

  async findAll(): Promise<UserMongoose[]> {
    return this.userModel.find().exec();
  }

  async findByIdentifier(identifier: string): Promise<UserMongoose | null> {
    return this.userModel
      .findOne({
        $or: [{ email: identifier }, { name: identifier }],
      })
      .exec();
  }

  async findByEmail(email: string): Promise<UserMongoose | null> {
    return this.userModel.findOne({ email: email }).exec();
  }

  async findOne(id: string) {
    return this.userModel.findById(id);
  }

  async findOneByName(name: string) {
    return this.userModel.findOne({ name: name }).exec();
  }

  async update(id: string, updateUserInput: UpdateUserInput) {
    return this.userModel.updateOne({ _id: id }, updateUserInput).exec();
  }

  async remove(id: string) {
    return this.userModel.deleteOne({ _id: id }).exec();
  }

  async createGoogleUser(userInfo: UserGoogle): Promise<UserMongoose> {
    const pass = Math.random().toString(36).slice(-8);
    const hashed = await bcrypt.hash(pass, 10);

    const createdUser = new this.userModel({
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      googleId: userInfo.googleId,
      password: hashed,
      role: UserRole.USER,
    });
    return createdUser.save();
  }

  async findOneByEmail(email: string): Promise<UserMongoose | null> {
    return this.userModel.findOne({ email: email }).exec();
  }

  async isEmailAvailable(email: string): Promise<boolean> {
    const user = await this.userModel.findOne({ email: email }).exec();
    return user === null;
  }
}
