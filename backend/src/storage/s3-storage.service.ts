import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  PutObjectCommandInput,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  GetObjectCommand,
  GetObjectCommandOutput,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

@Injectable()
export class S3StorageService {
  private client: S3Client;
  private bucket: string;
  private serverSideEncryption?: 'AES256' | 'aws:kms';
  private sseKmsKeyId?: string;

  constructor() {
    const region = process.env.S3_REGION || 'us-east-1';
    this.bucket = process.env.S3_BUCKET || '';

    this.client = new S3Client({
      region,
      credentials: process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID!,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
          }
        : undefined,
    });

    const kmsKey = process.env.S3_KMS_KEY_ID;
    if (kmsKey) {
      this.serverSideEncryption = 'aws:kms';
      this.sseKmsKeyId = kmsKey;
    } else {
      this.serverSideEncryption = 'AES256';
    }
  }

  getBucket(): string {
    return this.bucket;
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<{ etag?: string }> {
    if (!this.bucket) throw new Error('S3 bucket not configured');
    const input: PutObjectCommandInput = {
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ServerSideEncryption: this.serverSideEncryption,
    };
    if (this.sseKmsKeyId && this.serverSideEncryption === 'aws:kms') {
      input.SSEKMSKeyId = this.sseKmsKeyId;
    }
    const res = await this.client.send(new PutObjectCommand(input));
    return { etag: res.ETag };
  }

  async createMultipartUpload(key: string, contentType: string): Promise<{ uploadId: string }> {
    if (!this.bucket) throw new Error('S3 bucket not configured');
    const cmd = new CreateMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ServerSideEncryption: this.serverSideEncryption,
      SSEKMSKeyId: this.sseKmsKeyId,
    });
    const res = await this.client.send(cmd);
    if (!res.UploadId) throw new Error('Failed to create multipart upload');
    return { uploadId: res.UploadId };
  }

  async uploadPart(uploadId: string, key: string, partNumber: number, body: Buffer): Promise<{ etag: string }> {
    const cmd = new UploadPartCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: body,
    });
    const res = await this.client.send(cmd);
    const etag = res.ETag || '';
    return { etag };
  }

  async completeMultipartUpload(uploadId: string, key: string, parts: { PartNumber: number; ETag: string }[]) {
    const cmd = new CompleteMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber) },
    });
    return this.client.send(cmd);
  }

  async abortMultipartUpload(uploadId: string, key: string) {
    const cmd = new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId });
    return this.client.send(cmd);
  }

  async getObjectBuffer(key: string): Promise<Buffer> {
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    const res = (await this.client.send(cmd)) as GetObjectCommandOutput;
    const stream = res.Body as Readable;
    const chunks: Buffer[] = [];
    return await new Promise<Buffer>((resolve, reject) => {
      stream.on('data', (d) => chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  async deleteObject(key: string): Promise<void> {
    const cmd = new DeleteObjectCommand({ Bucket: this.bucket, Key: key });
    await this.client.send(cmd);
  }
}
