import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';

export function handleError(error: any) {
  if (error.name === 'ValidationError') {
    throw new BadRequestException({
      message: 'Error de validación',
      details: Object.values(error.errors).map((e: any) => e.message),
      code: 'VALIDATION_ERROR',
    });
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    throw new BadRequestException({
      message: `El campo '${field}' debe ser único`,
      code: 'DUPLICATE_KEY',
    });
  }

  console.error('[DB Error]', error);
  throw new InternalServerErrorException({
    message: 'Error interno del servidor',
    code: 'INTERNAL_SERVER_ERROR',
  });
}
