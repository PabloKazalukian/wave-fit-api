import { Injectable } from '@nestjs/common';

@Injectable()
export class FindOneDayLogUseCase {
  async execute(id: string, userId: string) {
    return `This action returns a #${id} dayLog`;
  }
}
