import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { StatsEventPublisher } from './stats-event-publisher';

describe('StatsEventPublisher', () => {
  let publisher: StatsEventPublisher;

  const queueUrl = 'https://sqs.us-east-1.amazonaws.com/123456789012/stats.fifo';

  const configServiceMock = {
    get: jest.fn(),
  };

  const auditLogsServiceMock = {
    logAsync: jest.fn(),
  };

  const sqsSendMock = jest.fn();

  const payload = {
    userId: '507f1f77bcf86cd799439011',
    triggerType: 'WORKOUT_SESSION' as const,
    entityId: '507f1f77bcf86cd799439012',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsEventPublisher,
        { provide: ConfigService, useValue: configServiceMock },
        { provide: AuditLogsService, useValue: auditLogsServiceMock },
      ],
    }).compile();

    publisher = module.get<StatsEventPublisher>(StatsEventPublisher);
  });

  const enablePublisher = () => {
    (publisher as any).queueUrl = queueUrl;
    (publisher as any).sqsClient = { send: sqsSendMock };
  };

  describe('publish with SQS configured', () => {
    beforeEach(() => {
      enablePublisher();
    });

    it('warns and returns early when the queue URL is not configured (no DLQ, no send)', async () => {
      (publisher as any).queueUrl = undefined;
      (publisher as any).sqsClient = undefined;

      const warnSpy = jest
        .spyOn((publisher as any).logger, 'warn')
        .mockImplementation(() => {});

      await publisher.handleWorkoutSessionSaved(payload);

      expect(warnSpy).toHaveBeenCalled();
      expect(sqsSendMock).not.toHaveBeenCalled();
      expect(auditLogsServiceMock.logAsync).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('sends the event payload and logs SQS_PUBLISH_SUCCESS with the messageId', async () => {
      sqsSendMock.mockResolvedValue({ MessageId: 'msg-123' });
      const logSpy = jest
        .spyOn((publisher as any).logger, 'log')
        .mockImplementation(() => {});

      await publisher.handleWorkoutSessionSaved(payload);

      expect(sqsSendMock).toHaveBeenCalledTimes(1);
      const command = sqsSendMock.mock.calls[0][0];
      expect(command.input.QueueUrl).toBe(queueUrl);
      expect(command.input.MessageGroupId).toBe(`stats-${payload.userId}`);
      expect(command.input.MessageDeduplicationId).toMatch(
        new RegExp(
          `^${payload.userId}-${payload.triggerType}-${payload.entityId}-\\d+$`,
        ),
      );

      const messageBody = JSON.parse(command.input.MessageBody);
      expect(messageBody.userId).toBe(payload.userId);
      expect(messageBody.triggerType).toBe(payload.triggerType);
      expect(messageBody.entityId).toBe(payload.entityId);
      expect(typeof messageBody.timestamp).toBe('string');

      expect(command.input.MessageAttributes).toEqual({
        triggerType: { DataType: 'String', StringValue: payload.triggerType },
      });

      expect(auditLogsServiceMock.logAsync).toHaveBeenCalledTimes(1);
      expect(auditLogsServiceMock.logAsync).toHaveBeenCalledWith({
        action: 'SQS_PUBLISH_SUCCESS',
        entity: 'StatsEventPublisher',
        userId: payload.userId,
        success: true,
        metadata: {
          triggerType: payload.triggerType,
          entityId: payload.entityId,
          queueUrl,
          messageId: 'msg-123',
        },
      });
      expect(logSpy).toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it('logs SQS_PUBLISH_FAILED with full metadata when send rejects', async () => {
      const error = new Error('SQS connection refused');
      sqsSendMock.mockRejectedValue(error);
      const errorSpy = jest
        .spyOn((publisher as any).logger, 'error')
        .mockImplementation(() => {});

      await publisher.handleWeekLogFinalized({
        ...payload,
        triggerType: 'WEEK_LOG_FINALIZED',
      });

      expect(auditLogsServiceMock.logAsync).toHaveBeenCalledTimes(1);
      expect(auditLogsServiceMock.logAsync).toHaveBeenCalledWith({
        action: 'SQS_PUBLISH_FAILED',
        entity: 'StatsEventPublisher',
        userId: payload.userId,
        success: false,
        errorMessage: 'SQS connection refused',
        metadata: {
          triggerType: 'WEEK_LOG_FINALIZED',
          entityId: payload.entityId,
          queueUrl,
          stack: expect.any(String),
          timestamp: expect.any(Number),
        },
      });
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('normalizes a non-Error rejection into an error message', async () => {
      sqsSendMock.mockRejectedValue('plain error value');

      await publisher.handleWorkoutSessionSaved(payload);

      expect(auditLogsServiceMock.logAsync).toHaveBeenCalledTimes(1);
      const logged = auditLogsServiceMock.logAsync.mock.calls[0][0];
      expect(logged.success).toBe(false);
      expect(logged.errorMessage).toBe('plain error value');
    });
  });

  describe('publishToSqs receives the correct payload from both listeners', () => {
    it('workout-session.saved routes a WORKOUT_SESSION event', async () => {
      enablePublisher();
      sqsSendMock.mockResolvedValue({ MessageId: 'msg-1' });

      await publisher.handleWorkoutSessionSaved(payload);

      const command = sqsSendMock.mock.calls[0][0];
      const messageBody = JSON.parse(command.input.MessageBody);
      expect(messageBody.triggerType).toBe('WORKOUT_SESSION');
    });

    it('week-log.finalized routes a WEEK_LOG_FINALIZED event', async () => {
      enablePublisher();
      sqsSendMock.mockResolvedValue({ MessageId: 'msg-1' });

      await publisher.handleWeekLogFinalized({
        ...payload,
        triggerType: 'WEEK_LOG_FINALIZED',
      });

      const command = sqsSendMock.mock.calls[0][0];
      const messageBody = JSON.parse(command.input.MessageBody);
      expect(messageBody.triggerType).toBe('WEEK_LOG_FINALIZED');
    });
  });
});