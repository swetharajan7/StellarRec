import { PrismaClient } from '@prisma/client';
import axios, { AxiosResponse } from 'axios';
import FormData from 'form-data';
import crypto from 'crypto';
import { logger } from '../utils/logger';

export interface UniversityIntegration {
  university_id: string;
  integration_type: 'api' | 'webhook' | 'ftp' | 'email' | 'portal';
  endpoint_url?: string;
  auth_method: 'oauth2' | 'api_key' | 'basic_auth' | 'certificate';
  credentials: any;
  data_format: 'json' | 'xml' | 'form_data' | 'pdf';
  field_mappings: any;
  is_active: boolean;
}

export interface SubmissionData {
  application_id: string;
  university_id: string;
  student_data: any;
  application_data: any;
  documents: any[];
  submission_type: 'application' | 'document' | 'update';
}

export class IntegrationService {
  constructor(private prisma: PrismaClient) {}

  async createIntegration(integrationData: UniversityIntegration) {
    try {
      // Encrypt sensitive credentials
      const encryptedCredentials = this.encryptCredentials(integrationData.credentials);
      
      const integration = await this.prisma.universities.update({
        where: { id: integrationData.university_id },
        data: {
          integration_config: {
            integration_type: integrationData.integration_type,
            endpoint_url: integrationData.endpoint_url,
            auth_method: integrationData.auth_method,
            credentials: encryptedCredentials,
            data_format: integrationData.data_format,
            field_mappings: integrationData.field_mappings,
            is_active: integrationData.is_active,
            created_at: new Date().toISOString(),
            last_tested: null
          }
        }
      });

      logger.info(`Integration created for university: ${integrationData.university_id}`);
      return integration;
    } catch (error) {
      logger.error('Error creating integration:', error);
      throw error;
    }
  }

  async testIntegration(universityId: string): Promise<{ success: boolean; message: string; response_time?: number }> {
    try {
      const university = await this.prisma.universities.findUnique({
        where: { id: universityId }
      });

      if (!university || !university.integration_config) {
        return { success: false, message: 'Integration not found' };
      }

      const config = university.integration_config as any;
      const startTime = Date.now();

      let testResult: { success: boolean; message: string };

      switch (config.integration_type) {
        case 'api':
          testResult = await this.testApiIntegration(config);
          break;
        case 'webhook':
          testResult = await this.testWebhookIntegration(config);
          break;
        case 'ftp':
          testResult = await this.testFtpIntegration(config);
          break;
        case 'email':
          testResult = await this.testEmailIntegration(config);
          break;
        default:
          testResult = { success: false, message: 'Unsupported integration type' };
      }

      const responseTime = Date.now() - startTime;

      // Update last tested timestamp
      await this.prisma.universities.update({
        where: { id: universityId },
        data: {
          integration_config: {
            ...config,
            last_tested: new Date().toISOString(),
            last_test_result: testResult
          }
        }
      });

      return { ...testResult, response_time: responseTime };
    } catch (error) {
      logger.error('Error testing integration:', error);
      return { success: false, message: `Test failed: ${error.message}` };
    }
  }

  async submitApplication(submissionData: SubmissionData): Promise<{ success: boolean; confirmation_id?: string; error?: string }> {
    try {
      const university = await this.prisma.universities.findUnique({
        where: { id: submissionData.university_id }
      });

      if (!university || !university.integration_config) {
        throw new Error('University integration not configured');
      }

      const config = university.integration_config as any;
      
      if (!config.is_active) {
        throw new Error('University integration is disabled');
      }

      // Transform data according to university format
      const transformedData = await this.transformSubmissionData(submissionData, config);

      let submissionResult: { success: boolean; confirmation_id?: string; error?: string };

      switch (config.integration_type) {
        case 'api':
          submissionResult = await this.submitViaApi(transformedData, config);
          break;
        case 'webhook':
          submissionResult = await this.submitViaWebhook(transformedData, config);
          break;
        case 'ftp':
          submissionResult = await this.submitViaFtp(transformedData, config);
          break;
        case 'email':
          submissionResult = await this.submitViaEmail(transformedData, config);
          break;
        default:
          submissionResult = { success: false, error: 'Unsupported integration type' };
      }

      // Log submission attempt
      await this.logSubmissionAttempt(submissionData, submissionResult);

      return submissionResult;
    } catch (error) {
      logger.error('Error submitting application:', error);
      return { success: false, error: error.message };
    }
  }

