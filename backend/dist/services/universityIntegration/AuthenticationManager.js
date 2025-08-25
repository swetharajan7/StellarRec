"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthenticationManager = void 0;
const logger_1 = require("../logger");
const database_1 = require("../database");
const crypto = __importStar(require("crypto"));
class AuthenticationManager {
    constructor() {
        this.logger = new logger_1.Logger('AuthenticationManager');
        this.credentialsCache = new Map();
        this.CACHE_TTL = 5 * 60 * 1000;
        this.db = new database_1.DatabaseService();
        this.encryptionKey = process.env.CREDENTIALS_ENCRYPTION_KEY || this.generateEncryptionKey();
    }
    async getCredentials(integrationType) {
        try {
            const cacheKey = integrationType;
            const cached = this.credentialsCache.get(cacheKey);
            if (cached && cached.expiresAt > Date.now()) {
                return cached.credentials;
            }
            const query = `
        SELECT credential_name, credential_value, expires_at
        FROM integration_credentials 
        WHERE integration_type = $1 AND is_active = true
      `;
            const result = await this.db.query(query, [integrationType]);
            if (result.rows.length === 0) {
                return null;
            }
            const credentials = {};
            for (const row of result.rows) {
                const decryptedValue = this.decrypt(row.credential_value);
                credentials[row.credential_name] = decryptedValue;
                if (row.expires_at) {
                    credentials.expiresAt = new Date(row.expires_at);
                }
            }
            this.credentialsCache.set(cacheKey, {
                credentials,
                expiresAt: Date.now() + this.CACHE_TTL
            });
            return credentials;
        }
        catch (error) {
            this.logger.error(`Failed to get credentials for ${integrationType}:`, error);
            return null;
        }
    }
    async storeCredentials(integrationType, credentials) {
        try {
            await this.db.query('DELETE FROM integration_credentials WHERE integration_type = $1', [integrationType]);
            for (const [key, value] of Object.entries(credentials)) {
                if (value !== undefined && key !== 'expiresAt') {
                    const encryptedValue = this.encrypt(value);
                    await this.db.query(`
            INSERT INTO integration_credentials (
              integration_type, credential_name, credential_value, expires_at, is_active
            ) VALUES ($1, $2, $3, $4, true)
          `, [
                        integrationType,
                        key,
                        encryptedValue,
                        credentials.expiresAt || null
                    ]);
                }
            }
            this.credentialsCache.delete(integrationType);
            this.logger.info(`Stored credentials for ${integrationType}`);
        }
        catch (error) {
            this.logger.error(`Failed to store credentials for ${integrationType}:`, error);
            throw error;
        }
    }
    async refreshTokenIfNeeded(integrationType) {
        try {
            const credentials = await this.getCredentials(integrationType);
            if (!credentials || !credentials.refreshToken) {
                return credentials;
            }
            const needsRefresh = credentials.expiresAt &&
                credentials.expiresAt.getTime() - Date.now() < 5 * 60 * 1000;
            if (!needsRefresh) {
                return credentials;
            }
            this.logger.info(`Refreshing OAuth2 token for ${integrationType}`);
            const newCredentials = await this.performTokenRefresh(integrationType, credentials);
            if (newCredentials) {
                await this.storeCredentials(integrationType, newCredentials);
                return newCredentials;
            }
            return credentials;
        }
        catch (error) {
            this.logger.error(`Failed to refresh token for ${integrationType}:`, error);
            return null;
        }
    }
    async validateCredentials(integrationType) {
        try {
            const credentials = await this.getCredentials(integrationType);
            if (!credentials) {
                return { valid: false, error: 'No credentials found' };
            }
            if (credentials.expiresAt && credentials.expiresAt < new Date()) {
                return { valid: false, error: 'Credentials expired' };
            }
            const validationResult = await this.performCredentialValidation(integrationType, credentials);
            return validationResult;
        }
        catch (error) {
            this.logger.error(`Failed to validate credentials for ${integrationType}:`, error);
            return { valid: false, error: error.message };
        }
    }
    async getAuthHeaders(integrationType) {
        try {
            const credentials = await this.refreshTokenIfNeeded(integrationType);
            if (!credentials) {
                throw new Error(`No valid credentials for ${integrationType}`);
            }
            switch (integrationType) {
                case 'commonapp':
                case 'coalition':
                case 'uc_system':
                case 'ouac':
                    if (credentials.apiKey) {
                        return {
                            'Authorization': `Bearer ${credentials.apiKey}`,
                            'Content-Type': 'application/json'
                        };
                    }
                    break;
                case 'oauth2_integration':
                    if (credentials.accessToken) {
                        return {
                            'Authorization': `Bearer ${credentials.accessToken}`,
                            'Content-Type': 'application/json'
                        };
                    }
                    break;
                case 'basic_auth_integration':
                    if (credentials.username && credentials.password) {
                        const encoded = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
                        return {
                            'Authorization': `Basic ${encoded}`,
                            'Content-Type': 'application/json'
                        };
                    }
                    break;
            }
            throw new Error(`Unable to generate auth headers for ${integrationType}`);
        }
        catch (error) {
            this.logger.error(`Failed to get auth headers for ${integrationType}:`, error);
            throw error;
        }
    }
    async rotateCredentials(integrationType) {
        try {
            this.logger.info(`Rotating credentials for ${integrationType}`);
            await this.db.query(`
        UPDATE integration_credentials 
        SET metadata = COALESCE(metadata, '{}') || '{"rotation_needed": true, "rotation_requested_at": "' || CURRENT_TIMESTAMP || '"}'
        WHERE integration_type = $1
      `, [integrationType]);
            this.logger.info(`Marked credentials for rotation: ${integrationType}`);
        }
        catch (error) {
            this.logger.error(`Failed to rotate credentials for ${integrationType}:`, error);
            throw error;
        }
    }
    async getCredentialsNeedingRotation() {
        try {
            const query = `
        SELECT 
          integration_type,
          MAX(updated_at) as last_rotated,
          MAX(expires_at) as expires_at
        FROM integration_credentials 
        WHERE is_active = true
          AND (
            expires_at < CURRENT_TIMESTAMP + INTERVAL '7 days' OR
            updated_at < CURRENT_TIMESTAMP - INTERVAL '90 days'
          )
        GROUP BY integration_type
      `;
            const result = await this.db.query(query);
            return result.rows.map(row => ({
                integrationType: row.integration_type,
                lastRotated: new Date(row.last_rotated),
                expiresAt: row.expires_at ? new Date(row.expires_at) : undefined
            }));
        }
        catch (error) {
            this.logger.error('Failed to get credentials needing rotation:', error);
            return [];
        }
    }
    encrypt(text) {
        try {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            return iv.toString('hex') + ':' + encrypted;
        }
        catch (error) {
            this.logger.error('Encryption failed:', error);
            throw new Error('Failed to encrypt credentials');
        }
    }
    decrypt(encryptedText) {
        try {
            const parts = encryptedText.split(':');
            if (parts.length !== 2) {
                throw new Error('Invalid encrypted format');
            }
            const iv = Buffer.from(parts[0], 'hex');
            const encrypted = parts[1];
            const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        }
        catch (error) {
            this.logger.error('Decryption failed:', error);
            throw new Error('Failed to decrypt credentials');
        }
    }
    generateEncryptionKey() {
        const key = crypto.randomBytes(32).toString('hex');
        this.logger.warn('Generated temporary encryption key. Set CREDENTIALS_ENCRYPTION_KEY environment variable for production.');
        return key;
    }
    async performTokenRefresh(integrationType, credentials) {
        this.logger.warn(`Token refresh not implemented for ${integrationType}`);
        return null;
    }
    async performCredentialValidation(integrationType, credentials) {
        switch (integrationType) {
            case 'commonapp':
            case 'coalition':
            case 'uc_system':
            case 'ouac':
                if (!credentials.apiKey) {
                    return { valid: false, error: 'API key is required' };
                }
                break;
            case 'oauth2_integration':
                if (!credentials.accessToken) {
                    return { valid: false, error: 'Access token is required' };
                }
                break;
            case 'basic_auth_integration':
                if (!credentials.username || !credentials.password) {
                    return { valid: false, error: 'Username and password are required' };
                }
                break;
        }
        return {
            valid: true,
            expiresAt: credentials.expiresAt
        };
    }
    clearCache() {
        this.credentialsCache.clear();
        this.logger.info('Credentials cache cleared');
    }
    async getCredentialStatistics() {
        try {
            const query = `
        SELECT 
          COUNT(DISTINCT integration_type) as total_integrations,
          COUNT(*) as active_credentials,
          COUNT(CASE WHEN expires_at < CURRENT_TIMESTAMP + INTERVAL '7 days' THEN 1 END) as expiring_soon,
          COUNT(CASE WHEN updated_at < CURRENT_TIMESTAMP - INTERVAL '90 days' THEN 1 END) as needing_rotation
        FROM integration_credentials 
        WHERE is_active = true
      `;
            const result = await this.db.query(query);
            const row = result.rows[0];
            return {
                totalIntegrations: parseInt(row.total_integrations),
                activeCredentials: parseInt(row.active_credentials),
                expiringSoon: parseInt(row.expiring_soon),
                needingRotation: parseInt(row.needing_rotation)
            };
        }
        catch (error) {
            this.logger.error('Failed to get credential statistics:', error);
            throw error;
        }
    }
}
exports.AuthenticationManager = AuthenticationManager;
//# sourceMappingURL=AuthenticationManager.js.map