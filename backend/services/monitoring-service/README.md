# StellarRec Monitoring Service

A comprehensive monitoring and logging system that provides centralized logging, performance monitoring, alerting, health checks, and metrics collection for the StellarRec platform.

## Features

### 🔍 Centralized Logging
- Structured logging with Winston
- Elasticsearch integration for log search and analysis
- Daily log rotation and archival
- Service-specific log aggregation
- Real-time log streaming

### 📊 Performance Monitoring
- Real-time performance metrics collection
- CPU, memory, and disk usage monitoring
- Response time and throughput tracking
- Error rate monitoring
- Custom performance thresholds

### 🚨 Alerting System
- Configurable alert rules
- Multiple notification channels (Email, Slack, Webhooks)
- Alert severity levels (Low, Medium, High, Critical)
- Alert acknowledgment and resolution tracking
- Cooldown periods to prevent alert spam

### 🏥 Health Checks
- Automated service health monitoring
- Configurable health check intervals
- Service uptime tracking
- Health history and trends
- System overview dashboard

### 📈 Metrics Collection
- Prometheus metrics integration
- Custom metrics recording
- Service metrics aggregation
- Real-time metrics export
- Historical metrics storage

### 📱 Dashboard & Visualization
- Real-time monitoring dashboard
- Service health overview
- System metrics visualization
- Error trends and analysis
- Alert management interface

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Services      │    │   Monitoring    │    │   External      │
│                 │    │   Service       │    │   Systems       │
│ ┌─────────────┐ │    │                 │    │                 │
│ │User Service │ │◄──►│ ┌─────────────┐ │◄──►│ ┌─────────────┐ │
│ └─────────────┘ │    │ │  Logging    │ │    │ │Elasticsearch│ │
│ ┌─────────────┐ │    │ │  Service    │ │    │ └─────────────┘ │
│ │AI Service   │ │◄──►│ └─────────────┘ │    │ ┌─────────────┐ │
│ └─────────────┘ │    │ ┌─────────────┐ │◄──►│ │ Prometheus  │ │
│ ┌─────────────┐ │    │ │  Metrics    │ │    │ └─────────────┘ │
│ │App Service  │ │◄──►│ │ Collection  │ │    │ ┌─────────────┐ │
│ └─────────────┘ │    │ └─────────────┘ │◄──►│ │   Grafana   │ │
│      ...        │    │ ┌─────────────┐ │    │ └─────────────┘ │
└─────────────────┘    │ │ Alerting    │ │    │ ┌─────────────┐ │
                       │ │  Service    │ │◄──►│ │    Slack    │ │
                       │ └─────────────┘ │    │ └─────────────┘ │
                       │ ┌─────────────┐ │    └─────────────────┘
                       │ │Health Check │ │
                       │ │  Service    │ │
                       │ └─────────────┘ │
                       └─────────────────┘
```

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Set up database:**
   ```bash
   npm run prisma:migrate
   npm run prisma:generate
   ```

4. **Build the service:**
   ```bash
   npm run build
   ```

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

### Testing
```bash
npm test
npm run test:coverage
```

## API Endpoints

### Health Checks
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health information

### Metrics
- `GET /api/v1/metrics` - Get all service metrics
- `GET /api/v1/metrics/service/:serviceName` - Get metrics for specific service
- `GET /api/v1/metrics/aggregated` - Get aggregated metrics
- `POST /api/v1/metrics/record` - Record custom metric
- `GET /metrics` - Prometheus metrics endpoint

### Logging
- `GET /api/v1/logs` - Query logs with filters
- `POST /api/v1/logs` - Create log entry
- `GET /api/v1/logs/aggregations` - Get log aggregations
- `GET /api/v1/logs/trends/errors` - Get error trends
- `GET /api/v1/logs/service/:serviceName/stats` - Get service log statistics

### Alerts
- `GET /api/v1/alerts` - Get active alerts
- `GET /api/v1/alerts/history` - Get alert history
- `GET /api/v1/alerts/rules` - Get alert rules
- `POST /api/v1/alerts/rules` - Create alert rule
- `PUT /api/v1/alerts/rules/:ruleId` - Update alert rule
- `DELETE /api/v1/alerts/rules/:ruleId` - Delete alert rule
- `POST /api/v1/alerts/:alertId/acknowledge` - Acknowledge alert
- `POST /api/v1/alerts/:alertId/resolve` - Resolve alert

### System Monitoring
- `GET /api/v1/system/metrics` - Get current system metrics
- `GET /api/v1/system/metrics/history` - Get system metrics history
- `GET /api/v1/system/overview` - Get system overview
- `GET /api/v1/system/performance` - Get performance metrics
- `GET /api/v1/system/health` - Get service health checks

### Dashboard
- `GET /api/v1/dashboard` - Get dashboard data
- `GET /api/v1/dashboard/service/:serviceName/metrics` - Get service metrics chart
- `GET /api/v1/dashboard/system/metrics` - Get system metrics chart
- `GET /api/v1/dashboard/errors/trends` - Get error trends chart
- `GET /api/v1/dashboard/services/health` - Get service health overview

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3011` |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `LOG_LEVEL` | Logging level | `info` |
| `ELASTICSEARCH_URL` | Elasticsearch URL | Optional |
| `SMTP_HOST` | SMTP server for email alerts | Optional |
| `SLACK_WEBHOOK_URL` | Slack webhook for notifications | Optional |

### Alert Rules

Alert rules can be configured via the API or directly in the database. Each rule includes:

- **Condition**: The metric to monitor
- **Threshold**: The value that triggers the alert
- **Severity**: Low, Medium, High, or Critical
- **Channels**: Notification methods (email, slack, webhook)
- **Cooldown**: Minimum time between alerts

### Performance Thresholds

Set performance thresholds for:
- CPU usage (%)
- Memory usage (%)
- Response time (ms)
- Error rate (%)
- Throughput (req/s)

## Integration

### Prometheus
The service exposes metrics in Prometheus format at `/metrics`. Configure Prometheus to scrape this endpoint.

### Grafana
Import the provided Grafana dashboards for visualization:
- System Overview Dashboard
- Service Health Dashboard
- Error Analysis Dashboard

### Elasticsearch
Configure Elasticsearch for advanced log search and analysis. The service automatically creates indices and mappings.

### Slack
Set up Slack webhooks for real-time alert notifications.

## Monitoring Best Practices

1. **Set appropriate thresholds** - Not too sensitive to avoid noise
2. **Use severity levels** - Critical for immediate action, warnings for investigation
3. **Configure cooldowns** - Prevent alert spam during incidents
4. **Monitor key metrics** - Focus on business-critical services
5. **Regular maintenance** - Clean up old logs and metrics data

## Troubleshooting

### Common Issues

1. **Database connection errors**
   - Check DATABASE_URL configuration
   - Ensure PostgreSQL is running
   - Verify database permissions

2. **Elasticsearch connection issues**
   - Verify ELASTICSEARCH_URL
   - Check Elasticsearch cluster health
   - Review authentication settings

3. **Alert notifications not working**
   - Verify SMTP/Slack configuration
   - Check network connectivity
   - Review alert rule configuration

### Logs

Check service logs for detailed error information:
```bash
# Development
npm run dev

# Production logs
tail -f logs/application-$(date +%Y-%m-%d).log
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.