# AI Writing Assistant Service

Advanced AI-powered writing assistant for the StellarRec platform, providing real-time content analysis, template generation, vocabulary enhancement, style improvement, and comprehensive quality assessment.

## Features

### Core Capabilities
- **Real-Time Content Analysis**: Live analysis of writing quality, clarity, and impact
- **Template Generation**: AI-generated templates based on student profiles and requirements
- **Vocabulary Enhancement**: Intelligent word choice suggestions and synonym recommendations
- **Style Improvement**: Writing style analysis and improvement suggestions
- **Quality Scoring**: Comprehensive assessment with readiness indicators

### AI-Powered Features
- **Grammar and Syntax Checking**: Advanced grammar analysis with contextual corrections
- **Tone Analysis**: Detect and adjust writing tone for different audiences
- **Readability Assessment**: Flesch-Kincaid and other readability metrics
- **Plagiarism Detection**: Content originality checking and citation suggestions
- **Structure Analysis**: Essay structure evaluation and improvement recommendations

## API Endpoints

### Content Analysis
- `POST /api/v1/analysis/analyze` - Analyze text content
- `POST /api/v1/analysis/suggestions` - Get writing suggestions
- `POST /api/v1/analysis/grammar` - Check grammar and syntax
- `POST /api/v1/analysis/style` - Analyze writing style
- `POST /api/v1/analysis/readability` - Assess readability

### Template Generation
- `POST /api/v1/templates/generate` - Generate essay template
- `GET /api/v1/templates/categories` - Get template categories
- `GET /api/v1/templates/:id` - Get specific template
- `POST /api/v1/templates/customize` - Customize template for user

### Quality Assessment
- `POST /api/v1/quality/score` - Get comprehensive quality score
- `POST /api/v1/quality/readiness` - Assess submission readiness
- `GET /api/v1/quality/criteria` - Get scoring criteria
- `POST /api/v1/quality/compare` - Compare multiple versions

### Writing Suggestions
- `POST /api/v1/suggestions/vocabulary` - Get vocabulary suggestions
- `POST /api/v1/suggestions/structure` - Get structure improvements
- `POST /api/v1/suggestions/tone` - Get tone adjustments
- `POST /api/v1/suggestions/clarity` - Get clarity improvements

## Architecture

The AI Writing Assistant uses multiple AI models and services:

- **Grammar Model**: BERT-based grammar checking
- **Style Analysis**: Custom NLP models for style assessment
- **Template Generation**: GPT-based template creation
- **Quality Scoring**: Multi-factor scoring algorithm
- **Plagiarism Detection**: Content similarity analysis

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   ```

3. Run database migrations:
   ```bash
   npm run prisma:migrate
   ```

4. Start the service:
   ```bash
   npm run dev
   ```

## Configuration

### Environment Variables

- `PORT` - Service port (default: 3015)
- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - OpenAI API key for GPT models
- `GRAMMARLY_API_KEY` - Grammarly API key (optional)
- `PLAGIARISM_API_KEY` - Plagiarism detection service API key

### AI Model Configuration

The service supports multiple AI providers:
- OpenAI GPT models for content generation
- Hugging Face models for analysis
- Custom trained models for domain-specific tasks

## Usage Examples

### Analyze Essay Content
```javascript
const analysis = await fetch('/api/v1/analysis/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: "Your essay content here...",
    type: "personal_statement",
    requirements: {
      wordLimit: 650,
      tone: "professional",
      audience: "admissions_committee"
    }
  })
});
```

### Generate Template
```javascript
const template = await fetch('/api/v1/templates/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    essayType: "personal_statement",
    userProfile: {
      major: "Computer Science",
      interests: ["AI", "Research"],
      experiences: ["Internship", "Research Project"]
    },
    requirements: {
      wordLimit: 650,
      prompts: ["Why this major?", "Future goals?"]
    }
  })
});
```

## Quality Metrics

The service provides comprehensive quality assessment:

- **Grammar Score** (0-100): Grammar and syntax accuracy
- **Style Score** (0-100): Writing style appropriateness
- **Clarity Score** (0-100): Content clarity and coherence
- **Impact Score** (0-100): Persuasiveness and engagement
- **Originality Score** (0-100): Content uniqueness
- **Overall Score** (0-100): Weighted composite score

## Integration

### With Other Services
- **User Service**: User profile and preferences
- **Application Service**: Essay requirements and deadlines
- **Notification Service**: Writing reminders and suggestions
- **Analytics Service**: Writing progress tracking

### External APIs
- OpenAI GPT for content generation
- Grammarly API for grammar checking
- Plagiarism detection services
- Language processing APIs

## Performance

- **Real-time Analysis**: < 2 seconds for typical essays
- **Template Generation**: < 5 seconds
- **Quality Scoring**: < 1 second
- **Batch Processing**: Support for multiple documents

## Security

- Input sanitization and validation
- Rate limiting for API endpoints
- Secure handling of user content
- Privacy-compliant data processing