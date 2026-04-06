import { Injectable } from '@nestjs/common';
import { UpdateDayLogInput } from '../../presentation/dto/update-day-log.input';

@Injectable()
export class UpdateDayLogUseCase {
  async execute(id: string, input: UpdateDayLogInput, userId: string) {
    return `This action updates a #${id} dayLog`;
  }
}
