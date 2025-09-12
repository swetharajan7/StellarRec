#!/usr/bin/env node

/**
 * Simple startup script for the StellarRec backend server
 * This loads environment variables and starts the main server
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

// Validate required environment variables
const requiredEnvVars = ['SIGNING_SECRET'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.warn('⚠️  Warning: Missing environment variables:', missingEnvVars.join(', '));
  console.warn('   The server will use default values, but this is not recommended for production.');
}

// Log startup info
console.log('🚀 Starting StellarRec Backend Server...');
console.log('📧 Email provider:', process.env.RESEND_API_KEY ? 'Resend' : 'Console (dev mode)');
console.log('🌐 Frontend base:', process.env.FRONTEND_BASE || 'https://stellarrec.netlify.app/dashboard');
console.log('🔒 CORS origins:', process.env.CORS_ORIGIN || 'All origins (dev mode)');

// Import and start the main server
import('./server.js').catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});