import { Module } from '@nestjs/common';

import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentProcessing } from './entities/document-processing.entity';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { DocumentProcessingService } from './document-processing.service';
import { S3StorageService } from '../storage/s3-storage.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'document-processing',
    }),
    TypeOrmModule.forFeature([DocumentProcessing]),
    RedisModule,
  ],
  providers: [DocumentsService, DocumentProcessingService, S3StorageService],
  controllers: [DocumentsController],
  exports: [DocumentsService, DocumentProcessingService, S3StorageService],
})
export class DocumentsModule {}
