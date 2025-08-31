import express from 'express';
import cors from 'cors';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import * as fs from 'fs/promises';
import { ApiDocumentationConfig } from '../types';

interface DocumentationServerConfig {
  port: number;
  docsPath: string;
  enableLiveReload?: boolean;
  enableAuth?: boolean;
  customRoutes?: Array<{
    path: string;
    handler: express.RequestHandler;
  }>;
}

export class DocumentationServer {
  private app: express.Application;
  private config: DocumentationServerConfig;
  private server?: any;

  constructor(config: DocumentationServerConfig) {
    this.config = config;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // CORS
    this.app.use(cors({
      origin: true,
      credentials: true
    }));

    // JSON parsing
    this.app.use(express.json());

    // Static files
    this.app.use('/static', express.static(path.join(this.config.docsPath, 'static')));

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });

    // Security headers
    this.app.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0'
      });
    });

    // API documentation home
    this.app.get('/', async (req, res) => {
      try {
        const indexPath = path.join(this.config.docsPath, 'index.html');
        const indexContent = await this.loadTemplate(indexPath);
        res.send(indexContent);
      } catch (error) {
        res.status(500).send('Documentation not available');
      }
    });

    // Swagger UI
    this.app.use('/swagger-ui', express.static(path.join(this.config.docsPath, 'swagger-ui')));

    // OpenAPI specs
    this.app.get('/specs/:filename', async (req, res) => {
      try {
        const filename = req.params.filename;
        const specPath = path.join(this.config.docsPath, 'specs', filename);
        const spec = await fs.readFile(specPath, 'utf8');
        
        if (filename.endsWith('.yaml') || filename.endsWith('.yml')) {
          res.setHeader('Content-Type', 'application/x-yaml');
        } else {
          res.setHeader('Content-Type', 'application/json');
        }
        
        res.send(spec);
      } catch (error) {
        res.status(404).json({ error: 'Specification not found' });
      }
    });

    // Developer guides
    this.app.get('/guides/:guide', async (req, res) => {
      try {
        const guide = req.params.guide;
        const guidePath = path.join(this.config.docsPath, 'guides', `${guide}.md`);
        const content = await fs.readFile(guidePath, 'utf8');
        
        const html = await this.renderMarkdown(content, `${guide} Guide`);
        res.send(html);
      } catch (error) {
        res.status(404).send('Guide not found');
      }
    });

    // Service-specific guides
    this.app.get('/guides/services/:service', async (req, res) => {
      try {
        const service = req.params.service;
        const guidePath = path.join(this.config.docsPath, 'guides', 'services', `${service}.md`);
        const content = await fs.readFile(guidePath, 'utf8');
        
        const html = await this.renderMarkdown(content, `${service} Service Guide`);
        res.send(html);
      } catch (error) {
        res.status(404).send('Service guide not found');
      }
    });

    // Code examples
    this.app.get('/examples/:language/:service', async (req, res) => {
      try {
        const { language, service } = req.params;
        const extension = this.getFileExtension(language);
        const examplePath = path.join(this.config.docsPath, 'examples', language, `${service}.${extension}`);
        const content = await fs.readFile(examplePath, 'utf8');
        
        const html = await this.renderCodeExample(content, language, `${service} Examples`);
        res.send(html);
      } catch (error) {
        res.status(404).send('Code example not found');
      }
    });

    // SDK documentation
    this.app.get('/sdks/:language', async (req, res) => {
      try {
        const language = req.params.language;
        const sdkPath = path.join(this.config.docsPath, 'sdks', `${language}.md`);
        const content = await fs.readFile(sdkPath, 'utf8');
        
        const html = await this.renderMarkdown(content, `${language} SDK`);
        res.send(html);
      } catch (error) {
        res.status(404).send('SDK documentation not found');
      }
    });

    // Versioning documentation
    this.app.get('/versioning/:doc', async (req, res) => {
      try {
        const doc = req.params.doc;
        const docPath = path.join(this.config.docsPath, 'versioning', `${doc}.md`);
        const content = await fs.readFile(docPath, 'utf8');
        
        const html = await this.renderMarkdown(content, `API ${doc}`);
        res.send(html);
      } catch (error) {
        res.status(404).send('Versioning documentation not found');
      }
    });

    // Postman collection
    this.app.get('/postman/collection', async (req, res) => {
      try {
        const collectionPath = path.join(this.config.docsPath, 'postman', 'StellarRec-API.postman_collection.json');
        const collection = await fs.readFile(collectionPath, 'utf8');
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="StellarRec-API.postman_collection.json"');
        res.send(collection);
      } catch (error) {
        res.status(404).json({ error: 'Postman collection not found' });
      }
    });

    // Search endpoint
    this.app.get('/search', async (req, res) => {
      try {
        const query = req.query.q as string;
        if (!query) {
          return res.json({ results: [] });
        }

        const results = await this.searchDocumentation(query);
        res.json({ results });
      } catch (error) {
        res.status(500).json({ error: 'Search failed' });
      }
    });

    // API explorer
    this.app.get('/explorer', async (req, res) => {
      const html = await this.renderApiExplorer();
      res.send(html);
    });

    // Custom routes
    if (this.config.customRoutes) {
      for (const route of this.config.customRoutes) {
        this.app.use(route.path, route.handler);
      }
    }

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).send(`
        <html>
          <head><title>404 - Not Found</title></head>
          <body>
            <h1>404 - Page Not Found</h1>
            <p>The requested documentation page was not found.</p>
            <a href="/">← Back to Documentation Home</a>
          </body>
        </html>
      `);
    });

    // Error handler
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Documentation server error:', err);
      res.status(500).send(`
        <html>
          <head><title>500 - Server Error</title></head>
          <body>
            <h1>500 - Internal Server Error</h1>
            <p>An error occurred while serving the documentation.</p>
            <a href="/">← Back to Documentation Home</a>
          </body>
        </html>
      `);
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.config.port, (err?: Error) => {
        if (err) {
          reject(err);
        } else {
          console.log(`📚 Documentation server running on port ${this.config.port}`);
          console.log(`🌐 Documentation available at: http://localhost:${this.config.port}`);
          console.log(`📖 API Explorer: http://localhost:${this.config.port}/explorer`);
          console.log(`🔍 Search: http://localhost:${this.config.port}/search?q=your-query`);
          resolve();
        }
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('📚 Documentation server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private async loadTemplate(templatePath: string): Promise<string> {
    try {
      return await fs.readFile(templatePath, 'utf8');
    } catch (error) {
      return this.getDefaultTemplate();
    }
  }

  private getDefaultTemplate(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>StellarRec API Documentation</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #1976d2; margin-bottom: 30px; }
    .nav { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-top: 30px; }
    .nav-item { padding: 20px; background: #f8f9fa; border-radius: 6px; text-decoration: none; color: #333; border: 1px solid #e9ecef; }
    .nav-item:hover { background: #e9ecef; }
    .nav-item h3 { margin: 0 0 10px 0; color: #1976d2; }
    .nav-item p { margin: 0; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🌟 StellarRec API Documentation</h1>
    <p>Welcome to the comprehensive API documentation for the StellarRec platform.</p>
    
    <div class="nav">
      <a href="/swagger-ui" class="nav-item">
        <h3>🎨 Interactive API Explorer</h3>
        <p>Explore and test API endpoints with Swagger UI</p>
      </a>
      
      <a href="/guides/quick-start" class="nav-item">
        <h3>🚀 Quick Start Guide</h3>
        <p>Get started with the StellarRec API in minutes</p>
      </a>
      
      <a href="/guides/authentication" class="nav-item">
        <h3>🔐 Authentication</h3>
        <p>Learn how to authenticate with the API</p>
      </a>
      
      <a href="/examples/javascript/user-service" class="nav-item">
        <h3>💻 Code Examples</h3>
        <p>Ready-to-use code examples in multiple languages</p>
      </a>
      
      <a href="/sdks/javascript" class="nav-item">
        <h3>🛠️ SDKs</h3>
        <p>Official SDKs for popular programming languages</p>
      </a>
      
      <a href="/versioning/versions" class="nav-item">
        <h3>🔄 API Versioning</h3>
        <p>Version information and migration guides</p>
      </a>
      
      <a href="/postman/collection" class="nav-item">
        <h3>📮 Postman Collection</h3>
        <p>Download our Postman collection for easy testing</p>
      </a>
      
      <a href="/health" class="nav-item">
        <h3>🏥 Health Check</h3>
        <p>Check the status of the documentation server</p>
      </a>
    </div>
  </div>
</body>
</html>`;
  }

  private async renderMarkdown(content: string, title: string): Promise<string> {
    // Simple markdown to HTML conversion (in production, use a proper markdown parser)
    const html = content
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\`(.+?)\`/g, '<code>$1</code>')
      .replace(/```([\\s\\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/\\n/g, '<br>');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - StellarRec API</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; line-height: 1.6; }
    .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1, h2, h3 { color: #1976d2; }
    code { background: #f8f9fa; padding: 2px 6px; border-radius: 3px; font-family: 'Monaco', 'Consolas', monospace; }
    pre { background: #f8f9fa; padding: 15px; border-radius: 6px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    .back-link { display: inline-block; margin-bottom: 20px; color: #1976d2; text-decoration: none; }
    .back-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <a href="/" class="back-link">← Back to Documentation Home</a>
    ${html}
  </div>
</body>
</html>`;
  }

  private async renderCodeExample(content: string, language: string, title: string): Promise<string> {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - StellarRec API</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1000px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .back-link { display: inline-block; margin-bottom: 20px; color: #1976d2; text-decoration: none; }
    .back-link:hover { text-decoration: underline; }
    h1 { color: #1976d2; }
    .copy-btn { float: right; background: #1976d2; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; }
    .copy-btn:hover { background: #1565c0; }
  </style>
</head>
<body>
  <div class="container">
    <a href="/" class="back-link">← Back to Documentation Home</a>
    <h1>${title}</h1>
    <div style="position: relative;">
      <button class="copy-btn" onclick="copyCode()">Copy</button>
      <pre><code class="language-${language}" id="code-content">${content}</code></pre>
    </div>
  </div>
  
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-core.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/autoloader/prism-autoloader.min.js"></script>
  <script>
    function copyCode() {
      const code = document.getElementById('code-content').textContent;
      navigator.clipboard.writeText(code).then(() => {
        const btn = document.querySelector('.copy-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = originalText, 2000);
      });
    }
  </script>
</body>
</html>`;
  }

  private async renderApiExplorer(): Promise<string> {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Explorer - StellarRec API</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .back-link { display: inline-block; margin-bottom: 20px; color: #1976d2; text-decoration: none; }
    .back-link:hover { text-decoration: underline; }
    h1 { color: #1976d2; }
    .explorer-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 30px; }
    .service-card { padding: 20px; background: #f8f9fa; border-radius: 6px; border: 1px solid #e9ecef; }
    .service-card h3 { margin: 0 0 15px 0; color: #1976d2; }
    .endpoint { margin: 10px 0; padding: 10px; background: white; border-radius: 4px; border-left: 4px solid #1976d2; }
    .method { font-weight: bold; color: #1976d2; }
  </style>
</head>
<body>
  <div class="container">
    <a href="/" class="back-link">← Back to Documentation Home</a>
    <h1>🔍 API Explorer</h1>
    <p>Explore all available API endpoints organized by service.</p>
    
    <div class="explorer-grid">
      <div class="service-card">
        <h3>👤 User Service</h3>
        <div class="endpoint">
          <div class="method">GET</div>
          <div>/users - List all users</div>
        </div>
        <div class="endpoint">
          <div class="method">POST</div>
          <div>/users - Create new user</div>
        </div>
        <div class="endpoint">
          <div class="method">GET</div>
          <div>/users/{id} - Get user by ID</div>
        </div>
      </div>
      
      <div class="service-card">
        <h3>🏫 University Service</h3>
        <div class="endpoint">
          <div class="method">GET</div>
          <div>/universities - List universities</div>
        </div>
        <div class="endpoint">
          <div class="method">GET</div>
          <div>/universities/{id} - Get university details</div>
        </div>
        <div class="endpoint">
          <div class="method">GET</div>
          <div>/universities/{id}/programs - Get programs</div>
        </div>
      </div>
      
      <div class="service-card">
        <h3>📝 Application Service</h3>
        <div class="endpoint">
          <div class="method">GET</div>
          <div>/applications - List applications</div>
        </div>
        <div class="endpoint">
          <div class="method">POST</div>
          <div>/applications - Create application</div>
        </div>
        <div class="endpoint">
          <div class="method">PUT</div>
          <div>/applications/{id} - Update application</div>
        </div>
      </div>
    </div>
    
    <div style="margin-top: 40px; text-align: center;">
      <a href="/swagger-ui" style="display: inline-block; background: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
        🎨 Try Interactive API Explorer
      </a>
    </div>
  </div>
</body>
</html>`;
  }

  private async searchDocumentation(query: string): Promise<any[]> {
    // Simple search implementation (in production, use a proper search engine)
    const results: any[] = [];
    
    // Search in guides
    try {
      const guidesPath = path.join(this.config.docsPath, 'guides');
      const guides = await fs.readdir(guidesPath);
      
      for (const guide of guides) {
        if (guide.endsWith('.md')) {
          const content = await fs.readFile(path.join(guidesPath, guide), 'utf8');
          if (content.toLowerCase().includes(query.toLowerCase())) {
            results.push({
              type: 'guide',
              title: guide.replace('.md', ''),
              url: `/guides/${guide.replace('.md', '')}`,
              excerpt: content.substring(0, 200) + '...'
            });
          }
        }
      }
    } catch (error) {
      // Ignore errors
    }
    
    return results.slice(0, 10); // Limit results
  }

  private getFileExtension(language: string): string {
    const extensions: Record<string, string> = {
      javascript: 'js',
      typescript: 'ts',
      python: 'py',
      java: 'java',
      csharp: 'cs',
      php: 'php',
      ruby: 'rb',
      go: 'go'
    };
    return extensions[language] || 'txt';
  }
}