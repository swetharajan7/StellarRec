import { OpenApiSpec, ServiceDefinition, GenerationOptions, ApiDocumentationConfig } from '../types';

export class OpenApiGenerator {
  private config: ApiDocumentationConfig;

  constructor(config: ApiDocumentationConfig) {
    this.config = config;
  }

  async generateSpec(service: ServiceDefinition, options: GenerationOptions): Promise<OpenApiSpec> {
    const spec: OpenApiSpec = {
      openapi: '3.0.3',
      info: {
        title: `${service.name} API`,
        version: service.version,
        description: `API documentation for ${service.name} service`,
        contact: {
          name: 'StellarRec API Team',
          email: 'api@stellarrec.com',
          url: 'https://stellarrec.com/support'
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT'
        }
      },
      servers: [
        {
          url: service.baseUrl,
          description: 'Production server'
        },
        {
          url: service.baseUrl.replace('api.', 'staging-api.'),
          description: 'Staging server'
        },
        {
          url: 'http://localhost:3000',
          description: 'Development server'
        }
      ],
      paths: this.generatePaths(service, options),
      components: {
        schemas: this.generateSchemas(service),
        securitySchemes: this.generateSecuritySchemes(),
        responses: this.generateCommonResponses(),
        parameters: this.generateCommonParameters()
      },
      security: [
        { bearerAuth: [] }
      ],
      tags: service.tags || []
    };

    if (options.validate) {
      this.validateSpec(spec);
    }

    return spec;
  }

  async generateCombinedSpec(services: ServiceDefinition[], options: GenerationOptions): Promise<OpenApiSpec> {
    const combinedSpec: OpenApiSpec = {
      openapi: '3.0.3',
      info: {
        title: this.config.title,
        version: this.config.version,
        description: this.config.description || 'Comprehensive API for the StellarRec platform',
        contact: {
          name: 'StellarRec API Team',
          email: 'api@stellarrec.com',
          url: 'https://stellarrec.com/support'
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT'
        }
      },
      servers: [
        {
          url: this.config.baseUrl,
          description: 'Production server'
        },
        {
          url: this.config.baseUrl.replace('api.', 'staging-api.'),
          description: 'Staging server'
        },
        {
          url: 'http://localhost:3000',
          description: 'Development server'
        }
      ],
      paths: {},
      components: {
        schemas: {},
        securitySchemes: this.generateSecuritySchemes(),
        responses: this.generateCommonResponses(),
        parameters: this.generateCommonParameters()
      },
      security: [
        { bearerAuth: [] }
      ],
      tags: []
    };

    // Combine all services
    for (const service of services) {
      const servicePaths = this.generatePaths(service, options);
      Object.assign(combinedSpec.paths, servicePaths);
      Object.assign(combinedSpec.components.schemas, service.schemas);
      
      if (service.tags) {
        combinedSpec.tags.push(...service.tags);
      }
    }

    // Remove duplicate tags
    combinedSpec.tags = combinedSpec.tags.filter((tag, index, self) => 
      index === self.findIndex(t => t.name === tag.name)
    );

    if (options.validate) {
      this.validateSpec(combinedSpec);
    }

    return combinedSpec;
  }

  private generatePaths(service: ServiceDefinition, options: GenerationOptions): Record<string, any> {
    const paths: Record<string, any> = {};

    for (const endpoint of service.endpoints) {
      if (!options.includeDeprecated && endpoint.deprecated) {
        continue;
      }

      const path = endpoint.path;
      const method = endpoint.method?.toLowerCase() || 'get';

      if (!paths[path]) {
        paths[path] = {};
      }

      paths[path][method] = {
        summary: endpoint.summary,
        description: endpoint.description,
        operationId: endpoint.operationId,
        tags: endpoint.tags,
        parameters: this.generateParameters(endpoint.parameters || []),
        requestBody: endpoint.requestBody ? this.generateRequestBody(endpoint.requestBody) : undefined,
        responses: this.generateResponses(endpoint.responses),
        security: endpoint.security || [{ bearerAuth: [] }],
        deprecated: endpoint.deprecated || false
      };

      // Remove undefined fields
      Object.keys(paths[path][method]).forEach(key => {
        if (paths[path][method][key] === undefined) {
          delete paths[path][method][key];
        }
      });
    }

    return paths;
  }

