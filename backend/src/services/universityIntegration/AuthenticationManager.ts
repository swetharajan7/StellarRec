import { Logger } from '../logger';
import { DatabaseService } from '../database';
import * as crypto from 'crypto';

export interface AuthCredentials {
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  username?: string;
  password?: string;
  certificate?: string;
  privateKey?: string;
}

export class AuthenticationManager {
  private logger = new Logger('AuthenticationManager');
  private db: DatabaseService;
  private encryptionKey: string;
  private credentialsCache = new Map<string, { credentials: AuthCredentials; expiresAt: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.db = new DatabaseService();
    this.encryptionKey = process.env.CREDENTIALS_ENCRYPTION_KEY || this.generateEncryptionKey();
  }

  /**
   * Get credentials for an integration type
   */
  async getCredentials(integrationType: string): Promise<AuthCredentials | null> {
    try {
      // Check cache first
      const cacheKey = integrationType;
      const cached = this.credentialsCache.get(cacheKey);
      
      if (cached && cached.expiresAt > Date.now()) {
        return cached.credentials;
      }

      // Fetch from database
      const query = `
        SELECT credential_name, credential_value, expires_at
        FROM integration_credentials 
        WHERE integration_type = $1 AND is_active = true
      `;

      const result = await this.db.query(query, [integrationType]);
      
      if (result.rows.length === 0) {
        return null;
      }

      // Decrypt and build credentials object
      const credentials: AuthCredentials = {};
      
      for (const row of result.rows) {
        const decryptedValue = this.decrypt(row.credential_value);
        credentials[row.credential_name as keyof AuthCredentials] = decryptedValue;
        
        if (row.expires_at) {
          credentials.expiresAt = new Date(row.expires_at);
        }
      }

      // Cache the credentials
      this.credentialsCache.set(cacheKey, {
        credentials,
        expiresAt: Date.now() + this.CACHE_TTL
      });

      return credentials;
    } catch (error) {
      this.logger.error(`Failed to get credentials for ${integrationType}:`, error);
      return null;
    }
  }

