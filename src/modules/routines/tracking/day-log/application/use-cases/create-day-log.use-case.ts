import { Injectable } from '@nestjs/common';
import { CreateDayLogInput } from '../../presentation/dto/create-day-log.input';

@Injectable()
export class CreateDayLogUseCase {
  async execute(_input: CreateDayLogInput, _userId: string) {
    return 'This action adds a new dayLog';
  }
}
