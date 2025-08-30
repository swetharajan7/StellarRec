import { createWorker, Worker } from 'tesseract.js';
import sharp from 'sharp';
import { logger } from '../utils/logger';

export interface OCROptions {
  language?: string;
  pageSegMode?: number;
  ocrEngineMode?: number;
  whitelist?: string;
  blacklist?: string;
  preserveInterword?: boolean;
  tessjs_create_hocr?: boolean;
  tessjs_create_tsv?: boolean;
  tessjs_create_box?: boolean;
  tessjs_create_unlv?: boolean;
  tessjs_create_osd?: boolean;
}

export interface OCRResult {
  success: boolean;
  text: string;
  confidence: number;
  words?: Array<{
    text: string;
    confidence: number;
    bbox: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };
  }>;
  lines?: Array<{
    text: string;
    confidence: number;
    bbox: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };
    words: Array<any>;
  }>;
  paragraphs?: Array<{
    text: string;
    confidence: number;
    bbox: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };
    lines: Array<any>;
  }>;
  hocr?: string;
  tsv?: string;
  box?: string;
  unlv?: string;
  osd?: any;
  processingTime: number;
  error?: string;
}

export class OCRService {
  private workers: Map<string, Worker> = new Map();
  private maxWorkers: number = 3;

  constructor() {
    // Initialize workers for common languages
    this.initializeWorkers(['eng', 'spa', 'fra', 'deu']);
  }

  private async initializeWorkers(languages: string[]): Promise<void> {
    for (const lang of languages) {
      if (this.workers.size < this.maxWorkers) {
        try {
          const worker = await createWorker(lang);
          this.workers.set(lang, worker);
          logger.info(`OCR worker initialized for language: ${lang}`);
        } catch (error) {
          logger.warn(`Failed to initialize OCR worker for ${lang}:`, error);
        }
      }
    }
  }

  async extractTextFromImage(
    imageBuffer: Buffer,
    language: string = 'eng',
    options: OCROptions = {}
  ): Promise<OCRResult> {
    const startTime = Date.now();

    try {
      logger.info(`Starting OCR extraction for language: ${language}`);

      // Preprocess image for better OCR results
      const preprocessedBuffer = await this.preprocessImage(imageBuffer);

      // Get or create worker for the specified language
      let worker = this.workers.get(language);
      if (!worker) {
        worker = await createWorker(language);
        if (this.workers.size < this.maxWorkers) {
          this.workers.set(language, worker);
        }
      }

      // Set OCR parameters
      await this.setWorkerParameters(worker, options);

      // Perform OCR
      const result = await worker.recognize(preprocessedBuffer);

      const processingTime = Date.now() - startTime;

      // Extract detailed information
      const ocrResult: OCRResult = {
        success: true,
        text: result.data.text,
        confidence: result.data.confidence,
        processingTime
      };

      // Add word-level information if available
      if (result.data.words) {
        ocrResult.words = result.data.words.map(word => ({
          text: word.text,
          confidence: word.confidence,
          bbox: {
            x0: word.bbox.x0,
            y0: word.bbox.y0,
            x1: word.bbox.x1,
            y1: word.bbox.y1
          }
        }));
      }

      // Add line-level information
      if (result.data.lines) {
        ocrResult.lines = result.data.lines.map(line => ({
          text: line.text,
          confidence: line.confidence,
          bbox: {
            x0: line.bbox.x0,
            y0: line.bbox.y0,
            x1: line.bbox.x1,
            y1: line.bbox.y1
          },
          words: line.words
        }));
      }

      // Add paragraph-level information
      if (result.data.paragraphs) {
        ocrResult.paragraphs = result.data.paragraphs.map(paragraph => ({
          text: paragraph.text,
          confidence: paragraph.confidence,
          bbox: {
            x0: paragraph.bbox.x0,
            y0: paragraph.bbox.y0,
            x1: paragraph.bbox.x1,
            y1: paragraph.bbox.y1
          },
          lines: paragraph.lines
        }));
      }

      // Add additional output formats if requested
      if (options.tessjs_create_hocr) {
        ocrResult.hocr = result.data.hocr;
      }
      if (options.tessjs_create_tsv) {
        ocrResult.tsv = result.data.tsv;
      }
      if (options.tessjs_create_box) {
        ocrResult.box = result.data.box;
      }
      if (options.tessjs_create_unlv) {
        ocrResult.unlv = result.data.unlv;
      }
      if (options.tessjs_create_osd) {
        ocrResult.osd = result.data.osd;
      }

      logger.info(`OCR completed successfully in ${processingTime}ms with confidence: ${result.data.confidence}%`);
      return ocrResult;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('OCR extraction failed:', error);

      return {
        success: false,
        text: '',
        confidence: 0,
        processingTime,
        error: error.message
      };
    }
  }

