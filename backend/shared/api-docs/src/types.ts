export interface ApiDocumentationConfig {
  title: string;
  version: string;
  description?: string;
  baseUrl: string;
  outputDir: string;
  theme?: DocumentationTheme;
  languages: string[];
  includeExamples: boolean;
  generateMockServer: boolean;
  versioning: VersionConfig;
}

export interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
    contact?: {
      name: string;
      email: string;
      url: string;
    };
    license?: {
      name: string;
      url: string;
    };
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, Record<string, EndpointDefinition>>;
  components: {
    schemas: Record<string, SchemaDefinition>;
    securitySchemes: Record<string, any>;
    responses: Record<string, any>;
    parameters: Record<string, any>;
  };
  security: Array<Record<string, string[]>>;
  tags: Array<{
    name: string;
    description: string;
  }>;
}

export interface EndpointDefinition {
  summary: string;
  description?: string;
  operationId: string;
  tags: string[];
  parameters?: Array<{
    name: string;
    in: 'query' | 'path' | 'header' | 'cookie';
    required: boolean;
    schema: SchemaDefinition;
    description?: string;
    example?: any;
  }>;
  requestBody?: {
    required: boolean;
    content: Record<string, {
      schema: SchemaDefinition;
      examples?: Record<string, any>;
    }>;
  };
  responses: Record<string, {
    description: string;
    content?: Record<string, {
      schema: SchemaDefinition;
      examples?: Record<string, any>;
    }>;
    headers?: Record<string, any>;
  }>;
  security?: Array<Record<string, string[]>>;
  deprecated?: boolean;
}

export interface SchemaDefinition {
  type?: string;
  format?: string;
  properties?: Record<string, SchemaDefinition>;
  items?: SchemaDefinition;
  required?: string[];
  enum?: any[];
  example?: any;
  description?: string;
  $ref?: string;
  allOf?: SchemaDefinition[];
  oneOf?: SchemaDefinition[];
  anyOf?: SchemaDefinition[];
  additionalProperties?: boolean | SchemaDefinition;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
}

export interface CodeExample {
  language: string;
  label: string;
  code: string;
  description?: string;
}

export interface VersionConfig {
  strategy: 'url' | 'header' | 'query';
  current: string;
  supported: string[];
  deprecated: string[];
  deprecationNotice: number; // months
}

export interface DocumentationTheme {
  primaryColor: string;
  secondaryColor: string;
  logo?: string;
  favicon?: string;
  customCss?: string;
  layout: 'sidebar' | 'top-nav';
}

export interface ServiceDefinition {
  name: string;
  version: string;
  baseUrl: string;
  endpoints: EndpointDefinition[];
  schemas: Record<string, SchemaDefinition>;
  tags: Array<{
    name: string;
    description: string;
  }>;
}

export interface MockServerConfig {
  port: number;
  host: string;
  enableCors: boolean;
  responseDelay: number;
  enableLogging: boolean;
  customResponses?: Record<string, any>;
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    path: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
}

export interface GenerationOptions {
  includeDeprecated: boolean;
  includeInternal: boolean;
  outputFormat: 'yaml' | 'json';
  minify: boolean;
  validate: boolean;
}

export interface CodeGenerationTemplate {
  language: string;
  template: string;
  outputExtension: string;
  dependencies?: string[];
  instructions?: string;
}

export interface ApiEndpoint {
  path: string;
  method: string;
  operationId: string;
  summary: string;
  description?: string;
  tags: string[];
  parameters: ApiParameter[];
  requestBody?: ApiRequestBody;
  responses: Record<string, ApiResponse>;
  security?: Array<Record<string, string[]>>;
  deprecated?: boolean;
}

export interface ApiParameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  required: boolean;
  schema: SchemaDefinition;
  description?: string;
  example?: any;
}

export interface ApiRequestBody {
  required: boolean;
  content: Record<string, {
    schema: SchemaDefinition;
    examples?: Record<string, any>;
  }>;
}

export interface ApiResponse {
  description: string;
  content?: Record<string, {
    schema: SchemaDefinition;
    examples?: Record<string, any>;
  }>;
  headers?: Record<string, any>;
}

export interface DocumentationSection {
  title: string;
  content: string;
  order: number;
  subsections?: DocumentationSection[];
}

export interface ExampleRequest {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
}

export interface ExampleResponse {
  status: number;
  headers?: Record<string, string>;
  body?: any;
}

export interface ApiExample {
  title: string;
  description?: string;
  request: ExampleRequest;
  response: ExampleResponse;
  codeExamples: CodeExample[];
}

export interface DeprecationInfo {
  version: string;
  deprecatedIn: string;
  removedIn?: string;
  reason: string;
  migration?: string;
}

export interface RateLimitInfo {
  requests: number;
  window: string;
  burst?: number;
  scope: 'global' | 'user' | 'ip';
}

export interface WebhookDefinition {
  event: string;
  description: string;
  payload: SchemaDefinition;
  example: any;
}

export interface SdkConfig {
  language: string;
  packageName: string;
  version: string;
  author: string;
  license: string;
  repository?: string;
  dependencies: Record<string, string>;
  devDependencies?: Record<string, string>;
}