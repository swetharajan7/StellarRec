import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { ConversionService } from './conversionService';
import { OCRService } from './ocrService';
import { PreviewService } from './previewService';
import { MetadataExtractionService } from './metadataExtractionService';
import { IndexingService } from './indexingService';

export interface ProcessingJob {
  id: string;
  fileId: string;
  userId: string;
  jobType: 'conversion' | 'ocr' | 'preview' | 'metadata' | 'indexing' | 'full';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  inputFormat: string;
  outputFormat?: string;
  parameters: any;
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface ProcessingResult {
  jobId: string;
  success: boolean;
  result?: any;
  error?: string;
  processingTime: number;
}

export class DocumentProcessingService {
  private conversionService: ConversionService;
  private ocrService: OCRService;
  private previewService: PreviewService;
  private metadataService: MetadataExtractionService;
  private indexingService: IndexingService;

  constructor(private prisma: PrismaClient) {
    this.conversionService = new ConversionService();
    this.ocrService = new OCRService();
    this.previewService = new PreviewService();
    this.metadataService = new MetadataExtractionService();
    this.indexingService = new IndexingService();
  }

  async createProcessingJob(
    fileId: string,
    userId: string,
    jobType: ProcessingJob['jobType'],
    inputFormat: string,
    parameters: any = {},
    outputFormat?: string
  ): Promise<ProcessingJob> {
    try {
      const job = await this.prisma.processing_jobs.create({
        data: {
          id: uuidv4(),
          file_id: fileId,
          user_id: userId,
          job_type: jobType,
          status: 'pending',
          progress: 0,
          input_format: inputFormat,
          output_format: outputFormat,
          parameters: parameters,
          created_at: new Date(),
          updated_at: new Date()
        }
      });

      logger.info(`Processing job created: ${job.id} (${jobType})`);
      return job as ProcessingJob;
    } catch (error) {
      logger.error('Error creating processing job:', error);
      throw error;
    }
  }

