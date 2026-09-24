import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SQSClient,
  SendMessageCommand,
} from '@aws-sdk/client-sqs';
import { OnEvent } from '@nestjs/event-emitter';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

export interface StatsTriggerEvent {
  userId: string;
  triggerType: 'WORKOUT_SESSION' | 'WEEK_LOG_FINALIZED';
  entityId: string;
}

@Injectable()
export class StatsEventPublisher implements OnModuleInit {
  private readonly logger = new Logger(StatsEventPublisher.name);
  private sqsClient: SQSClient;
  private queueUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  onModuleInit() {
    const region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    const queueUrl = this.configService.get<string>('STATS_SQS_QUEUE_URL');

    if (!queueUrl) {
      this.logger.warn(
        'STATS_SQS_QUEUE_URL not configured — SQS publishing disabled',
      );
      return;
    }

    this.queueUrl = queueUrl;
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_KEY');

    this.sqsClient = new SQSClient(
      accessKeyId && secretAccessKey
        ? {
            region,
            credentials: {
              accessKeyId,
              secretAccessKey,
            },
          }
        : { region },
    );
    this.logger.log(`SQS publisher initialized for queue: ${queueUrl}`);
  }

  @OnEvent('workout-session.saved')
  async handleWorkoutSessionSaved(payload: StatsTriggerEvent) {
    await this.publishToSqs(payload);
  }

  @OnEvent('week-log.finalized')
  async handleWeekLogFinalized(payload: StatsTriggerEvent) {
    await this.publishToSqs(payload);
  }

  private async publishToSqs(payload: StatsTriggerEvent) {
    if (!this.sqsClient || !this.queueUrl) {
      this.logger.warn(
        `[stats] STATS_SQS_QUEUE_URL not configured. ` +
          `Evento ${payload.triggerType} para usuario ${payload.userId} ` +
          `(entityId ${payload.entityId}) no fue procesado. ` +
          `Configura STATS_SQS_QUEUE_URL y despliega el Lambda para habilitar el cómputo de métricas.`,
      );
      return;
    }

    const message = {
      userId: payload.userId,
      triggerType: payload.triggerType,
      entityId: payload.entityId,
      timestamp: new Date().toISOString(),
    };

    try {
      const result = await this.sqsClient.send(
        new SendMessageCommand({
          QueueUrl: this.queueUrl,
          MessageBody: JSON.stringify(message),
          MessageGroupId: `stats-${payload.userId}`,
          MessageDeduplicationId: `${payload.userId}-${payload.triggerType}-${payload.entityId}-${Date.now()}`,
          MessageAttributes: {
            triggerType: {
              DataType: 'String',
              StringValue: payload.triggerType,
            },
          },
        }),
      );

      this.auditLogsService.logAsync({
        action: 'SQS_PUBLISH_SUCCESS',
        entity: 'StatsEventPublisher',
        userId: payload.userId,
        success: true,
        metadata: {
          triggerType: payload.triggerType,
          entityId: payload.entityId,
          queueUrl: this.queueUrl,
          messageId: result?.MessageId,
        },
      });

      this.logger.log(
        `Published ${payload.triggerType} event for user ${payload.userId}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.auditLogsService.logAsync({
        action: 'SQS_PUBLISH_FAILED',
        entity: 'StatsEventPublisher',
        userId: payload.userId,
        success: false,
        errorMessage,
        metadata: {
          triggerType: payload.triggerType,
          entityId: payload.entityId,
          queueUrl: this.queueUrl,
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: Date.now(),
        },
      });

      this.logger.error(
        `Failed to publish ${payload.triggerType} to SQS: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}