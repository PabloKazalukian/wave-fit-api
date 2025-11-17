import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { CreateUserInput } from './dto/create-user.input';
import { UpdateUserInput } from './dto/update-user.input';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User as UserMongoose, UserRole } from './schema/user.schema';
import { handleError } from 'src/common/utils/handle-error';
import { UserGoogle } from 'src/common/interfaces/user.interface';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(UserMongoose.name) private userModel: Model<UserMongoose>,
  ) {}

  async create(
    createUserInput: CreateUserInput,
  ): Promise<UserMongoose | undefined> {
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

  async createGoogleUser(userInfo: UserGoogle): Promise<UserMongoose> {
    const pass = Math.random().toString(36).slice(-8);
    const hashed = await bcrypt.hash(pass, 10);

    const createdUser = new this.userModel({
      email: userInfo.email,
      name: userInfo.name,
      // picture: userInfo.picture,
      // googleId: userInfo.googleId,
      password: hashed,
      role: UserRole.USER,
      // Puedes agregar otros campos necesarios aquí
    });
    return createdUser.save();
  }
}
