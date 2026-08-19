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
    this.sqsClient = new SQSClient({ region });
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
      this.logger.debug(
        `SQS not configured — skipping publish for ${payload.triggerType}`,
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
