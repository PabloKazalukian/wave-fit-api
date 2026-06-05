import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

export function extractUserId(context: any): string {
  // console.log('[context]', context);
  const userId =
    context?.req?.user?._id?.toString() ||
    context?.req?.user?.id ||
    context?.req?.user?.userId;

  if (!userId || !Types.ObjectId.isValid(userId)) {
    throw new BadRequestException('Invalid user id');
  }

  return userId;
}
