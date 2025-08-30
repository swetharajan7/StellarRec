import sharp from 'sharp';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

export interface DocumentMetadata {
  // Basic file information
  filename: string;
  mimeType: string;
  size: number;
  checksum?: string;
  
  // Document properties
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  keywords?: string[];
  description?: string;
  
  // Dates
  creationDate?: Date;
  modificationDate?: Date;
  
  // Content information
  pageCount?: number;
  wordCount?: number;
  characterCount?: number;
  lineCount?: number;
  paragraphCount?: number;
  
  // Image/media properties
  dimensions?: {
    width: number;
    height: number;
  };
  resolution?: {
    x: number;
    y: number;
    unit: string;
  };
  colorSpace?: string;
  bitDepth?: number;
  compression?: string;
  
  // Document structure
  hasImages?: boolean;
  hasLinks?: boolean;
  hasTables?: boolean;
  hasFormFields?: boolean;
  isEncrypted?: boolean;
  isPasswordProtected?: boolean;
  
  // Language and encoding
  language?: string;
  encoding?: string;
  
  // Technical metadata
  version?: string;
  application?: string;
  format?: string;
  
  // Custom properties
  customProperties?: Record<string, any>;
  
  // Extracted content samples
  textSample?: string;
  
  // Processing information
  extractedAt: Date;
  extractionMethod: string;
  processingTime: number;
}

export class MetadataExtractionService {
  private tempDir: string;

  constructor() {
    this.tempDir = process.env.TEMP_DIR || '/tmp';
  }

  async extractMetadata(
    buffer: Buffer,
    mimeType: string,
    filename: string
  ): Promise<DocumentMetadata> {
    const startTime = Date.now();
    
    try {
      logger.info(`Extracting metadata from ${filename} (${mimeType})`);

      let metadata: DocumentMetadata = {
        filename,
        mimeType,
        size: buffer.length,
        extractedAt: new Date(),
        extractionMethod: 'unknown',
        processingTime: 0
      };

      switch (mimeType) {
        case 'application/pdf':
          metadata = await this.extractPDFMetadata(buffer, metadata);
          break;
        
        case 'application/msword':
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          metadata = await this.extractWordMetadata(buffer, mimeType, metadata);
          break;
        
        case 'application/vnd.ms-powerpoint':
        case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
          metadata = await this.extractPowerPointMetadata(buffer, mimeType, metadata);
          break;
        
        case 'application/vnd.ms-excel':
        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
          metadata = await this.extractExcelMetadata(buffer, mimeType, metadata);
          break;
        
        case 'text/plain':
        case 'text/rtf':
          metadata = await this.extractTextMetadata(buffer, mimeType, metadata);
          break;
        
        default:
          if (mimeType.startsWith('image/')) {
            metadata = await this.extractImageMetadata(buffer, mimeType, metadata);
          } else {
            metadata = await this.extractGenericMetadata(buffer, mimeType, metadata);
          }
      }

      metadata.processingTime = Date.now() - startTime;
      logger.info(`Metadata extraction completed in ${metadata.processingTime}ms`);
      
      return metadata;

    } catch (error) {
      logger.error('Metadata extraction failed:', error);
      
      return {
        filename,
        mimeType,
        size: buffer.length,
        extractedAt: new Date(),
        extractionMethod: 'failed',
        processingTime: Date.now() - startTime,
        customProperties: {
          error: error.message
        }
      };
    }
  }

  private async extractPDFMetadata(
    buffer: Buffer,
    baseMetadata: DocumentMetadata
  ): Promise<DocumentMetadata> {
    try {
      const pdfData = await pdfParse(buffer);
      
      return {
        ...baseMetadata,
        extractionMethod: 'pdf-parse',
        pageCount: pdfData.numpages,
        wordCount: pdfData.text.split(/\s+/).length,
        characterCount: pdfData.text.length,
        lineCount: pdfData.text.split('\n').length,
        textSample: pdfData.text.substring(0, 500),
        
        // PDF-specific metadata
        title: pdfData.info?.Title,
        author: pdfData.info?.Author,
        subject: pdfData.info?.Subject,
        creator: pdfData.info?.Creator,
        producer: pdfData.info?.Producer,
        keywords: pdfData.info?.Keywords ? pdfData.info.Keywords.split(',').map(k => k.trim()) : undefined,
        creationDate: pdfData.info?.CreationDate ? new Date(pdfData.info.CreationDate) : undefined,
        modificationDate: pdfData.info?.ModDate ? new Date(pdfData.info.ModDate) : undefined,
        version: pdfData.version,
        
        // Content analysis
        hasImages: this.detectImagesInText(pdfData.text),
        hasLinks: this.detectLinksInText(pdfData.text),
        hasTables: this.detectTablesInText(pdfData.text),
        
        customProperties: {
          pdfVersion: pdfData.version,
          pdfInfo: pdfData.info
        }
      };
    } catch (error) {
      logger.error('PDF metadata extraction failed:', error);
      return {
        ...baseMetadata,
        extractionMethod: 'pdf-parse-failed',
        customProperties: { error: error.message }
      };
    }
  }

