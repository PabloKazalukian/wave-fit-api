import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SQSClient,
  SendMessageCommand,
} from '@aws-sdk/client-sqs';
import { OnEvent } from '@nestjs/event-emitter';

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

  constructor(private readonly configService: ConfigService) {}

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
        `[stats] No se pudo entregar la estadística al worker/Lambda (aún no disponible/no configurado). ` +
          `Evento ${payload.triggerType} para usuario ${payload.userId} (entityId ${payload.entityId}) no fue procesado. ` +
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
      await this.sqsClient.send(
        new SendMessageCommand({
          QueueUrl: this.queueUrl,
          MessageBody: JSON.stringify(message),
          MessageGroupId: 'workout-session-group',
          MessageDeduplicationId: `${Date.now()}-${Math.random()}`,
          MessageAttributes: {
            triggerType: {
              DataType: 'String',
              StringValue: payload.triggerType,
            },
          },
        }),
      );
      this.logger.log(
        `Published ${payload.triggerType} event for user ${payload.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish ${payload.triggerType} to SQS: ${error.message}`,
      );
    }
  }
}
