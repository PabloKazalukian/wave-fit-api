import { Injectable } from '@nestjs/common';
import { CreateExtraSessionInput } from './dto/create-extra-session.input';
import { UpdateExtraSessionInput } from './dto/update-extra-session.input';

@Injectable()
export class ExtraSessionService {
  create(createExtraSessionInput: CreateExtraSessionInput) {
    return 'This action adds a new extraSession';
  }

  findAll() {
    return `This action returns all extraSession`;
  }

  findOne(id: number) {
    return `This action returns a #${id} extraSession`;
  }

  update(id: number, updateExtraSessionInput: UpdateExtraSessionInput) {
    return `This action updates a #${id} extraSession`;
  }

  remove(id: number) {
    return `This action removes a #${id} extraSession`;
  }
}
