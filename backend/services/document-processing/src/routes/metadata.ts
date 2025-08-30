import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { logger } from '../utils/logger';

const router = Router();

// POST /api/v1/metadata/extract - Extract metadata from documents
router.post('/extract',
  async (req: Request, res: Response) => {
    try {
      const files = (req as any).files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files provided for metadata extraction' });
      }

      const { metadataExtractionService } = req.app.locals.services;
      const results = [];

      for (const file of files) {
        try {
          const metadata = await metadataExtractionService.extractMetadata(
            file.buffer,
            file.mimetype,
            file.originalname
          );

          results.push({
            filename: file.originalname,
            success: true,
            metadata
          });

        } catch (error) {
          logger.error(`Metadata extraction failed for ${file.originalname}:`, error);
          results.push({
            filename: file.originalname,
            success: false,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        results,
        extracted: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      });

    } catch (error) {
      logger.error('Metadata extraction endpoint error:', error);
      res.status(500).json({ error: 'Metadata extraction failed' });
    }
  }
);

// POST /api/v1/metadata/batch - Batch metadata extraction
router.post('/batch',
  async (req: Request, res: Response) => {
    try {
      const files = (req as any).files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files provided for batch metadata extraction' });
      }

      if (files.length > 50) {
        return res.status(400).json({ error: 'Maximum 50 files allowed for batch metadata extraction' });
      }

      const { metadataExtractionService } = req.app.locals.services;
      const batchId = require('uuid').v4();

      logger.info(`Starting batch metadata extraction: ${batchId} (${files.length} files)`);

      // Prepare file data for batch processing
      const fileData = files.map(file => ({
        buffer: file.buffer,
        mimeType: file.mimetype,
        filename: file.originalname
      }));

      try {
        const results = await metadataExtractionService.extractBatchMetadata(fileData);

        const successful = results.filter(r => r.extractionMethod !== 'batch-failed').length;

        logger.info(`Batch metadata extraction completed: ${batchId} (${successful}/${files.length} successful)`);

        res.json({
          success: true,
          batchId,
          results,
          summary: {
            total: files.length,
            successful,
            failed: files.length - successful,
            totalProcessingTime: results.reduce((sum, r) => sum + r.processingTime, 0)
          }
        });

      } catch (error) {
        logger.error(`Batch metadata extraction failed: ${batchId}`, error);
        res.status(500).json({ error: 'Batch metadata extraction failed' });
      }

    } catch (error) {
      logger.error('Batch metadata extraction endpoint error:', error);
      res.status(500).json({ error: 'Batch metadata extraction failed' });
    }
  }
);

// GET /api/v1/metadata/formats - Get supported formats for metadata extraction
router.get('/formats',
  async (req: Request, res: Response) => {
    try {
      const { metadataExtractionService } = req.app.locals.services;
      const supportedFormats = await metadataExtractionService.getSupportedFormats();

      res.json({
        success: true,
        supportedFormats,
        total: supportedFormats.length
      });

    } catch (error) {
      logger.error('Error fetching supported metadata formats:', error);
      res.status(500).json({ error: 'Failed to fetch supported formats' });
    }
  }
);

// POST /api/v1/metadata/analyze - Analyze document structure and content
router.post('/analyze',
  body('includeContent').optional().isBoolean(),
  body('includeStructure').optional().isBoolean(),
  body('includeStatistics').optional().isBoolean(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const files = (req as any).files as Express.Multer.File[];
      const { 
        includeContent = true, 
        includeStructure = true, 
        includeStatistics = true 
      } = req.body;

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files provided for analysis' });
      }

      const { metadataExtractionService } = req.app.locals.services;
      const results = [];

      for (const file of files) {
        try {
          const metadata = await metadataExtractionService.extractMetadata(
            file.buffer,
            file.mimetype,
            file.originalname
          );

          // Enhanced analysis based on options
          const analysis: any = {
            filename: file.originalname,
            success: true,
            basicMetadata: {
              size: metadata.size,
              mimeType: metadata.mimeType,
              extractedAt: metadata.extractedAt,
              processingTime: metadata.processingTime
            }
          };

          if (includeContent) {
            analysis.content = {
              textSample: metadata.textSample,
              wordCount: metadata.wordCount,
              characterCount: metadata.characterCount,
              language: metadata.language
            };
          }

          if (includeStructure) {
            analysis.structure = {
              pageCount: metadata.pageCount,
              lineCount: metadata.lineCount,
              paragraphCount: metadata.paragraphCount,
              hasImages: metadata.hasImages,
              hasLinks: metadata.hasLinks,
              hasTables: metadata.hasTables
            };
          }

          if (includeStatistics) {
            analysis.statistics = {
              dimensions: metadata.dimensions,
              resolution: metadata.resolution,
              colorSpace: metadata.colorSpace,
              compression: metadata.compression,
              version: metadata.version
            };
          }

          // Include full metadata in custom properties
          analysis.fullMetadata = metadata;

          results.push(analysis);

        } catch (error) {
          logger.error(`Document analysis failed for ${file.originalname}:`, error);
          results.push({
            filename: file.originalname,
            success: false,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        analysisOptions: {
          includeContent,
          includeStructure,
          includeStatistics
        },
        results,
        analyzed: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      });

    } catch (error) {
      logger.error('Document analysis endpoint error:', error);
      res.status(500).json({ error: 'Document analysis failed' });
    }
  }
);