  private async testApiIntegration(config: any): Promise<{ success: boolean; message: string }> {
    try {
      const headers = await this.buildAuthHeaders(config);
      const testEndpoint = config.test_endpoint || `${config.endpoint_url}/health`;

      const response = await axios.get(testEndpoint, {
        headers,
        timeout: 10000
      });

      if (response.status >= 200 && response.status < 300) {
        return { success: true, message: 'API connection successful' };
      } else {
        return { success: false, message: `API returned status: ${response.status}` };
      }
    } catch (error) {
      return { success: false, message: `API test failed: ${error.message}` };
    }
  }

  private async testWebhookIntegration(config: any): Promise<{ success: boolean; message: string }> {
    try {
      const testPayload = { test: true, timestamp: new Date().toISOString() };
      const headers = await this.buildAuthHeaders(config);

      const response = await axios.post(config.endpoint_url, testPayload, {
        headers,
        timeout: 10000
      });

      if (response.status >= 200 && response.status < 300) {
        return { success: true, message: 'Webhook test successful' };
      } else {
        return { success: false, message: `Webhook returned status: ${response.status}` };
      }
    } catch (error) {
      return { success: false, message: `Webhook test failed: ${error.message}` };
    }
  }

  private async testFtpIntegration(config: any): Promise<{ success: boolean; message: string }> {
    // Mock FTP test - in production would use actual FTP client
    return { success: true, message: 'FTP connection test successful (mock)' };
  }

  private async testEmailIntegration(config: any): Promise<{ success: boolean; message: string }> {
    // Mock email test - in production would test SMTP connection
    return { success: true, message: 'Email configuration test successful (mock)' };
  }

  private async submitViaApi(data: any, config: any): Promise<{ success: boolean; confirmation_id?: string; error?: string }> {
    try {
      const headers = await this.buildAuthHeaders(config);
      headers['Content-Type'] = config.data_format === 'json' ? 'application/json' : 'application/xml';

      const response = await axios.post(config.endpoint_url, data, {
        headers,
        timeout: 30000
      });

      if (response.status >= 200 && response.status < 300) {
        const confirmationId = this.extractConfirmationId(response, config);
        return { success: true, confirmation_id: confirmationId };
      } else {
        return { success: false, error: `API returned status: ${response.status}` };
      }
    } catch (error) {
      return { success: false, error: `API submission failed: ${error.message}` };
    }
  }

  private async submitViaWebhook(data: any, config: any): Promise<{ success: boolean; confirmation_id?: string; error?: string }> {
    try {
      const headers = await this.buildAuthHeaders(config);
      const payload = {
        ...data,
        webhook_signature: this.generateWebhookSignature(data, config.webhook_secret)
      };

      const response = await axios.post(config.endpoint_url, payload, {
        headers,
        timeout: 30000
      });

      if (response.status >= 200 && response.status < 300) {
        const confirmationId = this.extractConfirmationId(response, config);
        return { success: true, confirmation_id: confirmationId };
      } else {
        return { success: false, error: `Webhook returned status: ${response.status}` };
      }
    } catch (error) {
      return { success: false, error: `Webhook submission failed: ${error.message}` };
    }
  }

  private async submitViaFtp(data: any, config: any): Promise<{ success: boolean; confirmation_id?: string; error?: string }> {
    // Mock FTP submission - in production would use actual FTP client
    const confirmationId = `FTP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return { success: true, confirmation_id };
  }

  private async submitViaEmail(data: any, config: any): Promise<{ success: boolean; confirmation_id?: string; error?: string }> {
    // Mock email submission - in production would use nodemailer
    const confirmationId = `EMAIL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return { success: true, confirmation_id };
  }

