// filters/graphql-exception.filter.ts
import { Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { GqlExceptionFilter, GqlArgumentsHost } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { MongoError } from 'mongodb';
import { Error as MongooseError } from 'mongoose';

@Catch()
export class GraphQLExceptionFilter implements GqlExceptionFilter {
  private readonly logger = new Logger(GraphQLExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const gqlHost = GqlArgumentsHost.create(host);
    const info = gqlHost.getInfo();

    // Log completo del error para debugging
    this.logger.error(
      `Error en ${info?.fieldName || 'unknown'}:`,
      exception instanceof Error ? exception.stack : exception,
    );

    // 1. Excepciones HTTP de NestJS (las más comunes)
    // Usamos una comprobación más robusta por si acaso hay problemas con instanceof en ciertos entornos
    if (
      exception instanceof HttpException ||
      (exception?.getStatus && exception?.getResponse)
    ) {
      return this.handleHttpException(exception);
    }

    // 2. Errores de MongoDB (duplicados, validación, etc)
    if (this.isMongoError(exception)) {
      return this.handleMongoError(exception);
    }

    // 3. Errores de validación de Mongoose
    if (exception instanceof MongooseError.ValidationError) {
      return this.handleMongooseValidationError(exception);
    }

    // 4. Errores de cast de Mongoose (ObjectId inválido, etc)
    if (exception instanceof MongooseError.CastError) {
      return this.handleCastError(exception);
    }

    // 5. Errores genéricos de JavaScript
    if (exception instanceof Error) {
      return this.handleGenericError(exception);
    }

    // 6. Cualquier otra cosa (muy raro)
    return this.handleUnknownError(exception);
  }

  private handleHttpException(exception: HttpException): GraphQLError {
    const status =
      typeof exception.getStatus === 'function' ? exception.getStatus() : 500;
    const response =
      typeof exception.getResponse === 'function'
        ? exception.getResponse()
        : exception;

    const message =
      typeof response === 'string'
        ? response
        : (response as any).message || 'Error en la petición';

    return new GraphQLError(message, {
      extensions: {
        code: this.getHttpErrorCode(status),
        status: status, // Agregamos status al mismo nivel que code para mayor facilidad
        originalError: response, // Incluimos la respuesta original para debugging
      },
    });
  }

  private handleMongoError(error: MongoError): GraphQLError {
    // Error 11000: Duplicate key (índice único violado)
    if (error.code === 11000) {
      const field = this.extractDuplicateField(error);
      return new GraphQLError(`El ${field} ya existe en la base de datos`, {
        extensions: {
          code: 'DUPLICATE_KEY',
          field,
        },
      });
    }

    // Otros errores de MongoDB
    return new GraphQLError('Error en la base de datos', {
      extensions: {
        code: 'DATABASE_ERROR',
        mongoCode: error.code,
      },
    });
  }

  private handleMongooseValidationError(
    error: MongooseError.ValidationError,
  ): GraphQLError {
    const errors = Object.values(error.errors).map((err) => ({
      field: err.path,
      message: err.message,
    }));

    return new GraphQLError('Error de validación en la base de datos', {
      extensions: {
        code: 'VALIDATION_ERROR',
        validationErrors: errors,
      },
    });
  }

  private handleCastError(error: MongooseError.CastError): GraphQLError {
    return new GraphQLError(`ID inválido: ${error.value}`, {
      extensions: {
        code: 'INVALID_ID',
        field: error.path,
        value: error.value,
      },
    });
  }

  private handleGenericError(error: Error): GraphQLError {
    // En producción, no expongas detalles del error
    const isDevelopment = process.env.NODE_ENV !== 'production';

    return new GraphQLError(
      isDevelopment ? error.message : 'Error interno del servidor',
      {
        extensions: {
          code: 'INTERNAL_SERVER_ERROR',
          ...(isDevelopment && { originalError: error.message }),
        },
      },
    );
  }

  private handleUnknownError(exception: unknown): GraphQLError {
    this.logger.error('Error desconocido:', exception);

    return new GraphQLError('Error inesperado del servidor', {
      extensions: {
        code: 'UNKNOWN_ERROR',
      },
    });
  }

  private isMongoError(error: unknown): error is MongoError {
    return (
      error instanceof Error &&
      'code' in error &&
      typeof (error as any).code === 'number'
    );
  }

  private extractDuplicateField(error: MongoError): string {
    const match = error.message.match(/index: (.+?)_/);
    return match ? match[1] : 'campo';
  }

  private getHttpErrorCode(status: number): string {
    const codes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHENTICATED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
    };
    return codes[status] || 'INTERNAL_SERVER_ERROR';
  }
}
