# File Management Service

A secure, scalable file management microservice for the StellarRec platform that handles file uploads, storage, processing, and security scanning.

## Features

### Core Functionality
- **Secure File Upload**: Multi-file upload with validation and virus scanning
- **Cloud Storage**: AWS S3 integration with encryption at rest
- **File Processing**: Document processing, image optimization, and thumbnail generation
- **Version Control**: File versioning with rollback capabilities
- **Access Control**: Role-based permissions and secure sharing

### Security Features
- **Malware Scanning**: Real-time virus and threat detection
- **File Validation**: MIME type verification and structure validation
- **Encryption**: File encryption/decryption with secure key management
- **Access Logging**: Comprehensive audit trail for all file operations
- **Sanitization**: Filename sanitization and content filtering

### Storage Features
- **Multiple Formats**: Support for PDF, DOC/DOCX, images, and text files
- **Metadata Management**: Rich metadata storage and search capabilities
- **Backup & Recovery**: Automated backup creation and integrity validation
- **Expiration**: Automatic cleanup of expired files

## API Endpoints

### Upload Endpoints
- `POST /api/v1/upload` - Upload files with validation
- `POST /api/v1/upload/presigned` - Generate presigned upload URLs

### File Management
- `GET /api/v1/files` - List user files with filtering
- `GET /api/v1/files/search` - Search files by content and metadata
- `GET /api/v1/files/:fileId` - Get file metadata
- `PUT /api/v1/files/:fileId` - Update file metadata
- `DELETE /api/v1/files/:fileId` - Delete file
- `GET /api/v1/files/:fileId/download` - Generate download URL
- `GET /api/v1/files/:fileId/preview` - Get file preview
- `GET /api/v1/files/:fileId/versions` - Get file versions
- `GET /api/v1/files/:fileId/access-logs` - Get access logs

### Storage Operations
- `GET /api/v1/storage/stats` - Get storage statistics
- `POST /api/v1/storage/:fileId/backup` - Create file backup
- `POST /api/v1/storage/:fileId/copy` - Copy file
- `POST /api/v1/storage/:fileId/move` - Move file
- `POST /api/v1/storage/:fileId/validate` - Validate file integrity

### Security Operations
- `POST /api/v1/security/scan/:fileId` - Scan file for threats
- `POST /api/v1/security/validate/:fileId` - Validate file structure
- `POST /api/v1/security/encrypt/:fileId` - Encrypt file
- `POST /api/v1/security/decrypt/:fileId` - Decrypt file
- `POST /api/v1/security/sanitize-filename` - Sanitize filename
- `GET /api/v1/security/file-hash/:fileId` - Generate file hashes

## Installation

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set up Environment Variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Set up Database**
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

4. **Build and Start**
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
| `PORT` | Server port | 3009 |
| `JWT_SECRET` | JWT signing secret | Required |
| `AWS_ACCESS_KEY_ID` | AWS access key | Required |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | Required |
| `S3_BUCKET` | S3 bucket name | Required |
| `AWS_REGION` | AWS region | us-east-1 |
| `MAX_FILE_SIZE` | Maximum file size in bytes | 52428800 (50MB) |
| `ALLOWED_ORIGINS` | CORS allowed origins | localhost:3000 |

### File Type Support

| Type | Extensions | Processing |
|------|------------|------------|
| Documents | PDF, DOC, DOCX | Text extraction, metadata |
| Images | JPEG, PNG, GIF | Thumbnails, optimization |
| Text | TXT | Content indexing |

## Security

### File Validation
- MIME type verification
- Magic byte detection
- File structure validation
- Size limit enforcement

### Malware Scanning
- ClamAV integration (when available)
- Pattern-based detection
- Quarantine capabilities

### Access Control
- JWT-based authentication
- Role-based permissions
- File-level access control
- Audit logging

## Monitoring

### Health Checks
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed system status

### Metrics
- File upload/download rates
- Storage usage statistics
- Error rates and response times
- Security scan results

## Docker Deployment

```bash
# Build image
docker build -t stellarrec/file-management .

# Run container
docker run -p 3009:3009 \
  -e DATABASE_URL="your-db-url" \
  -e AWS_ACCESS_KEY_ID="your-key" \
  -e AWS_SECRET_ACCESS_KEY="your-secret" \
  -e S3_BUCKET="your-bucket" \
  stellarrec/file-management
```

## Architecture

### Components
- **FileStorageService**: S3 operations and storage management
- **SecurityService**: Malware scanning and file validation
- **ProcessingService**: Document processing and optimization
- **MetadataService**: Database operations and metadata management

### Database Schema
- `files`: Main file records with metadata
- `file_versions`: Version history tracking
- `file_access_logs`: Audit trail for all operations
- `file_shares`: Secure sharing configurations

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details