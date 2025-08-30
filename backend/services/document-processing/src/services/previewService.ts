import sharp from 'sharp';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

export interface PreviewOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  page?: number;
  maxPages?: number;
  backgroundColor?: string;
  crop?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

export interface PreviewResult {
  success: boolean;
  previews: Array<{
    type: 'thumbnail' | 'page' | 'text';
    data: string; // Base64 encoded image or text content
    format: string;
    width?: number;
    height?: number;
    page?: number;
  }>;
  metadata?: {
    totalPages?: number;
    dimensions?: { width: number; height: number };
    format: string;
    size: number;
  };
  error?: string;
}

export class PreviewService {
  private tempDir: string;

  constructor() {
    this.tempDir = process.env.TEMP_DIR || '/tmp';
  }

  async generatePreview(
    buffer: Buffer,
    mimeType: string,
    previewType: 'thumbnail' | 'page' | 'text' | 'all' = 'thumbnail',
    options: PreviewOptions = {}
  ): Promise<PreviewResult> {
    try {
      logger.info(`Generating ${previewType} preview for ${mimeType}`);

      switch (mimeType) {
        case 'application/pdf':
          return await this.generatePDFPreview(buffer, previewType, options);
        
        case 'application/msword':
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          return await this.generateDocumentPreview(buffer, mimeType, previewType, options);
        
        case 'application/vnd.ms-powerpoint':
        case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
          return await this.generatePresentationPreview(buffer, mimeType, previewType, options);
        
        case 'application/vnd.ms-excel':
        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
          return await this.generateSpreadsheetPreview(buffer, mimeType, previewType, options);
        
        case 'text/plain':
        case 'text/rtf':
          return await this.generateTextPreview(buffer, mimeType, previewType, options);
        
        default:
          if (mimeType.startsWith('image/')) {
            return await this.generateImagePreview(buffer, mimeType, previewType, options);
          }
          throw new Error(`Preview generation not supported for ${mimeType}`);
      }

    } catch (error) {
      logger.error('Preview generation failed:', error);
      return {
        success: false,
        previews: [],
        error: error.message
      };
    }
  }

  private async generatePDFPreview(
    buffer: Buffer,
    previewType: string,
    options: PreviewOptions
  ): Promise<PreviewResult> {
    const tempId = uuidv4();
    const inputPath = join(this.tempDir, `pdf_${tempId}.pdf`);
    
    try {
      // Write PDF to temporary file
      await writeFile(inputPath, buffer);

      const previews: any[] = [];
      let metadata: any = {};

      // Extract PDF metadata
      try {
        const pdfData = await pdfParse(buffer);
        metadata = {
          totalPages: pdfData.numpages,
          format: 'PDF',
          size: buffer.length
        };
      } catch (error) {
        logger.warn('Failed to extract PDF metadata:', error);
      }

      if (previewType === 'text' || previewType === 'all') {
        // Extract text content
        try {
          const pdfData = await pdfParse(buffer);
          previews.push({
            type: 'text',
            data: pdfData.text.substring(0, 1000) + (pdfData.text.length > 1000 ? '...' : ''),
            format: 'text/plain'
          });
        } catch (error) {
          logger.warn('Failed to extract PDF text:', error);
        }
      }

      if (previewType === 'thumbnail' || previewType === 'page' || previewType === 'all') {
        // Generate image previews using ImageMagick
        const width = options.width || 300;
        const height = options.height || 400;
        const quality = options.quality || 85;
        const maxPages = options.maxPages || (previewType === 'thumbnail' ? 1 : 5);

        for (let page = 0; page < maxPages; page++) {
          const outputPath = join(this.tempDir, `pdf_preview_${tempId}_${page}.jpg`);
          
          try {
            const command = `convert -density 150 -quality ${quality} -resize ${width}x${height} "${inputPath}[${page}]" "${outputPath}"`;
            await execAsync(command);

            // Read the generated image
            const imageBuffer = await require('fs').promises.readFile(outputPath);
            const base64Image = imageBuffer.toString('base64');

            previews.push({
              type: previewType === 'thumbnail' ? 'thumbnail' : 'page',
              data: `data:image/jpeg;base64,${base64Image}`,
              format: 'image/jpeg',
              width,
              height,
              page: page + 1
            });

            // Clean up page image
            await unlink(outputPath).catch(() => {});

          } catch (error) {
            logger.warn(`Failed to generate preview for page ${page + 1}:`, error);
            break;
          }
        }
      }

      // Clean up temporary file
      await unlink(inputPath).catch(() => {});

      return {
        success: true,
        previews,
        metadata
      };

    } catch (error) {
      // Clean up temporary file
      await unlink(inputPath).catch(() => {});
      throw error;
    }
  }

