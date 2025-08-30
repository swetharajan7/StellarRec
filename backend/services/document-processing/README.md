# Document Processing Service

A comprehensive document processing pipeline for the StellarRec platform that handles document conversion, OCR, preview generation, metadata extraction, and search indexing.

## Features

### Core Processing Capabilities
- **Document Conversion**: Convert between multiple formats (PDF, DOC/DOCX, images)
- **OCR Processing**: Extract text from images and scanned documents with Tesseract.js
- **Preview Generation**: Create thumbnails and page previews for documents
- **Metadata Extraction**: Extract comprehensive metadata from various file formats
- **Search Indexing**: Index documents in Elasticsearch for full-text search

### Supported Formats

#### Input Formats
- **Documents**: PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, RTF, TXT
- **Images**: JPEG, PNG, GIF, TIFF, BMP, WebP

#### Output Formats
- **Images**: JPEG, PNG, WebP, TIFF, AVIF
- **Documents**: PDF, TXT, HTML
- **Previews**: Base64-encoded images, text excerpts

### Processing Types
- **Conversion**: Format transformation and optimization
- **OCR**: Text extraction from images (50+ languages supported)
- **Preview**: Thumbnail and page preview generation
- **Metadata**: Comprehensive document metadata extraction
- **Indexing**: Full-text search indexing with Elasticsearch
- **Full**: Complete processing pipeline with all features

## API Endpoints

### Processing Operations
- `POST /api/v1/processing/process` - Process uploaded documents
- `POST /api/v1/processing/batch` - Batch process multiple documents
- `GET /api/v1/processing/jobs` - List processing jobs
- `GET /api/v1/processing/jobs/:jobId` - Get job details
- `DELETE /api/v1/processing/jobs/:jobId` - Delete processing job
- `GET /api/v1/processing/stats` - Get processing statistics

### Document Conversion
- `POST /api/v1/conversion/convert` - Convert document formats
- `POST /api/v1/conversion/optimize` - Optimize documents
- `POST /api/v1/conversion/batch-convert` - Batch convert files
- `POST /api/v1/conversion/multi-format` - Convert to multiple formats
- `GET /api/v1/conversion/formats` - Get supported formats

### OCR Operations
- `POST /api/v1/ocr/extract` - Extract text from images
- `POST /api/v1/ocr/batch` - Batch OCR processing
- `POST /api/v1/ocr/detect-language` - Detect text language
- `POST /api/v1/ocr/validate` - Validate images for OCR
- `POST /api/v1/ocr/pdf` - OCR PDF documents
- `GET /api/v1/ocr/languages` - Get supported languages

### Preview Generation
- `POST /api/v1/preview/generate` - Generate document previews
- `POST /api/v1/preview/thumbnails` - Generate thumbnails
- `POST /api/v1/preview/pages` - Generate page previews
- `POST /api/v1/preview/text` - Generate text previews
- `POST /api/v1/preview/multiple-formats` - Generate multiple preview types
- `GET /api/v1/preview/formats` - Get supported preview formats

### Metadata Extraction
- `POST /api/v1/metadata/extract` - Extract document metadata
- `POST /api/v1/metadata/batch` - Batch metadata extraction
- `POST /api/v1/metadata/analyze` - Analyze document structure
- `POST /api/v1/metadata/compare` - Compare document metadata
- `GET /api/v1/metadata/formats` - Get supported formats

## Installation

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Install System Dependencies**
   ```bash
   # Ubuntu/Debian
   sudo apt-get update
   sudo apt-get install -y imagemagick ghostscript libreoffice tesseract-ocr tesseract-ocr-eng poppler-utils
   
   # macOS
   brew install imagemagick ghostscript libreoffice tesseract poppler
   ```

3. **Set up Environment Variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up Database**
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

5. **Set up Elasticsearch**
   ```bash
   # Using Docker
   docker run -d --name elasticsearch -p 9200:9200 -e "discovery.type=single-node" elasticsearch:8.11.0
   ```

6. **Build and Start**
   ```bash
   npm run build
   npm start
   ```

## Development

```bash
# Start in development mode
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `PORT` | Server port | 3010 |
| `JWT_SECRET` | JWT signing secret | Required |
| `ELASTICSEARCH_URL` | Elasticsearch connection URL | http://localhost:9200 |
| `MAX_FILE_SIZE` | Maximum file size in bytes | 104857600 (100MB) |
| `TEMP_DIR` | Temporary directory for processing | /tmp |
| `DEFAULT_OCR_LANGUAGE` | Default OCR language | eng |

### Processing Options

#### OCR Options
```json
{
  "language": "eng",
  "pageSegMode": 6,
  "ocrEngineMode": 3,
  "whitelist": "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  "preserveInterword": true
}
```

#### Conversion Options
```json
{
  "quality": 85,
  "width": 800,
  "height": 600,
  "maintainAspectRatio": true,
  "backgroundColor": "#ffffff",
  "dpi": 300
}
```

#### Preview Options
```json
{
  "width": 300,
  "height": 400,
  "quality": 85,
  "format": "jpeg",
  "maxPages": 5
}
```

## Architecture

### Services
- **DocumentProcessingService**: Main orchestration service
- **ConversionService**: Document format conversion
- **OCRService**: Text extraction from images
- **PreviewService**: Preview and thumbnail generation
- **MetadataExtractionService**: Document metadata extraction
- **IndexingService**: Elasticsearch integration

### Database Schema
- `processing_jobs`: Job tracking and status
- `document_versions`: Document version history
- `processing_cache`: Processing result caching
- `ocr_results`: OCR extraction results
- `conversion_history`: Conversion operation history
- `preview_cache`: Generated preview caching

### Processing Pipeline
1. **Input Validation**: File type and size validation
2. **Security Scanning**: Malware and content validation
3. **Format Detection**: MIME type and structure analysis
4. **Processing**: Execute requested operations
5. **Result Storage**: Cache and store results
6. **Indexing**: Add to search index if requested

## Performance

### Optimization Features
- **Caching**: Results cached to avoid reprocessing
- **Batch Processing**: Efficient multi-file operations
- **Async Processing**: Non-blocking job execution
- **Resource Management**: Memory and CPU optimization
- **Format-Specific Optimization**: Tailored processing per format

### Monitoring
- Processing job status tracking
- Performance metrics collection
- Error rate monitoring
- Resource usage tracking
- Health check endpoints

## Security

### File Validation
- MIME type verification
- File structure validation
- Size limit enforcement
- Malicious content detection

### Access Control
- JWT-based authentication
- Role-based permissions
- User isolation
- Audit logging

## Docker Deployment

```bash
# Build image
docker build -t stellarrec/document-processing .

# Run container
docker run -p 3010:3010 \
  -e DATABASE_URL="your-db-url" \
  -e ELASTICSEARCH_URL="http://elasticsearch:9200" \
  -e JWT_SECRET="your-secret" \
  stellarrec/document-processing
```

## Supported Languages (OCR)

The service supports 100+ languages including:
- English (eng)
- Spanish (spa)
- French (fra)
- German (deu)
- Chinese Simplified (chi_sim)
- Japanese (jpn)
- Arabic (ara)
- Russian (rus)
- And many more...

## Error Handling

The service provides comprehensive error handling with:
- Detailed error messages
- Processing failure recovery
- Partial success reporting
- Retry mechanisms
- Graceful degradation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details