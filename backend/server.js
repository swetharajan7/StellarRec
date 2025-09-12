// StellarRec Backend Server
// File: backend/server.js
// Purpose: Main server file for handling recommendation requests

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Import routes
const recommendationRoutes = require('./routes/recommendations');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(cors({
    origin: [
        'https://stellarrec.netlify.app',
        'http://localhost:3000',
        'http://127.0.0.1:3000'
    ],
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for uploaded documents
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/recommendations', recommendationRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'StellarRec API is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to StellarRec API',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            recommendations: '/api/recommendations'
        },
        documentation: 'https://github.com/swetharajan7/StellarRec'
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server Error:', error);
    
    res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        availableEndpoints: [
            'GET /',
            'GET /health',
            'POST /api/recommendations/request',
            'GET /api/recommendations/validate/:token',
            'POST /api/recommendations/submit'
        ]
    });
});

// Start server
async function startServer() {
    try {
        console.log('🚀 Starting StellarRec API Server...');
        
        // Start listening
        app.listen(PORT, () => {
            console.log('\n🚀 StellarRec API Server Started');
            console.log('=' .repeat(50));
            console.log(`🌐 Server running on port: ${PORT}`);
            console.log(`📱 Local URL: http://localhost:${PORT}`);
            console.log(`🔍 Health check: http://localhost:${PORT}/health`);
            console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log('=' .repeat(50));
            
            // Show available endpoints
            console.log('\n📋 Available Endpoints:');
            console.log('   GET  /', '                    - API information');
            console.log('   GET  /health', '             - Health check');
            console.log('   POST /api/recommendations/request - Send recommendation request');
            console.log('   GET  /api/recommendations/validate/:token - Validate token');
            console.log('   POST /api/recommendations/submit - Submit recommendation');
            console.log('\n🔗 Frontend URL: https://stellarrec.netlify.app');
            console.log('📧 Email mode: Console logging (no SMTP configured)');
        });
        
    } catch (error) {
        console.error('💥 Failed to start server:', error.message);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM signal');
    console.log('🔄 Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT signal (Ctrl+C)');
    console.log('🔄 Shutting down gracefully...');
    process.exit(0);
});

// Start the server
startServer();

module.exports = app;
