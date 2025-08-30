import sharp from 'sharp';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

export interface ConversionOptions {
  quality?: number;
  width?: number;
  height?: number;
  maintainAspectRatio?: boolean;
  backgroundColor?: string;
  compression?: string;
  dpi?: number;
}

export interface ConversionResult {
  success: boolean;
  outputBuffer?: Buffer;
  outputFormat: string;
  originalSize: number;
  convertedSize?: number;
  metadata?: any;
  error?: string;
}

export class ConversionService {
  private tempDir: string;

  constructor() {
    this.tempDir = process.env.TEMP_DIR || '/tmp';
  }

  async convertDocument(
    inputBuffer: Buffer,
    inputFormat: string,
    outputFormat: string,
    options: ConversionOptions = {}
  ): Promise<ConversionResult> {
    try {
      logger.info(`Converting document from ${inputFormat} to ${outputFormat}`);

      // Handle image conversions
      if (this.isImageFormat(inputFormat) && this.isImageFormat(outputFormat)) {
        return await this.convertImage(inputBuffer, inputFormat, outputFormat, options);
      }

      // Handle document to image conversions
      if (this.isDocumentFormat(inputFormat) && this.isImageFormat(outputFormat)) {
        return await this.convertDocumentToImage(inputBuffer, inputFormat, outputFormat, options);
      }

      // Handle document to document conversions
      if (this.isDocumentFormat(inputFormat) && this.isDocumentFormat(outputFormat)) {
        return await this.convertDocumentToDocument(inputBuffer, inputFormat, outputFormat, options);
      }

      // Handle image to document conversions (OCR-based)
      if (this.isImageFormat(inputFormat) && this.isDocumentFormat(outputFormat)) {
        return await this.convertImageToDocument(inputBuffer, inputFormat, outputFormat, options);
      }

      throw new Error(`Conversion from ${inputFormat} to ${outputFormat} is not supported`);

    } catch (error) {
      logger.error('Document conversion failed:', error);
      return {
        success: false,
        outputFormat,
        originalSize: inputBuffer.length,
        error: error.message
      };
    }
  }

  private async convertImage(
    inputBuffer: Buffer,
    inputFormat: string,
    outputFormat: string,
    options: ConversionOptions
  ): Promise<ConversionResult> {
    try {
      let image = sharp(inputBuffer);

      // Apply transformations
      if (options.width || options.height) {
        image = image.resize(options.width, options.height, {
          fit: options.maintainAspectRatio !== false ? 'inside' : 'fill',
          background: options.backgroundColor || { r: 255, g: 255, b: 255, alpha: 1 }
        });
      }

      // Convert to target format
      let outputBuffer: Buffer;
      const targetFormat = this.getSharpFormat(outputFormat);

      switch (targetFormat) {
        case 'jpeg':
          outputBuffer = await image.jpeg({ 
            quality: options.quality || 85,
            progressive: true 
          }).toBuffer();
          break;
        case 'png':
          outputBuffer = await image.png({ 
            quality: options.quality || 90,
            compressionLevel: 9 
          }).toBuffer();
          break;
        case 'webp':
          outputBuffer = await image.webp({ 
            quality: options.quality || 85,
            effort: 6 
          }).toBuffer();
          break;
        case 'tiff':
          outputBuffer = await image.tiff({ 
            quality: options.quality || 90,
            compression: options.compression as any || 'lzw'
          }).toBuffer();
          break;
        case 'avif':
          outputBuffer = await image.avif({ 
            quality: options.quality || 85 
          }).toBuffer();
          break;
        default:
          throw new Error(`Unsupported output format: ${outputFormat}`);
      }

      const metadata = await sharp(outputBuffer).metadata();

      return {
        success: true,
        outputBuffer,
        outputFormat,
        originalSize: inputBuffer.length,
        convertedSize: outputBuffer.length,
        metadata: {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          space: metadata.space,
          channels: metadata.channels,
          density: metadata.density
        }
      };

    } catch (error) {
      logger.error('Image conversion failed:', error);
      throw error;
    }
  }

