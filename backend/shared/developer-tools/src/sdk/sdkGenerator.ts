import { SdkConfig, SdkTemplate } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import Mustache from 'mustache';

export class SdkGenerator {
  private templates: Map<string, SdkTemplate> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    // JavaScript/TypeScript SDK Template
    this.templates.set('javascript', {
      language: 'javascript',
      files: {
        'package.json': this.getJavaScriptPackageTemplate(),
        'src/index.ts': this.getJavaScriptIndexTemplate(),
        'src/client.ts': this.getJavaScriptClientTemplate(),
        'src/types.ts': this.getJavaScriptTypesTemplate(),
        'src/auth.ts': this.getJavaScriptAuthTemplate(),
        'src/errors.ts': this.getJavaScriptErrorsTemplate(),
        'README.md': this.getJavaScriptReadmeTemplate(),
        'tsconfig.json': this.getTypeScriptConfigTemplate(),
        '.gitignore': this.getGitIgnoreTemplate(),
        'jest.config.js': this.getJestConfigTemplate()
      },
      dependencies: {
        'axios': '^1.6.0',
        'typescript': '^5.3.0',
        '@types/node': '^20.10.0'
      },
      scripts: {
        'build': 'tsc',
        'test': 'jest',
        'lint': 'eslint src/**/*.ts'
      },
      metadata: {
        packageManager: 'npm',
        buildCommand: 'npm run build',
        testCommand: 'npm test',
        publishCommand: 'npm publish'
      }
    });

    // Python SDK Template
    this.templates.set('python', {
      language: 'python',
      files: {
        'setup.py': this.getPythonSetupTemplate(),
        'stellarrec/__init__.py': this.getPythonInitTemplate(),
        'stellarrec/client.py': this.getPythonClientTemplate(),
        'stellarrec/auth.py': this.getPythonAuthTemplate(),
        'stellarrec/errors.py': this.getPythonErrorsTemplate(),
        'stellarrec/types.py': this.getPythonTypesTemplate(),
        'README.md': this.getPythonReadmeTemplate(),
        'requirements.txt': this.getPythonRequirementsTemplate(),
        'pyproject.toml': this.getPythonProjectTemplate(),
        '.gitignore': this.getPythonGitIgnoreTemplate()
      },
      dependencies: {
        'requests': '>=2.25.0',
        'pydantic': '>=2.0.0',
        'typing-extensions': '>=4.0.0'
      },
      scripts: {
        'test': 'pytest',
        'lint': 'flake8 stellarrec',
        'format': 'black stellarrec'
      },
      metadata: {
        packageManager: 'pip',
        buildCommand: 'python setup.py build',
        testCommand: 'pytest',
        publishCommand: 'python setup.py sdist bdist_wheel && twine upload dist/*'
      }
    });

