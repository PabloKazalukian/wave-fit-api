import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { CreateUser } from './dto/create-user.input';
import { UpdateUserInput } from './dto/update-user.input';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User as UserMongoose, UserRole } from './schema/user.schema';
import { UserGoogle } from '../../common/interfaces/user.interface';
import { StorageService } from '../storage/storage.service';
import sharp from 'sharp';

const AVATAR_MIME_MAP: Record<string, string> = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

@Injectable()
export class UserService {
  constructor(
    @InjectModel(UserMongoose.name) private userModel: Model<UserMongoose>,
    private readonly storageService: StorageService,
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

  async updateAvatar(
    userId: string,
    avatar: { storageKey: string; url: string; source: string },
  ): Promise<UserMongoose | null> {
    return this.userModel
      .findByIdAndUpdate(userId, { $set: { avatar } }, { new: true })
      .exec();
  }

  async findOneByEmail(email: string): Promise<UserMongoose | null> {
    return this.userModel.findOne({ email: email }).exec();
  }

  async isEmailAvailable(email: string): Promise<boolean> {
    const user = await this.userModel.findOne({ email: email }).exec();
    return user === null;
  }

  async uploadAvatar(base64Image: string, userId: string) {
    const matches = base64Image.match(
      /^data:image\/(?<ext>jpeg|jpg|png|webp|gif);base64,(?<data>.+)$/,
    );
    if (!matches || !matches.groups) {
      throw new Error(
        'Invalid image format. Expected data:image/(jpeg|png|webp|gif);base64,...',
      );
    }

    const ext = matches.groups.ext === 'jpeg' ? 'jpg' : matches.groups.ext;
    const contentType = AVATAR_MIME_MAP[ext] || 'image/jpeg';
    const buffer = Buffer.from(matches.groups.data, 'base64');

    if (buffer.length > 5 * 1024 * 1024) {
      throw new Error('Image too large. Maximum size is 5MB.');
    }

    const processed = await sharp(buffer)
      .resize(60, 60, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 80 })
      .toBuffer();

    const key = `avatars/${userId}/avatar.jpg`;

    const currentUser = await this.findOne(userId);
    if (
      currentUser?.avatar?.storageKey &&
      currentUser.avatar.storageKey !== key
    ) {
      await this.storageService
        .deleteFile(currentUser.avatar.storageKey)
        .catch(() => {});
    }

    const url = await this.storageService.uploadFile(
      key,
      processed,
      contentType,
    );

    return this.updateAvatar(userId, {
      storageKey: key,
      url,
      source: 'upload',
    });
  }
}
