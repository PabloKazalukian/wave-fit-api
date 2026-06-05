import { Injectable } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import * as dotenv from 'dotenv';
dotenv.config();

@Injectable()
export class StorageService {
  readonly AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY as string;
  readonly AWS_SECRET_KEY = process.env.AWS_SECRET_KEY as string;
  readonly AWS_REGION = process.env.AWS_REGION as string;

  private readonly s3 = new S3Client({
    region: this.AWS_REGION,

    credentials: {
      accessKeyId: this.AWS_ACCESS_KEY,
      secretAccessKey: this.AWS_SECRET_KEY,
    },
  });

  async uploadFile(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  }
}