  private async generateDocumentPreview(
    buffer: Buffer,
    mimeType: string,
    previewType: string,
    options: PreviewOptions
  ): Promise<PreviewResult> {
    const tempId = uuidv4();
    const inputPath = join(this.tempDir, `doc_${tempId}.${mimeType.includes('wordprocessingml') ? 'docx' : 'doc'}`);
    
    try {
      await writeFile(inputPath, buffer);

      const previews: any[] = [];
      const metadata = {
        format: mimeType.includes('wordprocessingml') ? 'DOCX' : 'DOC',
        size: buffer.length
      };

      if (previewType === 'text' || previewType === 'all') {
        // Extract text content
        try {
          if (mimeType.includes('wordprocessingml')) {
            const result = await mammoth.extractRawText({ buffer });
            previews.push({
              type: 'text',
              data: result.value.substring(0, 1000) + (result.value.length > 1000 ? '...' : ''),
              format: 'text/plain'
            });
          } else {
            // For older .doc files, would need additional tools
            previews.push({
              type: 'text',
              data: 'Text extraction from .doc files requires additional processing',
              format: 'text/plain'
            });
          }
        } catch (error) {
          logger.warn('Failed to extract document text:', error);
        }
      }

      if (previewType === 'thumbnail' || previewType === 'page' || previewType === 'all') {
        // Convert document to PDF first, then to image
        const pdfPath = join(this.tempDir, `doc_${tempId}.pdf`);
        const imagePath = join(this.tempDir, `doc_preview_${tempId}.jpg`);

        try {
          // Convert to PDF using LibreOffice
          await execAsync(`libreoffice --headless --convert-to pdf --outdir "${this.tempDir}" "${inputPath}"`);
          
          // Convert PDF to image
          const width = options.width || 300;
          const height = options.height || 400;
          const quality = options.quality || 85;
          
          await execAsync(`convert -density 150 -quality ${quality} -resize ${width}x${height} "${pdfPath}[0]" "${imagePath}"`);

          // Read the generated image
          const imageBuffer = await require('fs').promises.readFile(imagePath);
          const base64Image = imageBuffer.toString('base64');

          previews.push({
            type: 'thumbnail',
            data: `data:image/jpeg;base64,${base64Image}`,
            format: 'image/jpeg',
            width,
            height
          });

          // Clean up temporary files
          await Promise.all([
            unlink(pdfPath).catch(() => {}),
            unlink(imagePath).catch(() => {})
          ]);

        } catch (error) {
          logger.warn('Failed to generate document preview image:', error);
        }
      }

      // Clean up input file
      await unlink(inputPath).catch(() => {});

      return {
        success: true,
        previews,
        metadata
      };

    } catch (error) {
      await unlink(inputPath).catch(() => {});
      throw error;
    }
  }

  private async generateImagePreview(
    buffer: Buffer,
    mimeType: string,
    previewType: string,
    options: PreviewOptions
  ): Promise<PreviewResult> {
    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();

      const previews: any[] = [];
      const resultMetadata = {
        dimensions: { width: metadata.width || 0, height: metadata.height || 0 },
        format: metadata.format || 'unknown',
        size: buffer.length
      };

      if (previewType === 'thumbnail' || previewType === 'all') {
        // Generate thumbnail
        const width = options.width || 300;
        const height = options.height || 300;
        const quality = options.quality || 85;
        const format = options.format || 'jpeg';

        let thumbnailBuffer: Buffer;
        
        if (format === 'jpeg') {
          thumbnailBuffer = await image
            .resize(width, height, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality })
            .toBuffer();
        } else if (format === 'png') {
          thumbnailBuffer = await image
            .resize(width, height, { fit: 'inside', withoutEnlargement: true })
            .png({ quality })
            .toBuffer();
        } else {
          thumbnailBuffer = await image
            .resize(width, height, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality })
            .toBuffer();
        }

