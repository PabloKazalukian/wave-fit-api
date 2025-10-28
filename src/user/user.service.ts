import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { CreateUserInput } from './dto/create-user.input';
import { UpdateUserInput } from './dto/update-user.input';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, User as UserMongo } from './schema/user.schema';
import { handleError } from 'src/common/utils/handle-error';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(UserMongo.name) private userModel: Model<UserMongo>,
  ) {}

  async create(
    createUserInput: CreateUserInput,
  ): Promise<UserMongo | undefined> {
    try {
      const hashed = await bcrypt.hash(createUserInput.password, 10);
      const createdUser = new this.userModel({
        ...createUserInput,
        password: hashed,
      });

      return createdUser.save();
    } catch (error) {
      handleError(error);
    }
  }

  async findAll(): Promise<UserMongo[]> {
    return this.userModel.find().exec();
  }

  async findOne(id: String) {
    return this.userModel.findById(id);
  }

  async findOneByName(name: String) {
    return this.userModel.findOne({ name: name }).exec();
  }

  async update(id: String, updateUserInput: UpdateUserInput) {
    return this.userModel.updateOne({ _id: id }, updateUserInput).exec();
  }

  async remove(id: String) {
    return this.userModel.deleteOne({ _id: id }).exec();
  }
}