  /**
   * Store credentials for an integration type
   */
  async storeCredentials(integrationType: string, credentials: AuthCredentials): Promise<void> {
    try {
      // Clear existing credentials
      await this.db.query(
        'DELETE FROM integration_credentials WHERE integration_type = $1',
        [integrationType]
      );

      // Store new credentials
      for (const [key, value] of Object.entries(credentials)) {
        if (value !== undefined && key !== 'expiresAt') {
          const encryptedValue = this.encrypt(value as string);
          
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

      // Clear cache
      this.credentialsCache.delete(integrationType);
      
      this.logger.info(`Stored credentials for ${integrationType}`);
    } catch (error) {
      this.logger.error(`Failed to store credentials for ${integrationType}:`, error);
      throw error;
    }
  }

  /**
   * Refresh OAuth2 token if needed
   */
  async refreshTokenIfNeeded(integrationType: string): Promise<AuthCredentials | null> {
    try {
      const credentials = await this.getCredentials(integrationType);
      
      if (!credentials || !credentials.refreshToken) {
        return credentials;
      }

      // Check if token needs refresh (refresh 5 minutes before expiry)
      const needsRefresh = credentials.expiresAt && 
        credentials.expiresAt.getTime() - Date.now() < 5 * 60 * 1000;

      if (!needsRefresh) {
        return credentials;
      }

      this.logger.info(`Refreshing OAuth2 token for ${integrationType}`);

      // Refresh token based on integration type
      const newCredentials = await this.performTokenRefresh(integrationType, credentials);
      
      if (newCredentials) {
        await this.storeCredentials(integrationType, newCredentials);
        return newCredentials;
      }

      return credentials;
    } catch (error) {
      this.logger.error(`Failed to refresh token for ${integrationType}:`, error);
      return null;
    }
  }

  /**
   * Validate credentials for an integration
   */
  async validateCredentials(integrationType: string): Promise<{
    valid: boolean;
    error?: string;
    expiresAt?: Date;
  }> {
    try {
      const credentials = await this.getCredentials(integrationType);
      
      if (!credentials) {
        return { valid: false, error: 'No credentials found' };
      }

      // Check expiration
      if (credentials.expiresAt && credentials.expiresAt < new Date()) {
        return { valid: false, error: 'Credentials expired' };
      }

      // Perform integration-specific validation
      const validationResult = await this.performCredentialValidation(integrationType, credentials);
      
      return validationResult;
    } catch (error) {
      this.logger.error(`Failed to validate credentials for ${integrationType}:`, error);
      return { valid: false, error: error.message };
    }
  }

  /**
   * Get authentication headers for API requests
   */
  async getAuthHeaders(integrationType: string): Promise<Record<string, string>> {
    try {
      const credentials = await this.refreshTokenIfNeeded(integrationType);
      
      if (!credentials) {
        throw new Error(`No valid credentials for ${integrationType}`);
      }

      // Generate headers based on auth type
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
    } catch (error) {
      this.logger.error(`Failed to get auth headers for ${integrationType}:`, error);
      throw error;
    }
  }

  /**
   * Rotate credentials (security best practice)
   */
  async rotateCredentials(integrationType: string): Promise<void> {
    try {
      this.logger.info(`Rotating credentials for ${integrationType}`);
      
      // This would typically involve:
      // 1. Generating new credentials with the external service
      // 2. Testing the new credentials
      // 3. Storing the new credentials
      // 4. Deactivating old credentials
      
      // For now, just mark for manual rotation
      await this.db.query(`
        UPDATE integration_credentials 
        SET metadata = COALESCE(metadata, '{}') || '{"rotation_needed": true, "rotation_requested_at": "' || CURRENT_TIMESTAMP || '"}'
        WHERE integration_type = $1
      `, [integrationType]);

      this.logger.info(`Marked credentials for rotation: ${integrationType}`);
    } catch (error) {
      this.logger.error(`Failed to rotate credentials for ${integrationType}:`, error);
      throw error;
    }
  }

  /**
   * Get credentials that need rotation
   */
  async getCredentialsNeedingRotation(): Promise<Array<{
    integrationType: string;
    lastRotated: Date;
    expiresAt?: Date;
  }>> {
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
    } catch (error) {
      this.logger.error('Failed to get credentials needing rotation:', error);
      return [];
    }
  }

  /**
   * Encrypt sensitive data
   */
  private encrypt(text: string): string {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      this.logger.error('Encryption failed:', error);
      throw new Error('Failed to encrypt credentials');
    }
  }

  /**
   * Decrypt sensitive data
   */
  private decrypt(encryptedText: string): string {
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
    } catch (error) {
      this.logger.error('Decryption failed:', error);
      throw new Error('Failed to decrypt credentials');
    }
  }

  /**
   * Generate encryption key if not provided
   */
  private generateEncryptionKey(): string {
    const key = crypto.randomBytes(32).toString('hex');
    this.logger.warn('Generated temporary encryption key. Set CREDENTIALS_ENCRYPTION_KEY environment variable for production.');
    return key;
  }

  /**
   * Perform token refresh for OAuth2 integrations
   */
  private async performTokenRefresh(integrationType: string, credentials: AuthCredentials): Promise<AuthCredentials | null> {
    // This would be implemented based on each integration's OAuth2 flow
    // For now, return null to indicate refresh not implemented
    this.logger.warn(`Token refresh not implemented for ${integrationType}`);
    return null;
  }

  /**
   * Perform credential validation
   */
  private async performCredentialValidation(integrationType: string, credentials: AuthCredentials): Promise<{
    valid: boolean;
    error?: string;
    expiresAt?: Date;
  }> {
    // Basic validation - check if required fields are present
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

  /**
   * Clear credentials cache
   */
  clearCache(): void {
    this.credentialsCache.clear();
    this.logger.info('Credentials cache cleared');
  }

  /**
   * Get credential statistics
   */
  async getCredentialStatistics(): Promise<{
    totalIntegrations: number;
    activeCredentials: number;
    expiringSoon: number;
    needingRotation: number;
  }> {
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
    } catch (error) {
      this.logger.error('Failed to get credential statistics:', error);
      throw error;
    }
  }
}