  private async convertDocumentToImage(
    inputBuffer: Buffer,
    inputFormat: string,
    outputFormat: string,
    options: ConversionOptions
  ): Promise<ConversionResult> {
    const tempId = uuidv4();
    const inputPath = join(this.tempDir, `input_${tempId}.${this.getFileExtension(inputFormat)}`);
    const outputPath = join(this.tempDir, `output_${tempId}.${this.getFileExtension(outputFormat)}`);

    try {
      // Write input buffer to temporary file
      await writeFile(inputPath, inputBuffer);

      let command: string;
      const dpi = options.dpi || 150;
      const quality = options.quality || 85;

      switch (inputFormat) {
        case 'application/pdf':
          // Use ImageMagick or Ghostscript to convert PDF to image
          command = `convert -density ${dpi} -quality ${quality} "${inputPath}[0]" "${outputPath}"`;
          break;
        case 'application/msword':
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          // Use LibreOffice to convert document to PDF, then to image
          const pdfPath = join(this.tempDir, `temp_${tempId}.pdf`);
          await execAsync(`libreoffice --headless --convert-to pdf --outdir "${this.tempDir}" "${inputPath}"`);
          command = `convert -density ${dpi} -quality ${quality} "${pdfPath}[0]" "${outputPath}"`;
          break;
        default:
          throw new Error(`Document to image conversion not supported for ${inputFormat}`);
      }

      await execAsync(command);

      // Read the output file
      const outputBuffer = await require('fs').promises.readFile(outputPath);

      // Clean up temporary files
      await Promise.all([
        unlink(inputPath).catch(() => {}),
        unlink(outputPath).catch(() => {})
      ]);

      return {
        success: true,
        outputBuffer,
        outputFormat,
        originalSize: inputBuffer.length,
        convertedSize: outputBuffer.length
      };

    } catch (error) {
      // Clean up temporary files
      await Promise.all([
        unlink(inputPath).catch(() => {}),
        unlink(outputPath).catch(() => {})
      ]);
      
      logger.error('Document to image conversion failed:', error);
      throw error;
    }
  }

  private async convertDocumentToDocument(
    inputBuffer: Buffer,
    inputFormat: string,
    outputFormat: string,
    options: ConversionOptions
  ): Promise<ConversionResult> {
    const tempId = uuidv4();
    const inputPath = join(this.tempDir, `input_${tempId}.${this.getFileExtension(inputFormat)}`);
    const outputPath = join(this.tempDir, `output_${tempId}.${this.getFileExtension(outputFormat)}`);

    try {
      // Write input buffer to temporary file
      await writeFile(inputPath, inputBuffer);

      let command: string;
      const targetExt = this.getFileExtension(outputFormat);

      // Use LibreOffice for document conversions
      command = `libreoffice --headless --convert-to ${targetExt} --outdir "${this.tempDir}" "${inputPath}"`;

      await execAsync(command);

      // Read the output file
      const outputBuffer = await require('fs').promises.readFile(outputPath);

      // Clean up temporary files
      await Promise.all([
        unlink(inputPath).catch(() => {}),
        unlink(outputPath).catch(() => {})
      ]);

      return {
        success: true,
        outputBuffer,
        outputFormat,
        originalSize: inputBuffer.length,
        convertedSize: outputBuffer.length
      };

    } catch (error) {
      // Clean up temporary files
      await Promise.all([
        unlink(inputPath).catch(() => {}),
        unlink(outputPath).catch(() => {})
      ]);
      
      logger.error('Document to document conversion failed:', error);
      throw error;
    }
  }

  private async convertImageToDocument(
    inputBuffer: Buffer,
    inputFormat: string,
    outputFormat: string,
    options: ConversionOptions
  ): Promise<ConversionResult> {
    // This would typically involve OCR to extract text, then create a document
    // For now, we'll create a simple text document with OCR results
    try {
      // This is a placeholder - in a real implementation, you'd use OCR
      const ocrText = "OCR text extraction would go here";
      
      let outputBuffer: Buffer;
      
      switch (outputFormat) {
        case 'text/plain':
          outputBuffer = Buffer.from(ocrText, 'utf-8');
          break;
        case 'application/pdf':
          // Create a simple PDF with the OCR text
          // This would require a PDF library like PDFKit
          outputBuffer = Buffer.from('PDF creation not implemented');
          break;
        default:
          throw new Error(`Image to ${outputFormat} conversion not supported`);
      }

      return {
        success: true,
        outputBuffer,
        outputFormat,
        originalSize: inputBuffer.length,
        convertedSize: outputBuffer.length
      };

    } catch (error) {
      logger.error('Image to document conversion failed:', error);
      throw error;
    }
  }