  async processDocument(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    jobType: ProcessingJob['jobType'],
    parameters: any = {}
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const jobId = uuidv4();

    try {
      logger.info(`Starting document processing: ${jobId} (${jobType})`);

      let result: any;

      switch (jobType) {
        case 'conversion':
          result = await this.conversionService.convertDocument(
            buffer,
            mimeType,
            parameters.targetFormat,
            parameters.options
          );
          break;

        case 'ocr':
          result = await this.ocrService.extractTextFromImage(
            buffer,
            parameters.language || 'eng',
            parameters.options
          );
          break;

        case 'preview':
          result = await this.previewService.generatePreview(
            buffer,
            mimeType,
            parameters.previewType || 'thumbnail',
            parameters.options
          );
          break;

        case 'metadata':
          result = await this.metadataService.extractMetadata(
            buffer,
            mimeType,
            filename
          );
          break;

        case 'indexing':
          result = await this.indexingService.indexDocument(
            buffer,
            mimeType,
            filename,
            parameters.documentId
          );
          break;

        case 'full':
          result = await this.processDocumentFull(buffer, mimeType, filename, parameters);
          break;

        default:
          throw new Error(`Unsupported job type: ${jobType}`);
      }

      const processingTime = Date.now() - startTime;
      logger.info(`Document processing completed: ${jobId} (${processingTime}ms)`);

      return {
        jobId,
        success: true,
        result,
        processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error(`Document processing failed: ${jobId}`, error);

      return {
        jobId,
        success: false,
        error: error.message,
        processingTime
      };
    }
  }

  private async processDocumentFull(
    buffer: Buffer,
    mimeType: string,
    filename: string,
    parameters: any
  ): Promise<any> {
    const results: any = {
      metadata: null,
      preview: null,
      text: null,
      conversions: {},
      indexing: null
    };

    try {
      // Extract metadata
      results.metadata = await this.metadataService.extractMetadata(
        buffer,
        mimeType,
        filename
      );

      // Generate preview
      results.preview = await this.previewService.generatePreview(
        buffer,
        mimeType,
        'thumbnail'
      );

      // Extract text (OCR for images, direct extraction for documents)
      if (mimeType.startsWith('image/')) {
        results.text = await this.ocrService.extractTextFromImage(
          buffer,
          parameters.language || 'eng'
        );
      } else {
        results.text = await this.extractTextFromDocument(buffer, mimeType);
      }

      // Convert to common formats if requested
      if (parameters.convertTo && Array.isArray(parameters.convertTo)) {
        for (const targetFormat of parameters.convertTo) {
          try {
            results.conversions[targetFormat] = await this.conversionService.convertDocument(
              buffer,
              mimeType,
              targetFormat
            );
          } catch (error) {
            logger.warn(`Conversion to ${targetFormat} failed:`, error);
            results.conversions[targetFormat] = { error: error.message };
          }
        }
      }

      // Index document if document ID provided
      if (parameters.documentId) {
        results.indexing = await this.indexingService.indexDocument(
          buffer,
          mimeType,
          filename,
          parameters.documentId
        );
      }

      return results;
    } catch (error) {
      logger.error('Full document processing failed:', error);
      throw error;
    }
  }

  private async extractTextFromDocument(buffer: Buffer, mimeType: string): Promise<string> {
    // This would use libraries like pdf-parse, mammoth, etc.
    // For now, return a placeholder
    switch (mimeType) {
      case 'application/pdf':
        // Use pdf-parse or similar
        return 'PDF text extraction not implemented';
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        // Use mammoth or similar
        return 'DOCX text extraction not implemented';
      case 'text/plain':
        return buffer.toString('utf-8');
      default:
        return 'Text extraction not supported for this format';
    }
  }

  async getProcessingJob(jobId: string, userId: string): Promise<ProcessingJob | null> {
    try {
      const job = await this.prisma.processing_jobs.findFirst({
        where: {
          id: jobId,
          user_id: userId
        }
      });

      return job as ProcessingJob;
    } catch (error) {
      logger.error('Error fetching processing job:', error);
      throw error;
    }
  }

  async updateJobProgress(jobId: string, progress: number, status?: ProcessingJob['status']): Promise<void> {
    try {
      const updateData: any = {
        progress,
        updated_at: new Date()
      };

      if (status) {
        updateData.status = status;
        if (status === 'completed' || status === 'failed') {
          updateData.completed_at = new Date();
        }
      }

      await this.prisma.processing_jobs.update({
        where: { id: jobId },
        data: updateData
      });

      logger.info(`Job progress updated: ${jobId} - ${progress}%`);
    } catch (error) {
      logger.error('Error updating job progress:', error);
      throw error;
    }
  }

  async getUserProcessingJobs(
    userId: string,
    filters?: {
      jobType?: string;
      status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ jobs: ProcessingJob[]; total: number }> {
    try {
      const where: any = { user_id: userId };

      if (filters?.jobType) {
        where.job_type = filters.jobType;
      }

      if (filters?.status) {
        where.status = filters.status;
      }

      const [jobs, total] = await Promise.all([
        this.prisma.processing_jobs.findMany({
          where,
          orderBy: { created_at: 'desc' },
          take: filters?.limit || 50,
          skip: filters?.offset || 0
        }),
        this.prisma.processing_jobs.count({ where })
      ]);

      return {
        jobs: jobs as ProcessingJob[],
        total
      };
    } catch (error) {
      logger.error('Error fetching user processing jobs:', error);
      throw error;
    }
  }

  async deleteProcessingJob(jobId: string, userId: string): Promise<boolean> {
    try {
      const result = await this.prisma.processing_jobs.deleteMany({
        where: {
          id: jobId,
          user_id: userId
        }
      });

      return result.count > 0;
    } catch (error) {
      logger.error('Error deleting processing job:', error);
      return false;
    }
  }

  async getProcessingStats(userId?: string): Promise<any> {
    try {
      const where: any = {};
      if (userId) {
        where.user_id = userId;
      }

      const [
        totalJobs,
        jobsByType,
        jobsByStatus,
        recentJobs
      ] = await Promise.all([
        this.prisma.processing_jobs.count({ where }),
        this.prisma.processing_jobs.groupBy({
          by: ['job_type'],
          where,
          _count: { job_type: true }
        }),
        this.prisma.processing_jobs.groupBy({
          by: ['status'],
          where,
          _count: { status: true }
        }),
        this.prisma.processing_jobs.findMany({
          where,
          orderBy: { created_at: 'desc' },
          take: 10,
          select: {
            id: true,
            job_type: true,
            status: true,
            progress: true,
            created_at: true,
            completed_at: true
          }
        })
      ]);

      return {
        total_jobs: totalJobs,
        jobs_by_type: jobsByType,
        jobs_by_status: jobsByStatus,
        recent_jobs: recentJobs
      };
    } catch (error) {
      logger.error('Error fetching processing stats:', error);
      throw error;
    }
  }

  async cleanupOldJobs(olderThanDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await this.prisma.processing_jobs.deleteMany({
        where: {
          created_at: {
            lt: cutoffDate
          },
          status: {
            in: ['completed', 'failed']
          }
        }
      });

      logger.info(`Cleaned up ${result.count} old processing jobs`);
      return result.count;
    } catch (error) {
      logger.error('Error cleaning up old jobs:', error);
      return 0;
    }
  }
}