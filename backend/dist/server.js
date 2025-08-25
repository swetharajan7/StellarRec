"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const http_1 = require("http");
const logger_1 = require("./services/logger");
const universityIntegration_1 = __importDefault(require("./routes/universityIntegration"));
const aiIntelligence_1 = __importDefault(require("./routes/aiIntelligence"));
const auth_1 = __importDefault(require("./routes/auth"));
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const logger = new logger_1.Logger('Server');
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        services: {
            authentication: 'active',
            universityIntegration: 'active',
            aiIntelligence: 'active'
        }
    });
});
app.use('/api/auth', auth_1.default);
app.use('/api/university-integration', universityIntegration_1.default);
app.use('/api/ai-intelligence', aiIntelligence_1.default);
app.get('/api', (req, res) => {
    res.json({
        name: 'StellarRec API',
        version: '1.0.0',
        description: 'Intelligent University Application Platform',
        endpoints: {
            authentication: '/api/auth',
            universityIntegration: '/api/university-integration',
            aiIntelligence: '/api/ai-intelligence',
            health: '/health',
            documentation: '/api/docs'
        },
        features: [
            'University Integration Hub',
            'AI-Powered University Matching',
            'Intelligent Content Optimization',
            'Predictive Analytics',
            'Automated Workflow Management',
            'Real-time Insights'
        ]
    });
});
app.get('/api/docs', (req, res) => {
    res.json({
        message: 'API Documentation',
        swagger: '/api/swagger.json',
        postman: '/postman_collection.json'
    });
});
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        message: `The requested endpoint ${req.originalUrl} does not exist`,
        availableEndpoints: [
            '/api/auth',
            '/api/university-integration',
            '/api/ai-intelligence',
            '/health',
            '/api'
        ]
    });
});
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    logger.info(`🚀 StellarRec Server running on port ${PORT}`);
    logger.info(`📚 API Documentation: http://localhost:${PORT}/api`);
    logger.info(`🏥 Health Check: http://localhost:${PORT}/health`);
    logger.info(`🤖 AI Intelligence: http://localhost:${PORT}/api/ai-intelligence`);
    logger.info(`🏫 University Integration: http://localhost:${PORT}/api/university-integration`);
});
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
    });
});
process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
    });
});
exports.default = app;
//# sourceMappingURL=server.js.map