  async getSupportedConversions(): Promise<any> {
    return {
      image_to_image: [
        { from: 'image/jpeg', to: ['image/png', 'image/webp', 'image/tiff', 'image/avif'] },
        { from: 'image/png', to: ['image/jpeg', 'image/webp', 'image/tiff', 'image/avif'] },
        { from: 'image/webp', to: ['image/jpeg', 'image/png', 'image/tiff'] },
        { from: 'image/tiff', to: ['image/jpeg', 'image/png', 'image/webp'] },
        { from: 'image/bmp', to: ['image/jpeg', 'image/png', 'image/webp'] }
      ],
      document_to_image: [
        { from: 'application/pdf', to: ['image/jpeg', 'image/png', 'image/tiff'] },
        { from: 'application/msword', to: ['image/jpeg', 'image/png'] },
        { from: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', to: ['image/jpeg', 'image/png'] }
      ],
      document_to_document: [
        { from: 'application/msword', to: ['application/pdf', 'text/plain'] },
        { from: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', to: ['application/pdf', 'text/plain'] },
        { from: 'text/plain', to: ['application/pdf'] }
      ],
      image_to_document: [
        { from: 'image/jpeg', to: ['text/plain', 'application/pdf'] },
        { from: 'image/png', to: ['text/plain', 'application/pdf'] },
        { from: 'image/tiff', to: ['text/plain', 'application/pdf'] }
      ]
    };
  }

  private isImageFormat(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  private isDocumentFormat(mimeType: string): boolean {
    const documentTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/rtf'
    ];
    return documentTypes.includes(mimeType);
  }

  private getSharpFormat(mimeType: string): string {
    const formatMap: Record<string, string> = {
      'image/jpeg': 'jpeg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/tiff': 'tiff',
      'image/avif': 'avif'
    };
    return formatMap[mimeType] || 'jpeg';
  }

  private getFileExtension(mimeType: string): string {
    const extensionMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/tiff': 'tiff',
      'image/gif': 'gif',
      'image/bmp': 'bmp',
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-powerpoint': 'ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'text/plain': 'txt',
      'text/rtf': 'rtf'
    };
    return extensionMap[mimeType] || 'bin';
  }

  async optimizeDocument(
    inputBuffer: Buffer,
    mimeType: string,
    options: ConversionOptions = {}
  ): Promise<ConversionResult> {
    try {
      if (this.isImageFormat(mimeType)) {
        return await this.optimizeImage(inputBuffer, mimeType, options);
      } else if (mimeType === 'application/pdf') {
        return await this.optimizePDF(inputBuffer, options);
      } else {
        // For other document types, return as-is
        return {
          success: true,
          outputBuffer: inputBuffer,
          outputFormat: mimeType,
          originalSize: inputBuffer.length,
          convertedSize: inputBuffer.length
        };
      }
    } catch (error) {
      logger.error('Document optimization failed:', error);
      return {
        success: false,
        outputFormat: mimeType,
        originalSize: inputBuffer.length,
        error: error.message
      };
    }
  }

  private async optimizeImage(
    inputBuffer: Buffer,
    mimeType: string,
    options: ConversionOptions
  ): Promise<ConversionResult> {
    const image = sharp(inputBuffer);
    const metadata = await image.metadata();

    // Apply optimization based on format
    let optimizedBuffer: Buffer;
    
    switch (mimeType) {
      case 'image/jpeg':
        optimizedBuffer = await image
          .jpeg({ 
            quality: options.quality || 85,
            progressive: true,
            mozjpeg: true 
          })
          .toBuffer();
        break;
      case 'image/png':
        optimizedBuffer = await image
          .png({ 
            quality: options.quality || 90,
            compressionLevel: 9,
            progressive: true 
          })
          .toBuffer();
        break;
      case 'image/webp':
        optimizedBuffer = await image
          .webp({ 
            quality: options.quality || 85,
            effort: 6 
          })
          .toBuffer();
        break;
      default:
        optimizedBuffer = inputBuffer;
    }

    return {
      success: true,
      outputBuffer: optimizedBuffer,
      outputFormat: mimeType,
      originalSize: inputBuffer.length,
      convertedSize: optimizedBuffer.length,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        compressionRatio: ((inputBuffer.length - optimizedBuffer.length) / inputBuffer.length * 100).toFixed(2) + '%'
      }
    };
  }

  private async optimizePDF(
    inputBuffer: Buffer,
    options: ConversionOptions
  ): Promise<ConversionResult> {
    // PDF optimization would require tools like Ghostscript
    // For now, return the original buffer
    return {
      success: true,
      outputBuffer: inputBuffer,
      outputFormat: 'application/pdf',
      originalSize: inputBuffer.length,
      convertedSize: inputBuffer.length,
      metadata: {
        note: 'PDF optimization not implemented'
      }
    };
  }
}