  private async extractWordMetadata(
    buffer: Buffer,
    mimeType: string,
    baseMetadata: DocumentMetadata
  ): Promise<DocumentMetadata> {
    try {
      if (mimeType.includes('wordprocessingml')) {
        // DOCX format
        const textResult = await mammoth.extractRawText({ buffer });
        const htmlResult = await mammoth.convertToHtml({ buffer });
        
        return {
          ...baseMetadata,
          extractionMethod: 'mammoth',
          wordCount: textResult.value.split(/\s+/).length,
          characterCount: textResult.value.length,
          lineCount: textResult.value.split('\n').length,
          paragraphCount: textResult.value.split('\n\n').length,
          textSample: textResult.value.substring(0, 500),
          
          // Content analysis
          hasImages: htmlResult.value.includes('<img'),
          hasLinks: htmlResult.value.includes('<a '),
          hasTables: htmlResult.value.includes('<table'),
          
          customProperties: {
            conversionMessages: textResult.messages,
            htmlPreview: htmlResult.value.substring(0, 1000)
          }
        };
      } else {
        // DOC format - would need additional tools like antiword
        return {
          ...baseMetadata,
          extractionMethod: 'doc-unsupported',
          customProperties: {
            note: 'Legacy DOC format requires additional processing tools'
          }
        };
      }
    } catch (error) {
      logger.error('Word document metadata extraction failed:', error);
      return {
        ...baseMetadata,
        extractionMethod: 'word-failed',
        customProperties: { error: error.message }
      };
    }
  }