    // Add more language templates...
    this.initializeJavaTemplate();
    this.initializeCSharpTemplate();
    this.initializePhpTemplate();
    this.initializeRubyTemplate();
  }

  async generate(language: string, config: SdkConfig): Promise<void> {
    const template = this.templates.get(language);
    if (!template) {
      throw new Error(`Unsupported language: ${language}`);
    }

    console.log(`🔨 Generating ${language} SDK...`);

    // Ensure output directory exists
    await fs.mkdir(config.outputDir, { recursive: true });

    // Generate all files from templates
    for (const [filePath, templateContent] of Object.entries(template.files)) {
      const renderedContent = Mustache.render(templateContent, {
        ...config,
        author: config.author || 'StellarRec Team',
        license: config.license || 'MIT',
        repository: config.repository,
        dependencies: template.dependencies,
        scripts: template.scripts
      });

      const fullPath = path.join(config.outputDir, filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, renderedContent, 'utf8');
    }

    // Generate additional language-specific files
    await this.generateLanguageSpecificFiles(language, config);

    console.log(`✅ ${language} SDK generated successfully at ${config.outputDir}`);
  }

  private async generateLanguageSpecificFiles(language: string, config: SdkConfig): Promise<void> {
    switch (language) {
      case 'javascript':
        await this.generateJavaScriptFiles(config);
        break;
      case 'python':
        await this.generatePythonFiles(config);
        break;
      case 'java':
        await this.generateJavaFiles(config);
        break;
      case 'csharp':
        await this.generateCSharpFiles(config);
        break;
    }
  }

  private async generateJavaScriptFiles(config: SdkConfig): Promise<void> {
    // Generate service-specific client files
    const services = ['users', 'universities', 'applications', 'letters'];
    
    for (const service of services) {
      const serviceTemplate = this.getJavaScriptServiceTemplate(service);
      const content = Mustache.render(serviceTemplate, config);
      const filePath = path.join(config.outputDir, 'src', 'services', `${service}.ts`);
      
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf8');
    }
  }

  private async generatePythonFiles(config: SdkConfig): Promise<void> {
    // Generate service-specific client files
    const services = ['users', 'universities', 'applications', 'letters'];
    
    for (const service of services) {
      const serviceTemplate = this.getPythonServiceTemplate(service);
      const content = Mustache.render(serviceTemplate, config);
      const filePath = path.join(config.outputDir, 'stellarrec', 'services', `${service}.py`);
      
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf8');
    }
  }

  private async generateJavaFiles(config: SdkConfig): Promise<void> {
    // Java-specific generation logic
    console.log('Generating Java-specific files...');
  }

  private async generateCSharpFiles(config: SdkConfig): Promise<void> {
    // C#-specific generation logic
    console.log('Generating C#-specific files...');
  }

  // Template methods for JavaScript
  private getJavaScriptPackageTemplate(): string {
    return `{
  "name": "{{packageName}}",
  "version": "{{version}}",
  "description": "Official JavaScript/TypeScript SDK for StellarRec API",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "jest",
    "lint": "eslint src/**/*.ts",
    "format": "prettier --write src/**/*.ts",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.0",
    "eslint": "^8.55.0",
    "prettier": "^3.1.0"
  },
  "keywords": ["stellarrec", "api", "sdk", "university", "applications"],
  "author": "{{author}}",
  "license": "{{license}}",
  "repository": "{{repository}}",
  "bugs": {
    "url": "{{repository}}/issues"
  },
  "homepage": "{{repository}}#readme"
}`;
  }

  private getJavaScriptIndexTemplate(): string {
    return `export { StellarRecClient } from './client';
export { StellarRecAuth } from './auth';
export * from './types';
export * from './errors';

// Service exports
export { UsersService } from './services/users';
export { UniversitiesService } from './services/universities';
export { ApplicationsService } from './services/applications';
export { LettersService } from './services/letters';

// Default export
export { StellarRecClient as default } from './client';`;
  }

  private getJavaScriptClientTemplate(): string {
    return `import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { StellarRecAuth } from './auth';
import { StellarRecError, RateLimitError, AuthenticationError } from './errors';
import { UsersService } from './services/users';
import { UniversitiesService } from './services/universities';
import { ApplicationsService } from './services/applications';
import { LettersService } from './services/letters';

export interface StellarRecClientConfig {
  baseURL?: string;
  apiKey?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export class StellarRecClient {
  private http: AxiosInstance;
  private auth: StellarRecAuth;
  
  public users: UsersService;
  public universities: UniversitiesService;
  public applications: ApplicationsService;
  public letters: LettersService;

  constructor(config: StellarRecClientConfig = {}) {
    const {
      baseURL = 'https://api.stellarrec.com',
      apiKey,
      timeout = 30000,
      retries = 3,
      retryDelay = 1000
    } = config;

    this.http = axios.create({
      baseURL,
      timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': '{{packageName}}/{{version}}'
      }
    });

    this.auth = new StellarRecAuth(this.http);
    
    if (apiKey) {
      this.setApiKey(apiKey);
    }

    this.setupInterceptors(retries, retryDelay);
    this.initializeServices();
  }

  private setupInterceptors(retries: number, retryDelay: number): void {
    // Request interceptor
    this.http.interceptors.request.use(
      (config) => {
        console.log(\`Making request: \${config.method?.toUpperCase()} \${config.url}\`);
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.http.interceptors.response.use(
      (response) => response,
      async (error) => {
        const { config, response } = error;
        
        if (response?.status === 401) {
          throw new AuthenticationError('Authentication failed');
        }
        
        if (response?.status === 429) {
          const retryAfter = response.headers['retry-after'] || retryDelay / 1000;
          throw new RateLimitError(\`Rate limit exceeded. Retry after \${retryAfter} seconds\`);
        }
        
        // Retry logic
        if (config && !config._retry && retries > 0) {
          config._retry = true;
          config._retryCount = (config._retryCount || 0) + 1;
          
          if (config._retryCount <= retries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            return this.http(config);
          }
        }
        
        throw new StellarRecError(
          response?.data?.message || error.message,
          response?.status,
          response?.data
        );
      }
    );
  }

  private initializeServices(): void {
    this.users = new UsersService(this.http);
    this.universities = new UniversitiesService(this.http);
    this.applications = new ApplicationsService(this.http);
    this.letters = new LettersService(this.http);
  }

  setApiKey(apiKey: string): void {
    this.http.defaults.headers.common['Authorization'] = \`Bearer \${apiKey}\`;
  }

  async authenticate(email: string, password: string): Promise<string> {
    return this.auth.login(email, password);
  }

  async refreshToken(refreshToken: string): Promise<string> {
    return this.auth.refresh(refreshToken);
  }
}`;
  }

  private getJavaScriptServiceTemplate(service: string): string {
    const serviceName = service.charAt(0).toUpperCase() + service.slice(1);
    
    return `import { AxiosInstance } from 'axios';

export class ${serviceName}Service {
  constructor(private http: AxiosInstance) {}

  async list(params?: any) {
    const response = await this.http.get('/${service}', { params });
    return response.data;
  }

  async get(id: string) {
    const response = await this.http.get(\`/${service}/\${id}\`);
    return response.data;
  }

  async create(data: any) {
    const response = await this.http.post('/${service}', data);
    return response.data;
  }

  async update(id: string, data: any) {
    const response = await this.http.put(\`/${service}/\${id}\`, data);
    return response.data;
  }

  async delete(id: string) {
    const response = await this.http.delete(\`/${service}/\${id}\`);
    return response.data;
  }
}`;
  }

  // Template methods for Python
  private getPythonSetupTemplate(): string {
    return `from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="{{packageName}}",
    version="{{version}}",
    author="{{author}}",
    author_email="developers@stellarrec.com",
    description="Official Python SDK for StellarRec API",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="{{repository}}",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 5 - Production/Stable",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
    python_requires=">=3.8",
    install_requires=[
        "requests>=2.25.0",
        "pydantic>=2.0.0",
        "typing-extensions>=4.0.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-asyncio>=0.21.0",
            "black>=22.0.0",
            "flake8>=4.0.0",
            "mypy>=1.0.0",
        ]
    },
)`;
  }

  private getPythonClientTemplate(): string {
    return `import requests
from typing import Optional, Dict, Any
from .auth import StellarRecAuth
from .errors import StellarRecError, RateLimitError, AuthenticationError
from .services.users import UsersService
from .services.universities import UniversitiesService
from .services.applications import ApplicationsService
from .services.letters import LettersService

class StellarRecClient:
    def __init__(
        self,
        base_url: str = "https://api.stellarrec.com",
        api_key: Optional[str] = None,
        timeout: int = 30,
        retries: int = 3,
        retry_delay: int = 1
    ):
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self.retries = retries
        self.retry_delay = retry_delay
        
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': '{{packageName}}/{{version}}'
        })
        
        self.auth = StellarRecAuth(self)
        
        if api_key:
            self.set_api_key(api_key)
        
        # Initialize services
        self.users = UsersService(self)
        self.universities = UniversitiesService(self)
        self.applications = ApplicationsService(self)
        self.letters = LettersService(self)
    
    def set_api_key(self, api_key: str) -> None:
        self.session.headers['Authorization'] = f'Bearer {api_key}'
    
    def request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        data: Optional[Dict[str, Any]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        
        for attempt in range(self.retries + 1):
            try:
                response = self.session.request(
                    method=method,
                    url=url,
                    params=params,
                    json=data,
                    timeout=self.timeout,
                    **kwargs
                )
                
                if response.status_code == 401:
                    raise AuthenticationError("Authentication failed")
                
                if response.status_code == 429:
                    retry_after = response.headers.get('Retry-After', self.retry_delay)
                    raise RateLimitError(f"Rate limit exceeded. Retry after {retry_after} seconds")
                
                response.raise_for_status()
                return response.json()
                
            except requests.exceptions.RequestException as e:
                if attempt == self.retries:
                    raise StellarRecError(f"Request failed after {self.retries} retries: {str(e)}")
                
                import time
                time.sleep(self.retry_delay * (2 ** attempt))  # Exponential backoff
        
        raise StellarRecError("Maximum retries exceeded")
    
    def authenticate(self, email: str, password: str) -> str:
        return self.auth.login(email, password)
    
    def refresh_token(self, refresh_token: str) -> str:
        return self.auth.refresh(refresh_token)`;
  }

  private getPythonServiceTemplate(service: string): string {
    const serviceName = service.charAt(0).toUpperCase() + service.slice(1);
    
    return `from typing import Dict, Any, Optional, List

class ${serviceName}Service:
    def __init__(self, client):
        self.client = client
    
    def list(self, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        return self.client.request('GET', '/${service}', params=params)
    
    def get(self, id: str) -> Dict[str, Any]:
        return self.client.request('GET', f'/${service}/{id}')
    
    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.client.request('POST', '/${service}', data=data)
    
    def update(self, id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.client.request('PUT', f'/${service}/{id}', data=data)
    
    def delete(self, id: str) -> Dict[str, Any]:
        return self.client.request('DELETE', f'/${service}/{id}')`;
  }

  // Additional template methods...
  private getJavaScriptTypesTemplate(): string {
    return `// Common types for StellarRec API
export interface User {
  id: string;
  email: string;
  role: 'student' | 'recommender' | 'admin';
  createdAt: string;
  updatedAt: string;
}

export interface University {
  id: string;
  name: string;
  location: {
    city: string;
    state: string;
    country: string;
  };
  ranking?: number;
  isActive: boolean;
}

export interface Application {
  id: string;
  studentId: string;
  universityId: string;
  status: 'draft' | 'in_progress' | 'submitted' | 'accepted' | 'rejected';
  deadline: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  requestId: string;
  timestamp: string;
}`;
  }

  private getJavaScriptAuthTemplate(): string {
    return `import { AxiosInstance } from 'axios';

export class StellarRecAuth {
  constructor(private http: AxiosInstance) {}

  async login(email: string, password: string): Promise<string> {
    const response = await this.http.post('/auth/login', {
      email,
      password
    });
    
    const { access_token } = response.data;
    this.http.defaults.headers.common['Authorization'] = \`Bearer \${access_token}\`;
    
    return access_token;
  }

  async refresh(refreshToken: string): Promise<string> {
    const response = await this.http.post('/auth/refresh', {
      refresh_token: refreshToken
    });
    
    const { access_token } = response.data;
    this.http.defaults.headers.common['Authorization'] = \`Bearer \${access_token}\`;
    
    return access_token;
  }

  async logout(): Promise<void> {
    await this.http.post('/auth/logout');
    delete this.http.defaults.headers.common['Authorization'];
  }
}`;
  }

  private getJavaScriptErrorsTemplate(): string {
    return `export class StellarRecError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'StellarRecError';
  }
}

export class AuthenticationError extends StellarRecError {
  constructor(message: string) {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends StellarRecError {
  constructor(message: string) {
    super(message, 429);
    this.name = 'RateLimitError';
  }
}

export class ValidationError extends StellarRecError {
  constructor(message: string, public errors: any[]) {
    super(message, 400);
    this.name = 'ValidationError';
  }
}`;
  }

  private getJavaScriptReadmeTemplate(): string {
    return `# {{packageName}}

Official JavaScript/TypeScript SDK for the StellarRec API.

## Installation

\`\`\`bash
npm install {{packageName}}
\`\`\`

## Quick Start

\`\`\`typescript
import { StellarRecClient } from '{{packageName}}';

const client = new StellarRecClient({
  apiKey: 'your-api-key-here'
});

// Get universities
const universities = await client.universities.list();

// Create an application
const application = await client.applications.create({
  universityId: 'univ-123',
  programId: 'prog-456'
});
\`\`\`

## Authentication

\`\`\`typescript
// Using API key
const client = new StellarRecClient({
  apiKey: 'your-api-key'
});

// Using email/password
const client = new StellarRecClient();
const token = await client.authenticate('user@example.com', 'password');
\`\`\`

## Error Handling

\`\`\`typescript
try {
  const user = await client.users.get('user-id');
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Authentication failed');
  } else if (error instanceof RateLimitError) {
    console.error('Rate limit exceeded');
  } else {
    console.error('API error:', error.message);
  }
}
\`\`\`

## Documentation

For complete API documentation, visit [https://docs.stellarrec.com](https://docs.stellarrec.com)

## Support

- Email: developers@stellarrec.com
- GitHub Issues: {{repository}}/issues
- Discord: https://discord.gg/stellarrec

## License

{{license}}`;
  }

  // Additional template initialization methods
  private initializeJavaTemplate(): void {
    this.templates.set('java', {
      language: 'java',
      files: {
        'pom.xml': this.getJavaPomTemplate(),
        'src/main/java/com/stellarrec/StellarRecClient.java': this.getJavaClientTemplate(),
        'README.md': this.getJavaReadmeTemplate()
      },
      dependencies: {
        'okhttp': '4.12.0',
        'gson': '2.10.1',
        'junit': '5.10.0'
      },
      scripts: {
        'compile': 'mvn compile',
        'test': 'mvn test',
        'package': 'mvn package'
      },
      metadata: {
        packageManager: 'maven',
        buildCommand: 'mvn compile',
        testCommand: 'mvn test',
        publishCommand: 'mvn deploy'
      }
    });
  }

  private initializeCSharpTemplate(): void {
    this.templates.set('csharp', {
      language: 'csharp',
      files: {
        'StellarRec.Client.csproj': this.getCSharpProjectTemplate(),
        'StellarRecClient.cs': this.getCSharpClientTemplate(),
        'README.md': this.getCSharpReadmeTemplate()
      },
      dependencies: {
        'Newtonsoft.Json': '13.0.3',
        'Microsoft.Extensions.Http': '8.0.0'
      },
      scripts: {
        'build': 'dotnet build',
        'test': 'dotnet test',
        'pack': 'dotnet pack'
      },
      metadata: {
        packageManager: 'nuget',
        buildCommand: 'dotnet build',
        testCommand: 'dotnet test',
        publishCommand: 'dotnet nuget push'
      }
    });
  }

  private initializePhpTemplate(): void {
    this.templates.set('php', {
      language: 'php',
      files: {
        'composer.json': this.getPhpComposerTemplate(),
        'src/StellarRecClient.php': this.getPhpClientTemplate(),
        'README.md': this.getPhpReadmeTemplate()
      },
      dependencies: {
        'guzzlehttp/guzzle': '^7.0',
        'php': '>=8.0'
      },
      scripts: {
        'test': 'phpunit',
        'lint': 'phpcs src'
      },
      metadata: {
        packageManager: 'composer',
        buildCommand: 'composer install',
        testCommand: 'phpunit',
        publishCommand: 'composer publish'
      }
    });
  }

  private initializeRubyTemplate(): void {
    this.templates.set('ruby', {
      language: 'ruby',
      files: {
        'stellarrec.gemspec': this.getRubyGemspecTemplate(),
        'lib/stellarrec.rb': this.getRubyClientTemplate(),
        'README.md': this.getRubyReadmeTemplate()
      },
      dependencies: {
        'faraday': '~> 2.0',
        'json': '~> 2.0'
      },
      scripts: {
        'test': 'rspec',
        'lint': 'rubocop'
      },
      metadata: {
        packageManager: 'gem',
        buildCommand: 'gem build',
        testCommand: 'rspec',
        publishCommand: 'gem push'
      }
    });
  }

  // Placeholder methods for additional templates
  private getTypeScriptConfigTemplate(): string { return '{}'; }
  private getGitIgnoreTemplate(): string { return 'node_modules/\ndist/\n.env'; }
  private getJestConfigTemplate(): string { return 'module.exports = {};'; }
  private getPythonInitTemplate(): string { return '__version__ = "{{version}}"'; }
  private getPythonAuthTemplate(): string { return '# Auth implementation'; }
  private getPythonErrorsTemplate(): string { return '# Error classes'; }
  private getPythonTypesTemplate(): string { return '# Type definitions'; }
  private getPythonReadmeTemplate(): string { return '# {{packageName}}'; }
  private getPythonRequirementsTemplate(): string { return 'requests>=2.25.0'; }
  private getPythonProjectTemplate(): string { return '[build-system]'; }
  private getPythonGitIgnoreTemplate(): string { return '__pycache__/\n*.pyc'; }
  private getJavaPomTemplate(): string { return '<project></project>'; }
  private getJavaClientTemplate(): string { return '// Java client'; }
  private getJavaReadmeTemplate(): string { return '# Java SDK'; }
  private getCSharpProjectTemplate(): string { return '<Project></Project>'; }
  private getCSharpClientTemplate(): string { return '// C# client'; }
  private getCSharpReadmeTemplate(): string { return '# C# SDK'; }
  private getPhpComposerTemplate(): string { return '{}'; }
  private getPhpClientTemplate(): string { return '<?php'; }
  private getPhpReadmeTemplate(): string { return '# PHP SDK'; }
  private getRubyGemspecTemplate(): string { return 'Gem::Specification.new'; }
  private getRubyClientTemplate(): string { return '# Ruby client'; }
  private getRubyReadmeTemplate(): string { return '# Ruby SDK'; }
}