  private async preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
    try {
      // Apply image preprocessing to improve OCR accuracy
      const processedImage = await sharp(imageBuffer)
        // Convert to grayscale
        .grayscale()
        // Increase contrast
        .normalize()
        // Apply slight sharpening
        .sharpen({ sigma: 1, flat: 1, jagged: 2 })
        // Ensure minimum DPI for OCR
        .withMetadata({ density: 300 })
        .png()
        .toBuffer();

      return processedImage;
    } catch (error) {
      logger.warn('Image preprocessing failed, using original:', error);
      return imageBuffer;
    }
  }

  private async setWorkerParameters(worker: Worker, options: OCROptions): Promise<void> {
    try {
      // Set page segmentation mode
      if (options.pageSegMode !== undefined) {
        await worker.setParameters({
          tessedit_pageseg_mode: options.pageSegMode.toString()
        });
      }

      // Set OCR engine mode
      if (options.ocrEngineMode !== undefined) {
        await worker.setParameters({
          tessedit_ocr_engine_mode: options.ocrEngineMode.toString()
        });
      }

      // Set character whitelist
      if (options.whitelist) {
        await worker.setParameters({
          tessedit_char_whitelist: options.whitelist
        });
      }

      // Set character blacklist
      if (options.blacklist) {
        await worker.setParameters({
          tessedit_char_blacklist: options.blacklist
        });
      }

      // Preserve interword spaces
      if (options.preserveInterword !== undefined) {
        await worker.setParameters({
          preserve_interword_spaces: options.preserveInterword ? '1' : '0'
        });
      }

    } catch (error) {
      logger.warn('Failed to set OCR parameters:', error);
    }
  }

  async extractTextFromPDF(
    pdfBuffer: Buffer,
    language: string = 'eng',
    options: OCROptions = {}
  ): Promise<OCRResult[]> {
    try {
      // This would require converting PDF pages to images first
      // For now, return a placeholder
      logger.info('PDF OCR extraction requested');
      
      return [{
        success: false,
        text: '',
        confidence: 0,
        processingTime: 0,
        error: 'PDF OCR extraction not implemented'
      }];

    } catch (error) {
      logger.error('PDF OCR extraction failed:', error);
      return [{
        success: false,
        text: '',
        confidence: 0,
        processingTime: 0,
        error: error.message
      }];
    }
  }

  async detectLanguage(imageBuffer: Buffer): Promise<{ language: string; confidence: number }> {
    try {
      const worker = this.workers.get('eng') || await createWorker('eng');
      
      // Use OSD (Orientation and Script Detection) to detect language
      await worker.setParameters({
        tessjs_create_osd: '1'
      });

      const result = await worker.recognize(imageBuffer);
      
      // Extract language information from OSD
      const osd = result.data.osd;
      if (osd && osd.script) {
        return {
          language: this.mapScriptToLanguage(osd.script),
          confidence: osd.script_conf || 0
        };
      }

      return {
        language: 'eng',
        confidence: 0
      };

    } catch (error) {
      logger.error('Language detection failed:', error);
      return {
        language: 'eng',
        confidence: 0
      };
    }
  }

  private mapScriptToLanguage(script: string): string {
    const scriptMap: Record<string, string> = {
      'Latin': 'eng',
      'Arabic': 'ara',
      'Chinese': 'chi_sim',
      'Cyrillic': 'rus',
      'Devanagari': 'hin',
      'Japanese': 'jpn',
      'Korean': 'kor'
    };
    return scriptMap[script] || 'eng';
  }

  async getSupportedLanguages(): Promise<string[]> {
    return [
      'afr', 'amh', 'ara', 'asm', 'aze', 'aze_cyrl', 'bel', 'ben', 'bod', 'bos',
      'bre', 'bul', 'cat', 'ceb', 'ces', 'chi_sim', 'chi_tra', 'chr', 'cym',
      'dan', 'deu', 'dzo', 'ell', 'eng', 'enm', 'epo', 'est', 'eus', 'fao',
      'fas', 'fin', 'fra', 'frk', 'frm', 'gle', 'glg', 'grc', 'guj', 'hat',
      'heb', 'hin', 'hrv', 'hun', 'hye', 'iku', 'ind', 'isl', 'ita', 'ita_old',
      'jav', 'jpn', 'kan', 'kat', 'kat_old', 'kaz', 'khm', 'kir', 'kor',
      'kur', 'lao', 'lat', 'lav', 'lit', 'ltz', 'mal', 'mar', 'mkd', 'mlt',
      'mon', 'mri', 'msa', 'mya', 'nep', 'nld', 'nor', 'oci', 'ori', 'pan',
      'pol', 'por', 'pus', 'que', 'ron', 'rus', 'san', 'sin', 'slk', 'slv',
      'snd', 'spa', 'spa_old', 'sqi', 'srp', 'srp_latn', 'sun', 'swa', 'swe',
      'syr', 'tam', 'tat', 'tel', 'tgk', 'tgl', 'tha', 'tir', 'ton', 'tur',
      'uig', 'ukr', 'urd', 'uzb', 'uzb_cyrl', 'vie', 'yid', 'yor'
    ];
  }

  async batchOCR(
    images: Buffer[],
    language: string = 'eng',
    options: OCROptions = {}
  ): Promise<OCRResult[]> {
    const results: OCRResult[] = [];

    for (let i = 0; i < images.length; i++) {
      logger.info(`Processing image ${i + 1} of ${images.length}`);
      const result = await this.extractTextFromImage(images[i], language, options);
      results.push(result);
    }

    return results;
  }

  async cleanup(): Promise<void> {
    logger.info('Cleaning up OCR workers');
    
    for (const [language, worker] of this.workers) {
      try {
        await worker.terminate();
        logger.info(`OCR worker terminated for language: ${language}`);
      } catch (error) {
        logger.warn(`Failed to terminate OCR worker for ${language}:`, error);
      }
    }
    
    this.workers.clear();
  }

  // Utility method to validate image for OCR
  async validateImageForOCR(imageBuffer: Buffer): Promise<{
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      const metadata = await sharp(imageBuffer).metadata();

      // Check image dimensions
      if (metadata.width && metadata.width < 300) {
        issues.push('Image width is too small (< 300px)');
        recommendations.push('Use higher resolution image for better OCR results');
      }

      if (metadata.height && metadata.height < 300) {
        issues.push('Image height is too small (< 300px)');
        recommendations.push('Use higher resolution image for better OCR results');
      }

      // Check image format
      if (!['jpeg', 'png', 'tiff', 'webp'].includes(metadata.format || '')) {
        issues.push(`Unsupported image format: ${metadata.format}`);
        recommendations.push('Convert to JPEG, PNG, TIFF, or WebP format');
      }

      // Check image density
      if (metadata.density && metadata.density < 150) {
        issues.push('Image DPI is too low (< 150)');
        recommendations.push('Use images with at least 300 DPI for optimal OCR results');
      }

      return {
        isValid: issues.length === 0,
        issues,
        recommendations
      };

    } catch (error) {
      return {
        isValid: false,
        issues: ['Failed to analyze image'],
        recommendations: ['Ensure the image file is valid and not corrupted']
      };
    }
  }
}