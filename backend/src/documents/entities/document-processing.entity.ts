import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum DocumentProcessingStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRY = 'retry',
}

@Entity('document_processing')
export class DocumentProcessing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  fileId: string;

  @Column({ type: 'enum', enum: DocumentProcessingStatus, default: DocumentProcessingStatus.QUEUED })
  status: DocumentProcessingStatus;

  @Column({ type: 'jsonb', nullable: true })
  ocrResult?: any;

  @Column({ type: 'varchar', nullable: true })
  documentType?: string;

  @Column({ type: 'jsonb', nullable: true })
  extractedData?: any;

  @Column({ type: 'jsonb', nullable: true })
  authenticityCheck?: any;

  @Column({ type: 'jsonb', nullable: true })
  imageQuality?: any;

  @Column({ type: 'jsonb', nullable: true })
  faceMatch?: any;

  @Column({ type: 'jsonb', nullable: true })
  duplicateCheck?: any;

  // Storage metadata
  @Column({ type: 'varchar', nullable: true })
  bucket?: string;

  @Column({ type: 'varchar', nullable: true })
  objectKey?: string;

  @Column({ type: 'varchar', nullable: true })
  thumbnailKey?: string;

  @Column({ type: 'varchar', nullable: true })
  mimeType?: string;

  @Column({ type: 'varchar', nullable: true })
  etag?: string;

  @Column({ type: 'int', nullable: true })
  size?: number;


  @Column({ type: 'varchar', nullable: false })
  userId: string;

  @Column({ type: 'jsonb', nullable: true })
  error?: any;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
