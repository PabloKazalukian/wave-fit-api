import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogsService } from './audit-logs.service';
import { getModelToken } from '@nestjs/mongoose';
import { AuditLog } from './schema/audit-logs.schema';

describe('AuditLogsService', () => {
  let service: AuditLogsService;

  const auditLogModelMock = {
    create: jest.fn(),
    find: jest.fn(),
  };

  const buildQueryMock = (resolveValue: any) => ({
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(resolveValue),
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogsService,
        {
          provide: getModelToken(AuditLog.name),
          useValue: auditLogModelMock,
        },
      ],
    }).compile();

    service = module.get<AuditLogsService>(AuditLogsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('logAsync (fire-and-forget)', () => {
    it('crea el log con timestamp sin bloquear la operación', () => {
      auditLogModelMock.create.mockResolvedValue({});

      service.logAsync({
        action: 'CREATE_WEEKLY_ROUTINE',
        entity: 'WeeklyRoutine',
        entityId: 'abc123',
        userId: 'user-1',
        userEmail: 'a@b.com',
        success: true,
      });

      expect(auditLogModelMock.create).toHaveBeenCalledTimes(1);
      const args = auditLogModelMock.create.mock.calls[0][0];
      expect(args.action).toBe('CREATE_WEEKLY_ROUTINE');
      expect(args.success).toBe(true);
      expect(args.timestamp).toBeInstanceOf(Date);
    });

    it('solo loguea el error internamente si falla la persistencia', async () => {
      const loggerErrorSpy = jest
        .spyOn((service as any).logger, 'error')
        .mockImplementation(() => {});
      auditLogModelMock.create.mockRejectedValue(
        new Error('connection refused'),
      );

      service.logAsync({
        action: 'X',
        entity: 'Y',
        userId: 'u',
        success: false,
      });
      await Promise.resolve(); // flush de microtasks del .catch

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save audit log'),
        expect.any(String),
      );
      loggerErrorSpy.mockRestore();
    });
  });

  describe('findAll', () => {
    it('consulta sin filtros cuando no se pasan', async () => {
      auditLogModelMock.find.mockReturnValue(buildQueryMock([]));

      await service.findAll();

      expect(auditLogModelMock.find).toHaveBeenCalledWith({});
    });

    it('aplica filtros simples', async () => {
      auditLogModelMock.find.mockReturnValue(buildQueryMock([]));

      await service.findAll({
        userId: 'user-1',
        entity: 'WeeklyRoutine',
        action: 'CREATE_WEEKLY_ROUTINE',
        success: true,
      });

      expect(auditLogModelMock.find).toHaveBeenCalledWith({
        userId: 'user-1',
        entity: 'WeeklyRoutine',
        action: 'CREATE_WEEKLY_ROUTINE',
        success: true,
      });
    });

    it('construye rango de timestamps con startDate y endDate', async () => {
      auditLogModelMock.find.mockReturnValue(buildQueryMock([]));
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-31');

      await service.findAll({ startDate: start, endDate: end });

      expect(auditLogModelMock.find).toHaveBeenCalledWith({
        timestamp: { $gte: start, $lte: end },
      });
    });

    it('acepta solo startDate en el rango', async () => {
      auditLogModelMock.find.mockReturnValue(buildQueryMock([]));
      const start = new Date('2026-01-01');

      await service.findAll({ startDate: start });

      expect(auditLogModelMock.find).toHaveBeenCalledWith({
        timestamp: { $gte: start },
      });
    });

    it('ordena por timestamp descendente y limita a 100', async () => {
      const query = buildQueryMock([]);
      auditLogModelMock.find.mockReturnValue(query);

      await service.findAll({ userId: 'u' });

      expect(query.sort).toHaveBeenCalledWith({ timestamp: -1 });
      expect(query.limit).toHaveBeenCalledWith(100);
    });
  });

  describe('findByUser', () => {
    it('filtra por usuario con límite por defecto de 50', async () => {
      const logs = [{ id: 'log-1' }];
      const query = buildQueryMock(logs);
      auditLogModelMock.find.mockReturnValue(query);

      const result = await service.findByUser('user-1');

      expect(auditLogModelMock.find).toHaveBeenCalledWith({ userId: 'user-1' });
      expect(query.limit).toHaveBeenCalledWith(50);
      expect(result).toEqual(logs);
    });

    it('respeta el límite personalizado', async () => {
      const query = buildQueryMock([]);
      auditLogModelMock.find.mockReturnValue(query);

      await service.findByUser('user-1', 10);

      expect(query.limit).toHaveBeenCalledWith(10);
    });
  });
});