// POST /api/v1/metadata/compare - Compare metadata between documents
router.post('/compare',
  async (req: Request, res: Response) => {
    try {
      const files = (req as any).files as Express.Multer.File[];

      if (!files || files.length < 2) {
        return res.status(400).json({ error: 'At least 2 files required for comparison' });
      }

      if (files.length > 10) {
        return res.status(400).json({ error: 'Maximum 10 files allowed for comparison' });
      }

      const { metadataExtractionService } = req.app.locals.services;
      const metadataResults = [];

      // Extract metadata from all files
      for (const file of files) {
        try {
          const metadata = await metadataExtractionService.extractMetadata(
            file.buffer,
            file.mimetype,
            file.originalname
          );
          metadataResults.push(metadata);
        } catch (error) {
          logger.error(`Metadata extraction failed for ${file.originalname}:`, error);
          metadataResults.push({
            filename: file.originalname,
            error: error.message
          });
        }
      }

      // Perform comparison analysis
      const comparison = {
        totalFiles: files.length,
        successful: metadataResults.filter(r => !r.error).length,
        failed: metadataResults.filter(r => r.error).length,
        
        // Size comparison
        sizes: metadataResults.map(r => ({ filename: r.filename, size: r.size })),
        averageSize: metadataResults.reduce((sum, r) => sum + (r.size || 0), 0) / metadataResults.length,
        
        // Format distribution
        formats: metadataResults.reduce((acc, r) => {
          if (r.mimeType) {
            acc[r.mimeType] = (acc[r.mimeType] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>),
        
        // Content comparison (for text documents)
        contentStats: metadataResults.map(r => ({
          filename: r.filename,
          wordCount: r.wordCount,
          characterCount: r.characterCount,
          pageCount: r.pageCount,
          language: r.language
        })).filter(r => r.wordCount || r.characterCount),
        
        // Author comparison
        authors: [...new Set(metadataResults.map(r => r.author).filter(Boolean))],
        
        // Creation date comparison
        dateRange: {
          earliest: metadataResults.reduce((earliest, r) => {
            if (r.creationDate && (!earliest || r.creationDate < earliest)) {
              return r.creationDate;
            }
            return earliest;
          }, null),
          latest: metadataResults.reduce((latest, r) => {
            if (r.creationDate && (!latest || r.creationDate > latest)) {
              return r.creationDate;
            }
            return latest;
          }, null)
        },
        
        // Similarity analysis
        similarities: this.analyzeSimilarities(metadataResults)
      };

      res.json({
        success: true,
        comparison,
        individualMetadata: metadataResults
      });

    } catch (error) {
      logger.error('Metadata comparison endpoint error:', error);
      res.status(500).json({ error: 'Metadata comparison failed' });
    }
  }
);

// Helper method for similarity analysis
function analyzeSimilarities(metadataResults: any[]): any {
  const similarities = {
    sameFormat: 0,
    sameAuthor: 0,
    similarSize: 0,
    sameLanguage: 0
  };

  const validResults = metadataResults.filter(r => !r.error);
  
  if (validResults.length < 2) return similarities;

  // Check format similarity
  const formats = validResults.map(r => r.mimeType);
  if (new Set(formats).size === 1) {
    similarities.sameFormat = 100;
  } else {
    similarities.sameFormat = Math.round((formats.length - new Set(formats).size) / formats.length * 100);
  }

  // Check author similarity
  const authors = validResults.map(r => r.author).filter(Boolean);
  if (authors.length > 0 && new Set(authors).size === 1) {
    similarities.sameAuthor = 100;
  }

  // Check size similarity (within 10% range)
  const sizes = validResults.map(r => r.size).filter(Boolean);
  if (sizes.length > 1) {
    const avgSize = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
    const similarSizes = sizes.filter(size => Math.abs(size - avgSize) / avgSize <= 0.1);
    similarities.similarSize = Math.round((similarSizes.length / sizes.length) * 100);
  }

  // Check language similarity
  const languages = validResults.map(r => r.language).filter(Boolean);
  if (languages.length > 0 && new Set(languages).size === 1) {
    similarities.sameLanguage = 100;
  }

  return similarities;
}

export default router;