import { Injectable } from '@nestjs/common';

@Injectable()
export class RemoveDayLogUseCase {
  async execute(id: string, userId: string) {
    return `This action removes a #${id} dayLog`;
  }
}
