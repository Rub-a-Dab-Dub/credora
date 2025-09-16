  import { Express } from 'express';
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentProcessing, DocumentProcessingStatus } from './entities/document-processing.entity';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import * as clamav from 'clamav.js';

import * as sharp from 'sharp';
import axios from 'axios';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  CLAMAV_HOST,
  CLAMAV_PORT,
  WEBHOOK_SECRET,
} from './config';
import { S3StorageService } from '../storage/s3-storage.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectQueue('document-processing') private readonly documentProcessingQueue: Queue,
    @InjectRepository(DocumentProcessing)
    private readonly documentProcessingRepository: Repository<DocumentProcessing>,
    private readonly s3: S3StorageService,
    private readonly redis: RedisService,
  ) {}
  /**
   * Get all documents for a user
   */
  async getUserDocuments(userId: string) {
    return this.documentProcessingRepository.find({ where: { userId } });
  }

  /**
   * Delete all documents for a user (retention policy)
   */
  async deleteUserDocuments(userId: string) {
    const docs = await this.getUserDocuments(userId);
    for (const doc of docs) {
      // Best-effort delete of S3 objects
      try {
        if (doc.objectKey) {
          await this.s3.deleteObject(doc.objectKey);
        }
        if (doc.thumbnailKey) {
          await this.s3.deleteObject(doc.thumbnailKey);
        }
      } catch (e) {
        // Surface errors to caller; we fail fast to avoid DB drift vs storage
        throw e;
      }
    }
    await this.documentProcessingRepository.delete({ userId });
    return { status: 'deleted', userId, count: docs.length };
  }

  /**
   * Delete a single document by fileId for the given user
   */
  async deleteUserDocument(fileId: string, userId: string) {
    const doc = await this.documentProcessingRepository.findOne({ where: { fileId, userId } });
    if (!doc) {
      return { status: 'not_found', fileId };
    }
    try {
      if (doc.objectKey) await this.s3.deleteObject(doc.objectKey);
      if (doc.thumbnailKey) await this.s3.deleteObject(doc.thumbnailKey);
    } catch (e) {
      throw e;
    }
    await this.documentProcessingRepository.delete({ id: doc.id });
    return { status: 'deleted', fileId };
  }

  /**
   * Get document processing status and results by fileId
   */
  async getProcessingStatus(fileId: string, userId?: string) {
    const where: any = { fileId };
    if (userId) where.userId = userId;
    return this.documentProcessingRepository.findOne({ where });
  }


  /**
   * Set webhook URL for a fileId
   */
  setWebhook(fileId: string, url: string) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') {
        throw new Error('Webhook URL must use HTTPS');
      }
      // persist to redis with TTL 24h
      this.redis.set(this.webhookKey(fileId), url, 60 * 60 * 24);
    } catch (e) {
      throw new Error('Invalid webhook URL');
    }
  }

  /**
   * Notify webhook with progress
   */
  async notifyWebhook(fileId: string, progress: number) {
    const url = await this.redis.get(this.webhookKey(fileId));
    if (!url) return;
    try {
      const timestamp = Date.now().toString();
      const payload = JSON.stringify({ fileId, progress, timestamp });
      const signature = WEBHOOK_SECRET
        ? crypto
            .createHmac('sha256', WEBHOOK_SECRET)
            .update(payload)
            .digest('hex')
        : '';
      await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Timestamp': timestamp,
          ...(WEBHOOK_SECRET ? { 'X-Webhook-Signature': signature } : {}),
        },
        timeout: 5000,
        validateStatus: (_status: number) => true,
      });
    } catch (err) {
      // Ignore webhook errors for now
    }
  }

  /**
   * Set upload progress (0-100)
   */
  setProgress(fileId: string, percent: number) {
    // store progress percent as string with TTL 24h
    this.redis.set(this.progressKey(fileId), String(percent), 60 * 60 * 24);
  }

  private progressKey(fileId: string) {
    return `doc:progress:${fileId}`;
  }

  private webhookKey(fileId: string) {
    return `doc:webhook:${fileId}`;
  }

  private getExtForMime(mimetype?: string): string {
    const map: Record<string, string> = {
      'application/pdf': 'pdf',
      'image/jpeg': 'jpg',
      'image/png': 'png',
    };
    return map[(mimetype || '').toLowerCase()] || 'bin';
  }

  async getProgressAsync(fileId: string): Promise<number> {
    const val = await this.redis.get(this.progressKey(fileId));
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
  }

  private mpTotalKey(fileId: string) {
    return `doc:mp:total:${fileId}`;
  }

  private mpDoneKey(fileId: string) {
    return `doc:mp:done:${fileId}`;
  }

  /**
   * Validate file type and size
   */
  validateFile(file: MulterFile): boolean {
    if (!ALLOWED_MIME_TYPES.includes((file.mimetype || '').toLowerCase())) {
      return false;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return false;
    }
    return true;
  }

  /**
   * Generate a unique file identifier
   */
  generateFileId(): string {
    return uuidv4();
  }

  /**
   * Scan file for viruses using ClamAV
   */
  async scanForViruses(fileBuffer: Buffer): Promise<boolean> {
    return new Promise((resolve, reject) => {
      clamav.ping(CLAMAV_PORT, CLAMAV_HOST, (pingErr: any) => {
        if (pingErr) {
          // ClamAV not available
          return reject(new Error('ClamAV service unavailable'));
        }
        clamav.scanBuffer(
          fileBuffer,
          CLAMAV_PORT,
          CLAMAV_HOST,
          (err: any, object: any, malicious: boolean) => {
            if (err) {
              return reject(new Error('Error scanning file for viruses'));
            }
            if (malicious) {
              return resolve(false);
            }
            return resolve(true);
          },
        );
      });
    });
  }

  /**
   * Main upload handler (to be called from controller)
   */
  async handleUpload(
    file: MulterFile,
    userId?: string,
  ): Promise<{ fileId: string }> {
    if (!this.validateFile(file)) {
      throw new Error('Invalid file type or size');
    }
    // Fail if no userId provided
    if (!userId) {
      throw new Error('Missing userId');
    }

    // Virus scan (fail closed if malicious or if ClamAV unavailable)
    const clean = await this.scanForViruses(file.buffer);
    if (!clean) {
      throw new Error('File failed virus scan');
    }

    const fileId = this.generateFileId();
    this.setProgress(fileId, 10);
    await this.notifyWebhook(fileId, 10);

    // Upload original to S3 with SSE
    const objectKey = `${fileId}/original.${this.getExtForMime(file.mimetype)}`;

    this.setProgress(fileId, 40);
    await this.notifyWebhook(fileId, 40);
    const { etag } = await this.s3.putObject(objectKey, file.buffer, file.mimetype);

    // Generate and upload thumbnail for images
    let thumbnailKey: string | undefined;
    if ((file.mimetype || '').toLowerCase().startsWith('image/')) {
      thumbnailKey = await this.generateAndUploadThumbnail(fileId, file.buffer);
    }
    // Create DocumentProcessing entity for status tracking
    await this.createProcessingRecord(fileId, userId);
    await this.documentProcessingRepository.update(
      { fileId },
      {
        bucket: this.s3.getBucket(),
        objectKey,
        mimeType: file.mimetype,
        size: file.size,
        etag: etag,
        thumbnailKey,
      },
    );
    // Enqueue Bull job for background processing (pass buffer and mimetype)
    await this.documentProcessingQueue.add({ fileId, fileBuffer: file.buffer, mimetype: file.mimetype });
    this.setProgress(fileId, 100);
    await this.notifyWebhook(fileId, 100);
    return { fileId };
  }

  private async generateAndUploadThumbnail(fileId: string, buffer: Buffer) {
    const thumbBuffer = await sharp(buffer)
      .resize({ width: 256, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    const thumbKey = `${fileId}/thumbnail.jpg`;
    await this.s3.putObject(thumbKey, thumbBuffer, 'image/jpeg');
    return thumbKey;
  }

  private async createProcessingRecord(fileId: string, userId: string) {
    const processing = this.documentProcessingRepository.create({
      fileId,
      userId,
      status: DocumentProcessingStatus.QUEUED,
    });
    await this.documentProcessingRepository.save(processing);
  }

  /**
   * Multipart upload flow using S3
   */
  async initMultipartUpload(mimetype: string, totalParts?: number): Promise<{ fileId: string; uploadId: string; key: string }> {
    const fileId = this.generateFileId();
    const key = `${fileId}/original.${this.getExtForMime(mimetype)}`;
    const { uploadId } = await this.s3.createMultipartUpload(key, mimetype);
    this.setProgress(fileId, 1);
    await this.notifyWebhook(fileId, 1);
    if (totalParts && totalParts > 0) {
      await this.redis.set(this.mpTotalKey(fileId), String(totalParts), 60 * 60 * 24);
      await this.redis.set(this.mpDoneKey(fileId), '0', 60 * 60 * 24);
    }
    return { fileId, uploadId, key };
  }

  async uploadMultipartPart(
    _fileId: string,
    uploadId: string,
    key: string,
    partNumber: number,
    buffer: Buffer,
  ): Promise<{ ETag: string; PartNumber: number }> {
    const { etag } = await this.s3.uploadPart(uploadId, key, partNumber, buffer);
    // progress update if totalParts known
    const fileId = key.split('/')[0];
    const totalStr = await this.redis.get(this.mpTotalKey(fileId));
    if (totalStr) {
      const doneStr = await this.redis.get(this.mpDoneKey(fileId));
      const done = Math.max(0, Number(doneStr) || 0) + 1;
      const total = Math.max(1, Number(totalStr) || 1);
      await this.redis.set(this.mpDoneKey(fileId), String(done), 60 * 60 * 24);
      const percent = Math.min(99, Math.floor((done / total) * 90) + 10);
      this.setProgress(fileId, percent);
      await this.notifyWebhook(fileId, percent);
    }
    return { ETag: etag, PartNumber: partNumber };
  }

  async completeMultipartUpload(
    fileId: string,
    uploadId: string,
    key: string,
    parts: { ETag: string; PartNumber: number }[],
    userId?: string,
    mimetype?: string,
  ): Promise<{ fileId: string }> {
    await this.s3.completeMultipartUpload(uploadId, key, parts);
    // Immediately fetch and scan; delete if infected
    const objectBuffer = await this.s3.getObjectBuffer(key);
    const clean = await this.scanForViruses(objectBuffer);
    if (!clean) {
      await this.s3.deleteObject(key);
      throw new Error('File failed virus scan');
    }
    let thumbnailKey: string | undefined;
    if ((mimetype || '').toLowerCase().startsWith('image/')) {
      thumbnailKey = await this.generateAndUploadThumbnail(fileId, objectBuffer);
    }
    if (!userId) {
      throw new Error('Missing userId');
    }
    await this.createProcessingRecord(fileId, userId);
    await this.documentProcessingRepository.update(
      { fileId },
      {
        bucket: this.s3.getBucket(),
        objectKey: key,
        mimeType: mimetype,
        size: objectBuffer.length,
        thumbnailKey,
      },
    );
    await this.documentProcessingQueue.add({ fileId, fileBuffer: objectBuffer, mimetype });
    this.setProgress(fileId, 100);
    await this.notifyWebhook(fileId, 100);
    return { fileId };
  }
}

// Local MulterFile type for upload handling
type MulterFile = {
  buffer: Buffer;
  mimetype: string;
  size: number;
  fieldname: string;
  originalname: string;
  encoding: string;
  destination: string;
  filename: string;
  path: string;
  stream: any;
};
