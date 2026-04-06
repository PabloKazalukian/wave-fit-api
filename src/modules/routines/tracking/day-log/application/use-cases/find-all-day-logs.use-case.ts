import { Injectable } from '@nestjs/common';

@Injectable()
export class FindAllDayLogsUseCase {
  async execute(userId: string, limit?: number, offset?: number) {
    return `This action returns all dayLog`;
  }
}