  private async buildAuthHeaders(config: any): Promise<any> {
    const credentials = this.decryptCredentials(config.credentials);
    const headers: any = {};

    switch (config.auth_method) {
      case 'api_key':
        headers['Authorization'] = `Bearer ${credentials.api_key}`;
        break;
      case 'basic_auth':
        const auth = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
        break;
      case 'oauth2':
        // In production, would handle OAuth2 token refresh
        headers['Authorization'] = `Bearer ${credentials.access_token}`;
        break;
      case 'certificate':
        // Certificate-based auth would be handled at the HTTP client level
        break;
    }

    return headers;
  }

  private async transformSubmissionData(submissionData: SubmissionData, config: any): Promise<any> {
    const fieldMappings = config.field_mappings || {};
    const transformedData: any = {};

    // Apply field mappings
    for (const [sourceField, targetField] of Object.entries(fieldMappings)) {
      const value = this.getNestedValue(submissionData, sourceField);
      if (value !== undefined) {
        this.setNestedValue(transformedData, targetField as string, value);
      }
    }

    // Add metadata
    transformedData.submission_metadata = {
      submission_id: submissionData.application_id,
      timestamp: new Date().toISOString(),
      source: 'stellarrec',
      version: '1.0'
    };

    // Format according to university requirements
    if (config.data_format === 'xml') {
      return this.convertToXml(transformedData);
    }

    return transformedData;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  private convertToXml(data: any): string {
    // Simple XML conversion - in production would use proper XML library
    const xmlBuilder = (obj: any, indent = 0): string => {
      const spaces = '  '.repeat(indent);
      let xml = '';
      
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
          xml += `${spaces}<${key}>\n${xmlBuilder(value, indent + 1)}${spaces}</${key}>\n`;
        } else {
          xml += `${spaces}<${key}>${value}</${key}>\n`;
        }
      }
      
      return xml;
    };

    return `<?xml version="1.0" encoding="UTF-8"?>\n<application>\n${xmlBuilder(data, 1)}</application>`;
  }

  private extractConfirmationId(response: AxiosResponse, config: any): string {
    const confirmationField = config.confirmation_field || 'confirmation_id';
    return response.data[confirmationField] || `CONF_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateWebhookSignature(data: any, secret: string): string {
    const payload = JSON.stringify(data);
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  private encryptCredentials(credentials: any): string {
    const key = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
    const cipher = crypto.createCipher('aes-256-cbc', key);
    let encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  private decryptCredentials(encryptedCredentials: string): any {
    const key = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    let decrypted = decipher.update(encryptedCredentials, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  }

  private async logSubmissionAttempt(submissionData: SubmissionData, result: any) {
    try {
      // In production, this would log to a submissions table
      logger.info('Submission attempt logged', {
        application_id: submissionData.application_id,
        university_id: submissionData.university_id,
        success: result.success,
        confirmation_id: result.confirmation_id,
        error: result.error
      });
    } catch (error) {
      logger.error('Error logging submission attempt:', error);
    }
  }

  async getIntegrationStatus(universityId: string) {
    const university = await this.prisma.universities.findUnique({
      where: { id: universityId },
      select: {
        id: true,
        name: true,
        integration_config: true
      }
    });

    if (!university || !university.integration_config) {
      return { configured: false };
    }

    const config = university.integration_config as any;
    
    return {
      configured: true,
      integration_type: config.integration_type,
      is_active: config.is_active,
      last_tested: config.last_tested,
      last_test_result: config.last_test_result,
      data_format: config.data_format,
      auth_method: config.auth_method
    };
  }

  async listIntegrations() {
    const universities = await this.prisma.universities.findMany({
      where: {
        integration_config: {
          not: null
        }
      },
      select: {
        id: true,
        name: true,
        short_name: true,
        integration_config: true
      }
    });

    return universities.map(uni => ({
      university_id: uni.id,
      university_name: uni.name,
      short_name: uni.short_name,
      integration_type: (uni.integration_config as any)?.integration_type,
      is_active: (uni.integration_config as any)?.is_active,
      last_tested: (uni.integration_config as any)?.last_tested
    }));
  }
}