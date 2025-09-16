import {
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  Body,
  Get,
  Delete,
  Param,
  Req,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { DocumentUploadDto } from './dto/document-upload.dto';
import { multerConfig } from './multer.config';
import { Body as RawBody } from '@nestjs/common';


@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  /**
   * Get document processing status and results by fileId
   */
  @Get('processing/:fileId')
  async getProcessingStatus(@Param('fileId') fileId: string, @Req() req: any) {
    const processing = await this.documentsService.getProcessingStatus(fileId, req?.user?.id);
    if (!processing) return { error: 'Not found' };
    return processing;
  }

  /**
   * Get all documents for the authenticated user
   */
  @Get('me')
  async getMyDocuments(@Req() req: any) {
    return this.documentsService.getUserDocuments(req?.user?.id);
  }

  /**
   * Delete all documents for the authenticated user
   */
  @Delete('me')
  async deleteMyDocuments(@Req() req: any) {
    return this.documentsService.deleteUserDocuments(req?.user?.id);
  }

  /**
   * Delete a single document for the authenticated user
   */
  @Delete(':fileId')
  async deleteMyDocument(@Param('fileId') fileId: string, @Req() req: any) {
    return this.documentsService.deleteUserDocument(fileId, req?.user?.id);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async uploadFile(
  @UploadedFile() file: any,
    @Body() dto: DocumentUploadDto,
    @Req() req: any,
  ) {
    try {
      // TODO: Track upload progress and send webhook updates
      // TODO: Support resumable uploads (chunked/tus)
      const result = await this.documentsService.handleUpload(file, req?.user?.id);
      // TODO: Send webhook notification for upload completion
      return result;
    } catch (error) {
      // Return error details for validation/virus scan failures
      return { error: error.message };
    }
  }

  @Post('upload/batch')
  @UseInterceptors(FilesInterceptor('files', 10, multerConfig))
  async uploadFiles(
  @UploadedFiles() files: any[],
    @Body() dto: DocumentUploadDto,
    @Req() req: any,
  ) {
    // TODO: Track batch upload progress and send webhook updates
    // TODO: Support resumable batch uploads
    const results = await Promise.all(
      files.map(async (file) => {
        try {
          return await this.documentsService.handleUpload(file, req?.user?.id);
        } catch (error) {
          return { error: error.message };
        }
      }),
    );
    // TODO: Send webhook notification for batch upload completion
    return results;
  }

  /**
   * Poll upload progress by fileId
   */
  @Get('progress/:fileId')
  async getUploadProgress(@Param('fileId') fileId: string) {
    const percent = await this.documentsService.getProgressAsync(fileId);
    return { fileId, progress: percent };
  }

  /**
   * Register a webhook URL for upload progress notifications
   */
  @Post('webhook/:fileId')
  async registerWebhook(
    @Param('fileId') fileId: string,
    @RawBody() body: { url: string },
  ) {
    this.documentsService.setWebhook(fileId, body.url);
    return { fileId, webhook: body.url };
  }

  /**
   * Multipart upload (S3) — initialize
   */
  @Post('upload/multipart/init')
  async initMultipart(@Body() body: { mimetype: string; totalParts?: number }) {
    return this.documentsService.initMultipartUpload(body.mimetype, body.totalParts);
  }

  /**
   * Multipart upload (S3) — upload a part
   */
  @Post('upload/multipart/part')
  @UseInterceptors(FileInterceptor('chunk'))
  async uploadMultipartPart(
    @UploadedFile() chunk,
    @Body() body: { fileId: string; uploadId: string; key: string; partNumber: number },
  ) {
    return this.documentsService.uploadMultipartPart(
      body.fileId,
      body.uploadId,
      body.key,
      Number(body.partNumber),
      chunk.buffer,
    );
  }

  /**
   * Multipart upload (S3) — complete
   */
  @Post('upload/multipart/complete')
  async completeMultipart(
    @Body()
    body: {
      fileId: string;
      uploadId: string;
      key: string;
      parts: { ETag: string; PartNumber: number }[];
      mimetype: string;
    },
    @Req() req: any,
  ) {
    return this.documentsService.completeMultipartUpload(
      body.fileId,
      body.uploadId,
      body.key,
      body.parts,
      req?.user?.id,
      body.mimetype,
    );
  }
}