  private generateParameters(parameters: any[]): any[] {
    return parameters.map(param => ({
      name: param.name,
      in: param.in,
      required: param.required,
      description: param.description,
      schema: param.schema,
      example: param.example
    }));
  }

  private generateRequestBody(requestBody: any): any {
    return {
      required: requestBody.required,
      content: requestBody.content
    };
  }

  private generateResponses(responses: Record<string, any>): Record<string, any> {
    const generatedResponses: Record<string, any> = {};

    for (const [status, response] of Object.entries(responses)) {
      generatedResponses[status] = {
        description: response.description,
        content: response.content,
        headers: response.headers
      };

      // Remove undefined fields
      Object.keys(generatedResponses[status]).forEach(key => {
        if (generatedResponses[status][key] === undefined) {
          delete generatedResponses[status][key];
        }
      });
    }

    // Add common error responses
    if (!generatedResponses['400']) {
      generatedResponses['400'] = { $ref: '#/components/responses/BadRequest' };
    }
    if (!generatedResponses['401']) {
      generatedResponses['401'] = { $ref: '#/components/responses/Unauthorized' };
    }
    if (!generatedResponses['403']) {
      generatedResponses['403'] = { $ref: '#/components/responses/Forbidden' };
    }
    if (!generatedResponses['404']) {
      generatedResponses['404'] = { $ref: '#/components/responses/NotFound' };
    }
    if (!generatedResponses['429']) {
      generatedResponses['429'] = { $ref: '#/components/responses/RateLimited' };
    }
    if (!generatedResponses['500']) {
      generatedResponses['500'] = { $ref: '#/components/responses/InternalServerError' };
    }

    return generatedResponses;
  }

  private generateSchemas(service: ServiceDefinition): Record<string, any> {
    const schemas = { ...service.schemas };

    // Add common schemas
    schemas.Error = {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: {
          type: 'string',
          description: 'Error code',
          example: 'VALIDATION_ERROR'
        },
        message: {
          type: 'string',
          description: 'Human-readable error message',
          example: 'Invalid request parameters'
        },
        details: {
          type: 'array',
          description: 'Detailed error information',
          items: {
            type: 'object',
            properties: {
              field: {
                type: 'string',
                description: 'Field that caused the error'
              },
              message: {
                type: 'string',
                description: 'Field-specific error message'
              },
              code: {
                type: 'string',
                description: 'Field-specific error code'
              }
            }
          }
        },
        request_id: {
          type: 'string',
          description: 'Unique request identifier',
          example: 'req-123456'
        },
        timestamp: {
          type: 'string',
          format: 'date-time',
          description: 'Error timestamp',
          example: '2024-01-15T10:30:00Z'
        }
      }
    };

    schemas.Pagination = {
      type: 'object',
      required: ['page', 'limit', 'total', 'pages'],
      properties: {
        page: {
          type: 'integer',
          minimum: 1,
          description: 'Current page number',
          example: 1
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          description: 'Items per page',
          example: 20
        },
        total: {
          type: 'integer',
          minimum: 0,
          description: 'Total number of items',
          example: 500
        },
        pages: {
          type: 'integer',
          minimum: 0,
          description: 'Total number of pages',
          example: 25
        }
      }
    };

