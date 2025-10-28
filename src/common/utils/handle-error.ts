import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';

export function handleError(error: any) {
  if (error.name === 'ValidationError') {
    throw new BadRequestException(
      Object.values(error.errors).map((e: any) => e.message),
    );
  }

  if (error.code === 11000) {
    throw new BadRequestException('Duplicated key error');
  }

  console.error('[DB Error]', error);
  throw new InternalServerErrorException('Error interno del servidor');
}
