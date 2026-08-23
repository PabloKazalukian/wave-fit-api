import { HttpException } from '@nestjs/common';
import { GqlArgumentsHost } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { GraphQLExceptionFilter } from './gql-exception.filter';

describe('GraphQLExceptionFilter', () => {
  let filter: GraphQLExceptionFilter;

  const gqlHostMock = {
    getInfo: () => ({ fieldName: 'generatePlan' }),
    getClass: () => Object,
    getHandler: () => () => undefined,
    getArgs: () => ({}),
    getContext: () => ({}),
    getRoot: () => null,
  };

  beforeAll(() => {
    jest.spyOn(GqlArgumentsHost, 'create').mockReturnValue(gqlHostMock as any);
  });

  beforeEach(() => {
    filter = new GraphQLExceptionFilter();
  });

  describe('mapeo de códigos HTTP', () => {
    it('mapea un HttpException 429 a code TOO_MANY_REQUESTS con status 429', () => {
      const exception = new HttpException(
        {
          message: 'Límite diario de generaciones alcanzado',
          code: 'RATE_LIMIT_EXCEEDED',
        },
        429,
      );

      const result = filter.catch(exception, {} as any) as GraphQLError;

      expect(result).toBeInstanceOf(GraphQLError);
      expect(result.extensions.code).toBe('TOO_MANY_REQUESTS');
      expect(result.extensions.status).toBe(429);
    });

    it('propaga el mensaje del response cuando es objeto', () => {
      const exception = new HttpException(
        { message: 'Límite diario de generaciones alcanzado' },
        429,
      );

      const result = filter.catch(exception, {} as any) as GraphQLError;

      expect(result.message).toBe('Límite diario de generaciones alcanzado');
    });

    it('incluye originalError en extensions para debugging', () => {
      const exception = new HttpException(
        { message: 'boom', code: 'RATE_LIMIT_EXCEEDED' },
        429,
      );

      const result = filter.catch(exception, {} as any) as GraphQLError;

      expect(result.extensions.originalError).toEqual({
        message: 'boom',
        code: 'RATE_LIMIT_EXCEEDED',
      });
    });

    it('mantiene el mapeo previo de otros códigos HTTP', () => {
      const cases = [
        [400, 'BAD_REQUEST'],
        [401, 'UNAUTHENTICATED'],
        [403, 'FORBIDDEN'],
        [404, 'NOT_FOUND'],
        [409, 'CONFLICT'],
        [422, 'UNPROCESSABLE_ENTITY'],
        [500, 'INTERNAL_SERVER_ERROR'],
      ] as const;

      for (const [status, expectedCode] of cases) {
        const result = filter.catch(
          new HttpException('err', status),
          {} as any,
        ) as GraphQLError;
        expect(result.extensions.code).toBe(expectedCode);
      }
    });

    it('usa INTERNAL_SERVER_ERROR para códigos HTTP no mapeados', () => {
      const result = filter.catch(
        new HttpException('err', 418),
        {} as any,
      ) as GraphQLError;

      expect(result.extensions.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });
});