    return schemas;
  }

  private generateSecuritySchemes(): Record<string, any> {
    return {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token obtained from the authentication endpoint'
      },
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for server-to-server authentication'
      },
      oauth2: {
        type: 'oauth2',
        description: 'OAuth 2.0 authorization code flow',
        flows: {
          authorizationCode: {
            authorizationUrl: `${this.config.baseUrl}/oauth/authorize`,
            tokenUrl: `${this.config.baseUrl}/oauth/token`,
            scopes: {
              'read:profile': 'Read user profile',
              'write:profile': 'Update user profile',
              'read:applications': 'Read applications',
              'write:applications': 'Create and update applications',
              'read:universities': 'Read university data',
              'admin': 'Administrative access'
            }
          }
        }
      }
    };
  }

  private generateCommonResponses(): Record<string, any> {
    return {
      BadRequest: {
        description: 'Bad Request - Invalid request parameters',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid request parameters',
                details: [
                  {
                    field: 'email',
                    message: 'Invalid email format',
                    code: 'INVALID_FORMAT'
                  }
                ],
                request_id: 'req-123456',
                timestamp: '2024-01-15T10:30:00Z'
              }
            }
          }
        }
      },
      Unauthorized: {
        description: 'Unauthorized - Authentication required',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: {
                code: 'AUTHENTICATION_REQUIRED',
                message: 'Authentication required',
                request_id: 'req-123456',
                timestamp: '2024-01-15T10:30:00Z'
              }
            }
          }
        }
      },
      Forbidden: {
        description: 'Forbidden - Insufficient permissions',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: {
                code: 'AUTHORIZATION_FAILED',
                message: 'Insufficient permissions',
                request_id: 'req-123456',
                timestamp: '2024-01-15T10:30:00Z'
              }
            }
          }
        }
      },
      NotFound: {
        description: 'Not Found - Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: {
                code: 'RESOURCE_NOT_FOUND',
                message: 'Resource not found',
                request_id: 'req-123456',
                timestamp: '2024-01-15T10:30:00Z'
              }
            }
          }
        }
      },
      RateLimited: {
        description: 'Rate Limited - Too many requests',
        headers: {
          'X-RateLimit-Limit': {
            description: 'Request limit per hour',
            schema: { type: 'integer' }
          },
          'X-RateLimit-Remaining': {
            description: 'Remaining requests in current window',
            schema: { type: 'integer' }
          },
          'X-RateLimit-Reset': {
            description: 'Time when rate limit resets (Unix timestamp)',
            schema: { type: 'integer' }
          },
          'Retry-After': {
            description: 'Seconds to wait before retrying',
            schema: { type: 'integer' }
          }
        },
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Rate limit exceeded',
                request_id: 'req-123456',
                timestamp: '2024-01-15T10:30:00Z'
              }
            }
          }
        }
      },
      InternalServerError: {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'An unexpected error occurred',
                request_id: 'req-123456',
                timestamp: '2024-01-15T10:30:00Z'
              }
            }
          }
        }
      }
    };
  }

  private generateCommonParameters(): Record<string, any> {
    return {
      PageParam: {
        name: 'page',
        in: 'query',
        description: 'Page number for pagination',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          default: 1
        },
        example: 1
      },
      LimitParam: {
        name: 'limit',
        in: 'query',
        description: 'Number of items per page',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 20
        },
        example: 20
      },
      SearchParam: {
        name: 'search',
        in: 'query',
        description: 'Search query string',
        required: false,
        schema: {
          type: 'string',
          minLength: 1,
          maxLength: 100
        },
        example: 'Stanford University'
      },
      SortParam: {
        name: 'sort',
        in: 'query',
        description: 'Sort field and direction',
        required: false,
        schema: {
          type: 'string',
          pattern: '^[a-zA-Z_][a-zA-Z0-9_]*(:asc|:desc)?$'
        },
        example: 'created_at:desc'
      }
    };
  }

  private validateSpec(spec: OpenApiSpec): void {
    // Basic validation
    if (!spec.openapi) {
      throw new Error('OpenAPI version is required');
    }

    if (!spec.info || !spec.info.title || !spec.info.version) {
      throw new Error('API info (title and version) is required');
    }

    if (!spec.paths || Object.keys(spec.paths).length === 0) {
      throw new Error('At least one path is required');
    }

    // Validate paths
    for (const [path, methods] of Object.entries(spec.paths)) {
      if (!path.startsWith('/')) {
        throw new Error(`Path must start with '/': ${path}`);
      }

      for (const [method, operation] of Object.entries(methods)) {
        if (!operation.operationId) {
          throw new Error(`Operation ID is required for ${method.toUpperCase()} ${path}`);
        }

        if (!operation.responses || Object.keys(operation.responses).length === 0) {
          throw new Error(`At least one response is required for ${method.toUpperCase()} ${path}`);
        }
      }
    }

    console.log('✅ OpenAPI specification validation passed');
  }
}