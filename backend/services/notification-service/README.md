# Notification Service

Multi-channel notification service for the StellarRec platform, providing email, SMS, push notifications, template management, delivery tracking, and user preference management.

## Features

### Core Capabilities
- **Multi-Channel Delivery**: Email, SMS, and push notifications
- **Template Management**: Dynamic templates with Handlebars and MJML support
- **Delivery Tracking**: Real-time delivery status and analytics
- **User Preferences**: Granular notification preferences and opt-out management
- **Queue Management**: Redis-based job queues with retry mechanisms
- **Webhook Integration**: Support for provider webhooks and custom endpoints

### Supported Providers
- **Email**: SMTP, SendGrid, Mailgun, AWS SES
- **SMS**: Twilio, AWS SNS, Nexmo
- **Push**: Firebase FCM, Web Push (VAPID)

## API Endpoints

### Email Notifications
- `POST /api/v1/email/send` - Send single email
- `POST /api/v1/email/send/bulk` - Send bulk emails
- `POST /api/v1/email/schedule` - Schedule email
- `GET /api/v1/email/status/:messageId` - Get email status
- `GET /api/v1/email/templates` - Get email templates

### SMS Notifications
- `POST /api/v1/sms/send` - Send single SMS
- `POST /api/v1/sms/send/bulk` - Send bulk SMS
- `POST /api/v1/sms/schedule` - Schedule SMS
- `GET /api/v1/sms/status/:messageId` - Get SMS status
- `GET /api/v1/sms/templates` - Get SMS templates

### Push Notifications
- `POST /api/v1/push/send` - Send push notification
- `POST /api/v1/push/register` - Register device
- `GET /api/v1/push/devices` - Get user devices

### User Preferences
- `GET /api/v1/preferences` - Get user preferences
- `PUT /api/v1/preferences` - Update user preferences
- `PUT /api/v1/preferences/channels/:channel` - Update channel preference
- `POST /api/v1/preferences/channels/:channel/verify` - Verify channel
- `GET /api/v1/preferences/categories` - Get notification categories

### Templates
- `GET /api/v1/templates` - Get templates
- `POST /api/v1/templates` - Create template (admin)
- `GET /api/v1/templates/:id` - Get template by ID

### Delivery Tracking
- `GET /api/v1/delivery/status/:notificationId` - Get delivery status
- `GET /api/v1/delivery/stats` - Get delivery statistics (admin)
- `GET /api/v1/delivery/failed` - Get failed deliveries (admin)

### Webhooks
- `POST /api/v1/webhooks/twilio` - Twilio webhook
- `POST /api/v1/webhooks/sendgrid` - SendGrid webhook
- `POST /api/v1/webhooks/mailgun` - Mailgun webhook
- `POST /api/v1/webhooks/firebase` - Firebase webhook
- `GET /api/v1/webhooks/events` - Get webhook events

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Set up database:
```bash
npx prisma migrate dev
npx prisma generate
```

4. Set up Redis:
```bash
# Make sure Redis is running
redis-server
```

5. Start the service:
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Configuration

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `JWT_SECRET`: Secret key for JWT token verification
- Provider-specific configuration (Twilio, SendGrid, etc.)

### Email Providers
Configure email provider in `.env`:
```bash
EMAIL_PROVIDER=sendgrid  # smtp, sendgrid, mailgun, ses
SENDGRID_API_KEY=your-api-key
```

### SMS Providers
Configure SMS provider in `.env`:
```bash
SMS_PROVIDER=twilio  # twilio, aws-sns, nexmo
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
```

### Push Notifications
Configure push notification providers:
```bash
# Web Push
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key

# Firebase
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

## Template System

### Template Variables
Templates support Handlebars syntax with custom helpers:
```handlebars
Hello {{capitalize name}},

Your application deadline is {{formatDate deadline 'long'}}.

{{#ifEquals status 'urgent'}}
This is urgent! Please take action immediately.
{{/ifEquals}}

Visit: {{url '/dashboard'}}
```

### Available Helpers
- `formatDate` - Format dates
- `uppercase/lowercase/capitalize` - Text formatting
- `truncate` - Truncate text
- `ifEquals` - Conditional rendering
- `url` - Generate URLs

### MJML Support
Email templates support MJML for responsive design:
```mjml
<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text>Hello {{name}}!</mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
```

## Queue Management

### Job Queues
- **Email Queue**: Processes email notifications
- **SMS Queue**: Processes SMS notifications  
- **Push Queue**: Processes push notifications

### Queue Features
- Priority-based processing
- Automatic retries with exponential backoff
- Dead letter queues for failed jobs
- Rate limiting and batch processing

### Queue Monitoring
```bash
# View queue stats
curl http://localhost:3009/api/v1/admin/queues/stats

# Retry failed jobs
curl -X POST http://localhost:3009/api/v1/admin/queues/email/retry
```

## Delivery Tracking

### Tracking Events
- **Sent**: Notification sent to provider
- **Delivered**: Confirmed delivery
- **Failed**: Delivery failed
- **Bounced**: Email bounced
- **Opened**: Email opened (tracking pixel)
- **Clicked**: Link clicked
- **Unsubscribed**: User unsubscribed

### Webhook Processing
Automatic processing of provider webhooks:
- Twilio SMS status updates
- SendGrid email events
- Mailgun delivery notifications
- Firebase push notification events

## User Preferences

### Notification Categories
- Application Deadlines
- Admission Updates
- Recommendation Requests
- Essay Feedback
- Platform Updates
- Security Alerts
- Marketing & Promotions

### Channel Preferences
Users can configure preferences for each channel:
- Enable/disable channels
- Verify email/SMS addresses
- Set quiet hours
- Configure digest frequency

### Opt-Out Management
- Global opt-out support
- Category-specific opt-outs
- One-click unsubscribe links
- Preference center

## Security

### Authentication
- JWT token validation
- Role-based access control
- API rate limiting

### Data Protection
- Input validation and sanitization
- Webhook signature verification
- Encrypted sensitive data
- GDPR compliance features

### Privacy Features
- User consent management
- Data retention policies
- Anonymized analytics
- Secure opt-out mechanisms

## Monitoring and Analytics

### Metrics
- Delivery rates by channel
- Open and click rates
- Bounce and failure rates
- Queue performance metrics

### Logging
- Structured JSON logging
- Request/response logging
- Error tracking and alerting
- Performance monitoring

### Health Checks
- `/health` - Basic service health
- `/health/ready` - Readiness for traffic

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Deployment

### Docker
```bash
# Build image
docker build -t stellarrec-notification-service .

# Run container
docker run -p 3009:3009 stellarrec-notification-service
```

### Production Considerations
- Use production database and Redis
- Configure proper logging and monitoring
- Set up load balancing
- Enable HTTPS
- Configure backup and recovery
- Set up alerting for failed deliveries

## Contributing

1. Follow TypeScript best practices
2. Write comprehensive tests
3. Document API changes
4. Follow semantic versioning
5. Update README for new features

## License

MIT License - see LICENSE file for details