  private async extractImageMetadata(
    buffer: Buffer,
    mimeType: string,
    baseMetadata: DocumentMetadata
  ): Promise<DocumentMetadata> {
    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();
      
      return {
        ...baseMetadata,
        extractionMethod: 'sharp',
        dimensions: {
          width: metadata.width || 0,
          height: metadata.height || 0
        },
        resolution: metadata.density ? {
          x: metadata.density,
          y: metadata.density,
          unit: 'dpi'
        } : undefined,
        colorSpace: metadata.space,
        bitDepth: metadata.depth,
        compression: metadata.compression,
        format: metadata.format,
        
        customProperties: {
          channels: metadata.channels,
          hasProfile: metadata.hasProfile,
          hasAlpha: metadata.hasAlpha,
          orientation: metadata.orientation,
          exif: metadata.exif ? this.parseExifData(metadata.exif) : undefined,
          icc: metadata.icc ? 'Present' : 'None'
        }
      };
    } catch (error) {
      logger.error('Image metadata extraction failed:', error);
      return {
        ...baseMetadata,
        extractionMethod: 'image-failed',
        customProperties: { error: error.message }
      };
    }
  }

  private async extractTextMetadata(
    buffer: Buffer,
    mimeType: string,
    baseMetadata: DocumentMetadata
  ): Promise<DocumentMetadata> {
    try {
      const text = buffer.toString('utf-8');
      const lines = text.split('\n');
      const words = text.split(/\s+/);
      const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);
      
      return {
        ...baseMetadata,
        extractionMethod: 'text-analysis',
        wordCount: words.length,
        characterCount: text.length,
        lineCount: lines.length,
        paragraphCount: paragraphs.length,
        textSample: text.substring(0, 500),
        encoding: 'UTF-8',
        
        // Language detection (basic)
        language: this.detectLanguage(text),
        
        customProperties: {
          averageWordsPerLine: Math.round(words.length / lines.length),
          averageCharactersPerWord: Math.round(text.length / words.length),
          emptyLines: lines.filter(line => line.trim().length === 0).length
        }
      };
    } catch (error) {
      logger.error('Text metadata extraction failed:', error);
      return {
        ...baseMetadata,
        extractionMethod: 'text-failed',
        customProperties: { error: error.message }
      };
    }
  }

  private async extractPowerPointMetadata(
    buffer: Buffer,
    mimeType: string,
    baseMetadata: DocumentMetadata
  ): Promise<DocumentMetadata> {
    // PowerPoint metadata extraction would require specialized libraries
    return {
      ...baseMetadata,
      extractionMethod: 'powerpoint-placeholder',
      customProperties: {
        note: 'PowerPoint metadata extraction not fully implemented'
      }
    };
  }

  private async extractExcelMetadata(
    buffer: Buffer,
    mimeType: string,
    baseMetadata: DocumentMetadata
  ): Promise<DocumentMetadata> {
    // Excel metadata extraction would require specialized libraries
    return {
      ...baseMetadata,
      extractionMethod: 'excel-placeholder',
      customProperties: {
        note: 'Excel metadata extraction not fully implemented'
      }
    };
  }

  private async extractGenericMetadata(
    buffer: Buffer,
    mimeType: string,
    baseMetadata: DocumentMetadata
  ): Promise<DocumentMetadata> {
    try {
      // Use file command to get basic information
      const tempId = uuidv4();
      const tempPath = join(this.tempDir, `metadata_${tempId}`);
      
      await writeFile(tempPath, buffer);
      
      try {
        const { stdout } = await execAsync(`file -b "${tempPath}"`);
        const fileInfo = stdout.trim();
        
        await unlink(tempPath);
        
        return {
          ...baseMetadata,
          extractionMethod: 'file-command',
          customProperties: {
            fileInfo,
            detectedType: fileInfo
          }
        };
      } catch (error) {
        await unlink(tempPath).catch(() => {});
        throw error;
      }
    } catch (error) {
      logger.error('Generic metadata extraction failed:', error);
      return {
        ...baseMetadata,
        extractionMethod: 'generic-failed',
        customProperties: { error: error.message }
      };
    }
  }

  private parseExifData(exifBuffer: Buffer): any {
    try {
      // Basic EXIF parsing - in production, use a proper EXIF library
      return {
        size: exifBuffer.length,
        note: 'EXIF data present but not parsed'
      };
    } catch (error) {
      return { error: 'Failed to parse EXIF data' };
    }
  }

  private detectLanguage(text: string): string {
    // Basic language detection based on common words
    const sample = text.toLowerCase().substring(0, 1000);
    
    const languagePatterns = {
      'en': ['the', 'and', 'that', 'have', 'for', 'not', 'with', 'you', 'this', 'but'],
      'es': ['que', 'de', 'no', 'la', 'el', 'en', 'un', 'es', 'se', 'te'],
      'fr': ['que', 'de', 'et', 'le', 'la', 'les', 'des', 'en', 'un', 'du'],
      'de': ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich'],
      'it': ['che', 'di', 'la', 'il', 'le', 'e', 'un', 'in', 'per', 'una']
    };
    
    let maxScore = 0;
    let detectedLanguage = 'unknown';
    
    for (const [lang, patterns] of Object.entries(languagePatterns)) {
      let score = 0;
      for (const pattern of patterns) {
        const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
        const matches = sample.match(regex);
        if (matches) {
          score += matches.length;
        }
      }
      
      if (score > maxScore) {
        maxScore = score;
        detectedLanguage = lang;
      }
    }
    
    return detectedLanguage;
  }

  private detectImagesInText(text: string): boolean {
    // Look for image-related keywords or patterns
    const imagePatterns = [
      /image/gi,
      /figure/gi,
      /photo/gi,
      /picture/gi,
      /\.(jpg|jpeg|png|gif|bmp|tiff)/gi
    ];
    
    return imagePatterns.some(pattern => pattern.test(text));
  }

  private detectLinksInText(text: string): boolean {
    // Look for URL patterns
    const urlPattern = /(https?:\/\/[^\s]+)/gi;
    return urlPattern.test(text);
  }

  private detectTablesInText(text: string): boolean {
    // Look for table-like structures
    const lines = text.split('\n');
    let tableIndicators = 0;
    
    for (const line of lines) {
      // Look for lines with multiple tab characters or pipe characters
      if (line.includes('\t') && line.split('\t').length > 2) {
        tableIndicators++;
      }
      if (line.includes('|') && line.split('|').length > 2) {
        tableIndicators++;
      }
    }
    
    return tableIndicators > 2;
  }

  async extractBatchMetadata(
    files: Array<{ buffer: Buffer; mimeType: string; filename: string }>
  ): Promise<DocumentMetadata[]> {
    const results: DocumentMetadata[] = [];
    
    for (let i = 0; i < files.length; i++) {
      logger.info(`Processing file ${i + 1} of ${files.length}: ${files[i].filename}`);
      
      try {
        const metadata = await this.extractMetadata(
          files[i].buffer,
          files[i].mimeType,
          files[i].filename
        );
        results.push(metadata);
      } catch (error) {
        logger.error(`Failed to extract metadata from ${files[i].filename}:`, error);
        results.push({
          filename: files[i].filename,
          mimeType: files[i].mimeType,
          size: files[i].buffer.length,
          extractedAt: new Date(),
          extractionMethod: 'batch-failed',
          processingTime: 0,
          customProperties: { error: error.message }
        });
      }
    }
    
    return results;
  }

  async getSupportedFormats(): Promise<string[]> {
    return [
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
    ];
  }
}