        const base64Thumbnail = thumbnailBuffer.toString('base64');
        
        previews.push({
          type: 'thumbnail',
          data: `data:image/${format};base64,${base64Thumbnail}`,
          format: `image/${format}`,
          width,
          height
        });
      }

      if (previewType === 'page' || previewType === 'all') {
        // For images, page preview is the same as thumbnail but potentially larger
        const width = options.width || 600;
        const height = options.height || 800;
        const quality = options.quality || 90;
        const format = options.format || 'jpeg';

        let previewBuffer: Buffer;
        
        if (format === 'jpeg') {
          previewBuffer = await image
            .resize(width, height, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality })
            .toBuffer();
        } else if (format === 'png') {
          previewBuffer = await image
            .resize(width, height, { fit: 'inside', withoutEnlargement: true })
            .png({ quality })
            .toBuffer();
        } else {
          previewBuffer = await image
            .resize(width, height, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality })
            .toBuffer();
        }

        const base64Preview = previewBuffer.toString('base64');
        
        previews.push({
          type: 'page',
          data: `data:image/${format};base64,${base64Preview}`,
          format: `image/${format}`,
          width,
          height
        });
      }

      return {
        success: true,
        previews,
        metadata: resultMetadata
      };

    } catch (error) {
      throw error;
    }
  }

  private async generateTextPreview(
    buffer: Buffer,
    mimeType: string,
    previewType: string,
    options: PreviewOptions
  ): Promise<PreviewResult> {
    try {
      const text = buffer.toString('utf-8');
      const previews: any[] = [];

      if (previewType === 'text' || previewType === 'all') {
        previews.push({
          type: 'text',
          data: text.substring(0, 1000) + (text.length > 1000 ? '...' : ''),
          format: 'text/plain'
        });
      }

      if (previewType === 'thumbnail' || previewType === 'all') {
        // Generate a text-based thumbnail (first few lines as an image)
        const lines = text.split('\n').slice(0, 10);
        const previewText = lines.join('\n');
        
        // This would require a text-to-image conversion
        // For now, return the text content
        previews.push({
          type: 'thumbnail',
          data: previewText,
          format: 'text/plain'
        });
      }

      return {
        success: true,
        previews,
        metadata: {
          format: 'Text',
          size: buffer.length
        }
      };

    } catch (error) {
      throw error;
    }
  }

  private async generatePresentationPreview(
    buffer: Buffer,
    mimeType: string,
    previewType: string,
    options: PreviewOptions
  ): Promise<PreviewResult> {
    // Similar to document preview but for presentations
    return await this.generateDocumentPreview(buffer, mimeType, previewType, options);
  }

  private async generateSpreadsheetPreview(
    buffer: Buffer,
    mimeType: string,
    previewType: string,
    options: PreviewOptions
  ): Promise<PreviewResult> {
    // Similar to document preview but for spreadsheets
    return await this.generateDocumentPreview(buffer, mimeType, previewType, options);
  }

  async generateMultipleFormats(
    buffer: Buffer,
    mimeType: string,
    formats: Array<{ type: string; options: PreviewOptions }>
  ): Promise<PreviewResult[]> {
    const results: PreviewResult[] = [];

    for (const format of formats) {
      try {
        const result = await this.generatePreview(
          buffer,
          mimeType,
          format.type as any,
          format.options
        );
        results.push(result);
      } catch (error) {
        logger.error(`Failed to generate ${format.type} preview:`, error);
        results.push({
          success: false,
          previews: [],
          error: error.message
        });
      }
    }

    return results;
  }

  async getSupportedFormats(): Promise<{
    input: string[];
    output: string[];
    previewTypes: string[];
  }> {
    return {
      input: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/rtf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/tiff',
        'image/bmp',
        'image/webp'
      ],
      output: [
        'image/jpeg',
        'image/png',
        'image/webp',
        'text/plain'
      ],
      previewTypes: [
        'thumbnail',
        'page',
        'text',
        'all'
      ]
    };
  }
}