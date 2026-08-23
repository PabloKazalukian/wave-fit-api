import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { of, throwError } from 'rxjs';
import { AuditInterceptor } from './audit-logs.interceptor';
import { AuditLogsService } from './audit-logs.service';

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;

  const reflectorMock = { get: jest.fn() };
  const auditServiceMock = { logAsync: jest.fn() };

  const buildContext = () =>
    ({ getHandler: jest.fn() }) as unknown as Parameters<
      AuditInterceptor['intercept']
    >[0];

  const mockGqlContext = (ctx: any) => {
    (GqlExecutionContext.create as jest.Mock).mockReturnValue({
      getContext: () => ctx,
    });
  };

  beforeAll(() => {
    jest
      .spyOn(GqlExecutionContext, 'create')
      .mockImplementation((() => ({ getContext: () => ({}) })) as any);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    interceptor = new AuditInterceptor(
      reflectorMock as unknown as Reflector,
      auditServiceMock as unknown as AuditLogsService,
    );
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('pasa sin auditar si el handler no tiene metadatos de auditoría', (done) => {
    reflectorMock.get.mockReturnValue(undefined);

    const result$ = interceptor.intercept(buildContext(), {
      handle: () => of('ok'),
    } as any);

    result$.subscribe((value) => {
      expect(value).toBe('ok');
      expect(auditServiceMock.logAsync).not.toHaveBeenCalled();
      done();
    });
  });

  describe('operación exitosa', () => {
    it('audita success=true con usuario, entityId e IP', (done) => {
      mockGqlContext({
        req: { user: { id: 'user-1' }, ip: '10.0.0.1', headers: {} },
      });
      reflectorMock.get.mockReturnValue({
        action: 'CREATE_WEEKLY_ROUTINE',
        entity: 'WeeklyRoutine',
      });

      const result = { _id: 'abc123def456', name: 'plan' };
      interceptor.intercept(buildContext(), {
        handle: () => of(result),
      } as any).subscribe(() => {
        expect(auditServiceMock.logAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'CREATE_WEEKLY_ROUTINE',
            entity: 'WeeklyRoutine',
            entityId: 'abc123def456',
            userId: 'user-1',
            success: true,
            metadata: expect.objectContaining({ hasUser: true }),
          }),
        );
        done();
      });
    });

    it('marca anonymous cuando no hay usuario en ninguna fuente', (done) => {
      mockGqlContext({});
      reflectorMock.get.mockReturnValue({ action: 'X', entity: 'Y' });

      interceptor.intercept(buildContext(), {
        handle: () => of(null),
      } as any).subscribe(() => {
        const call = auditServiceMock.logAsync.mock.calls[0][0];
        expect(call.userId).toBe('anonymous');
        expect(call.metadata.hasUser).toBe(false);
        expect(call.entityId).toBeUndefined();
        done();
      });
    });

    it('extrae usuario desde ctx.user si no viene en req.user', (done) => {
      mockGqlContext({ user: { id: 'ctx-user', email: 'c@b.com' } });
      reflectorMock.get.mockReturnValue({ action: 'X', entity: 'Y' });

      interceptor.intercept(buildContext(), {
        handle: () => of({}),
      } as any).subscribe(() => {
        expect(auditServiceMock.logAsync).toHaveBeenCalledWith(
          expect.objectContaining({ userId: 'ctx-user', userEmail: 'c@b.com' }),
        );
        done();
      });
    });

    it('construye usuario desde headers x-user-id como último recurso', (done) => {
      mockGqlContext({
        req: { headers: { 'x-user-id': 'header-user', 'x-user-email': 'h@b.com' } },
      });
      reflectorMock.get.mockReturnValue({ action: 'X', entity: 'Y' });

      interceptor.intercept(buildContext(), {
        handle: () => of({}),
      } as any).subscribe(() => {
        expect(auditServiceMock.logAsync).toHaveBeenCalledWith(
          expect.objectContaining({ userId: 'header-user', userEmail: 'h@b.com' }),
        );
        done();
      });
    });
  });

  describe('operación fallida', () => {
    it('audita success=false y re-lanza el error original', (done) => {
      mockGqlContext({ req: { user: { id: 'user-1' }, headers: {} } });
      reflectorMock.get.mockReturnValue({ action: 'X', entity: 'Y' });
      const boom = new Error('DB down');

      interceptor.intercept(buildContext(), {
        handle: () => throwError(() => boom),
      } as any).subscribe({
        error: (err) => {
          expect(err).toBe(boom);
          expect(auditServiceMock.logAsync).toHaveBeenCalledWith(
            expect.objectContaining({
              success: false,
              errorMessage: 'DB down',
              metadata: expect.objectContaining({ errorStack: expect.any(String) }),
            }),
          );
          done();
        },
      });
    });
  });

  describe('extractIp', () => {
    it.each([
      [
        'usa x-forwarded-for (primera entrada)',
        { req: { headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2' } } },
        '1.1.1.1',
      ],
      ['usa x-real-ip', { req: { headers: { 'x-real-ip': '3.3.3.3' } } }, '3.3.3.3'],
      [
        'usa connection.remoteAddress',
        { req: { headers: {}, connection: { remoteAddress: '4.4.4.4' } } },
        '4.4.4.4',
      ],
      [
        'usa socket.remoteAddress',
        { req: { headers: {}, socket: { remoteAddress: '5.5.5.5' } } },
        '5.5.5.5',
      ],
      ['usa req.ip', { req: { headers: {}, ip: '6.6.6.6' } }, '6.6.6.6'],
      [
        'no crashea si el request no trae headers',
        { req: { ip: '7.7.7.7' } },
        '7.7.7.7',
      ],
    ])('%s', (_name, ctx, expectedIp, done) => {
      mockGqlContext(ctx);
      reflectorMock.get.mockReturnValue({ action: 'X', entity: 'Y' });

      interceptor.intercept(buildContext(), {
        handle: () => of({}),
      } as any).subscribe(() => {
        expect(auditServiceMock.logAsync).toHaveBeenCalledWith(
          expect.objectContaining({ ip: expectedIp }),
        );
        done();
      });
    });
  });
});
