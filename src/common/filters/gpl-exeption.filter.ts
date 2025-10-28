// // src/common/filters/gql-exception.filter.ts
// import {
//   Catch,
//   ArgumentsHost,
//   HttpException,
//   HttpStatus,
// } from '@nestjs/common';
// import { GqlArgumentsHost } from '@nestjs/graphql';
// // import { ApolloError, UserInputError, ValidationError } from 'apollo-server-express';

// @Catch()
// export class GqlExceptionFilter {
//   catch(exception: unknown, host: ArgumentsHost) {
//     const gqlHost = GqlArgumentsHost.create(host);

//     if (exception instanceof HttpException) {
//       const response = exception.getResponse();
//       const message =
//         (response as any).message || exception.message || 'Error desconocido';
//       const status = exception.getStatus();
//       return new ApolloError(message, status.toString());
//     }

//     // Errores de validación de Mongoose
//     if ((exception as any).name === 'ValidationError') {
//       const errors = Object.values((exception as any).errors).map(
//         (err: any) => err.message,
//       );
//       return new UserInputError('Error de validación', { errors });
//     }

//     // Errores de tipo en GraphQL (por ejemplo: string en campo Int)
//     if (exception instanceof SyntaxError) {
//       return new UserInputError('Error de sintaxis en la query');
//     }

//     // Errores genéricos
//     console.error('[Unhandled Exception]', exception);
//     return new ApolloError('Error interno del servidor');
//   }
// }
