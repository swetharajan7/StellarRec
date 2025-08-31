import { ApiDocumentationConfig } from '../types';

export class SwaggerUIGenerator {
  private config: ApiDocumentationConfig;

  constructor(config: ApiDocumentationConfig) {
    this.config = config;
  }

  async generate(): Promise<Record<string, string>> {
    const files: Record<string, string> = {};

    // Generate main HTML file
    files['index.html'] = this.generateIndexHtml();
    
    // Generate configuration file
    files['swagger-config.js'] = this.generateSwaggerConfig();
    
    // Generate custom CSS
    files['custom.css'] = this.generateCustomCss();
    
    // Generate initialization script
    files['swagger-initializer.js'] = this.generateInitializer();

    return files;
  }

  private generateIndexHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${this.config.title} - API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.0.0/swagger-ui.css" />
  <link rel="stylesheet" type="text/css" href="./custom.css" />
  <link rel="icon" type="image/png" href="${this.config.theme?.favicon || './favicon-32x32.png'}" sizes="32x32" />
  <link rel="icon" type="image/png" href="${this.config.theme?.favicon || './favicon-16x16.png'}" sizes="16x16" />
</head>

<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.0.0/swagger-ui-bundle.js" charset="UTF-8"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.0.0/swagger-ui-standalone-preset.js" charset="UTF-8"></script>
  <script src="./swagger-config.js"></script>
  <script src="./swagger-initializer.js"></script>
</body>
</html>`;
  }

  private generateSwaggerConfig(): string {
    return `window.swaggerConfig = {
  url: '../specs/stellarrec-api.yaml',
  dom_id: '#swagger-ui',
  deepLinking: true,
  presets: [
    SwaggerUIBundle.presets.apis,
    SwaggerUIStandalonePreset
  ],
  plugins: [
    SwaggerUIBundle.plugins.DownloadUrl
  ],
  layout: "StandaloneLayout",
  validatorUrl: null,
  tryItOutEnabled: true,
  supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
  onComplete: function() {
    console.log('Swagger UI loaded successfully');
  },
  onFailure: function(data) {
    console.error('Failed to load Swagger UI:', data);
  },
  docExpansion: "list",
  jsonEditor: false,
  defaultModelRendering: 'schema',
  showRequestHeaders: true,
  showCommonExtensions: true,
  requestInterceptor: function(request) {
    // Add API key if available
    const apiKey = localStorage.getItem('stellarrec_api_key');
    if (apiKey) {
      request.headers['Authorization'] = 'Bearer ' + apiKey;
    }
    return request;
  },
  responseInterceptor: function(response) {
    // Log response for debugging
    console.log('API Response:', response);
    return response;
  }
};`;
  }

  private generateCustomCss(): string {
    const theme = this.config.theme;
    const primaryColor = theme?.primaryColor || '#1976d2';
    const secondaryColor = theme?.secondaryColor || '#7c4dff';

    return `/* StellarRec API Documentation Custom Styles */

:root {
  --primary-color: ${primaryColor};
  --secondary-color: ${secondaryColor};
  --background-color: #fafafa;
  --text-color: #333;
  --border-color: #e0e0e0;
}

/* Header customization */
.swagger-ui .topbar {
  background-color: var(--primary-color);
  border-bottom: 3px solid var(--secondary-color);
}

.swagger-ui .topbar .download-url-wrapper {
  display: none;
}

.swagger-ui .topbar .link {
  content: "${this.config.title}";
  font-size: 1.5em;
  font-weight: bold;
  color: white;
}

/* Logo */
${theme?.logo ? `
.swagger-ui .topbar::before {
  content: "";
  background-image: url("${theme.logo}");
  background-size: contain;
  background-repeat: no-repeat;
  width: 40px;
  height: 40px;
  display: inline-block;
  margin-right: 10px;
  vertical-align: middle;
}
` : ''}

/* Operation styling */
.swagger-ui .opblock.opblock-get {
  border-color: #61affe;
  background: rgba(97, 175, 254, 0.1);
}

.swagger-ui .opblock.opblock-post {
  border-color: #49cc90;
  background: rgba(73, 204, 144, 0.1);
}

.swagger-ui .opblock.opblock-put {
  border-color: #fca130;
  background: rgba(252, 161, 48, 0.1);
}

.swagger-ui .opblock.opblock-delete {
  border-color: #f93e3e;
  background: rgba(249, 62, 62, 0.1);
}

.swagger-ui .opblock.opblock-patch {
  border-color: #50e3c2;
  background: rgba(80, 227, 194, 0.1);
}

/* Button styling */
.swagger-ui .btn.authorize {
  background-color: var(--primary-color);
  border-color: var(--primary-color);
}

.swagger-ui .btn.authorize:hover {
  background-color: var(--secondary-color);
  border-color: var(--secondary-color);
}

.swagger-ui .btn.execute {
  background-color: var(--secondary-color);
  border-color: var(--secondary-color);
}

/* Schema styling */
.swagger-ui .model-box {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  padding: 10px;
}

.swagger-ui .model .property {
  padding: 5px 0;
}

/* Response styling */
.swagger-ui .responses-inner h4 {
  color: var(--primary-color);
  font-weight: bold;
}

.swagger-ui .response-col_status {
  font-weight: bold;
}

/* Try it out section */
.swagger-ui .try-out__btn {
  background-color: transparent;
  border: 1px solid var(--primary-color);
  color: var(--primary-color);
}

.swagger-ui .try-out__btn:hover {
  background-color: var(--primary-color);
  color: white;
}

/* Parameter table */
.swagger-ui .parameters-col_description {
  color: var(--text-color);
}

.swagger-ui .parameter__name {
  font-weight: bold;
  color: var(--primary-color);
}

/* Code samples */
.swagger-ui .highlight-code {
  background-color: #f8f8f8;
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

/* Authentication modal */
.swagger-ui .auth-container {
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

.swagger-ui .auth-container h4 {
  color: var(--primary-color);
}

/* Info section */
.swagger-ui .info {
  margin: 20px 0;
}

.swagger-ui .info .title {
  color: var(--primary-color);
  font-size: 2em;
  margin-bottom: 10px;
}

.swagger-ui .info .description {
  color: var(--text-color);
  line-height: 1.6;
}

/* Server selection */
.swagger-ui .scheme-container {
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 10px;
  margin: 20px 0;
}

/* Custom additions */
.api-key-input {
  margin: 20px 0;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 4px;
  border: 1px solid var(--border-color);
}

.api-key-input label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  color: var(--primary-color);
}

.api-key-input input {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-family: monospace;
}

.api-key-input button {
  margin-top: 10px;
  padding: 8px 16px;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.api-key-input button:hover {
  background-color: var(--secondary-color);
}

/* Responsive design */
@media (max-width: 768px) {
  .swagger-ui .info .title {
    font-size: 1.5em;
  }
  
  .swagger-ui .opblock-summary {
    flex-wrap: wrap;
  }
  
  .swagger-ui .opblock-summary-path {
    word-break: break-all;
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  :root {
    --background-color: #1a1a1a;
    --text-color: #e0e0e0;
    --border-color: #333;
  }
  
  .swagger-ui {
    background-color: var(--background-color);
    color: var(--text-color);
  }
  
  .swagger-ui .scheme-container {
    background: #2a2a2a;
  }
}

${theme?.customCss || ''}`;
  }

  private generateInitializer(): string {
    return `// Swagger UI Initializer
window.onload = function() {
  // Add API key input
  const topbar = document.querySelector('.swagger-ui .topbar');
  if (topbar) {
    const apiKeyContainer = document.createElement('div');
    apiKeyContainer.className = 'api-key-input';
    apiKeyContainer.innerHTML = \`
      <label for="api-key">API Key (Optional):</label>
      <input type="password" id="api-key" placeholder="Enter your API key here..." />
      <button onclick="setApiKey()">Set API Key</button>
      <button onclick="clearApiKey()">Clear</button>
    \`;
    
    topbar.parentNode.insertBefore(apiKeyContainer, topbar.nextSibling);
    
    // Load saved API key
    const savedKey = localStorage.getItem('stellarrec_api_key');
    if (savedKey) {
      document.getElementById('api-key').value = savedKey;
    }
  }

  // Initialize Swagger UI
  const ui = SwaggerUIBundle(window.swaggerConfig);
  window.ui = ui;
};

// API Key management functions
function setApiKey() {
  const apiKey = document.getElementById('api-key').value;
  if (apiKey) {
    localStorage.setItem('stellarrec_api_key', apiKey);
    alert('API key saved! It will be included in all requests.');
  } else {
    alert('Please enter an API key.');
  }
}

function clearApiKey() {
  localStorage.removeItem('stellarrec_api_key');
  document.getElementById('api-key').value = '';
  alert('API key cleared.');
}

// Add custom request interceptor for better error handling
function customRequestInterceptor(request) {
  // Add timestamp to requests
  request.headers['X-Request-Time'] = new Date().toISOString();
  
  // Add API key if available
  const apiKey = localStorage.getItem('stellarrec_api_key');
  if (apiKey) {
    request.headers['Authorization'] = 'Bearer ' + apiKey;
  }
  
  console.log('Making request:', request);
  return request;
}

function customResponseInterceptor(response) {
  // Handle common error responses
  if (response.status === 401) {
    alert('Authentication failed. Please check your API key.');
  } else if (response.status === 429) {
    alert('Rate limit exceeded. Please wait before making more requests.');
  } else if (response.status >= 500) {
    alert('Server error occurred. Please try again later.');
  }
  
  console.log('Received response:', response);
  return response;
}

// Add keyboard shortcuts
document.addEventListener('keydown', function(event) {
  // Ctrl/Cmd + K to focus API key input
  if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
    event.preventDefault();
    document.getElementById('api-key').focus();
  }
  
  // Escape to clear focus
  if (event.key === 'Escape') {
    document.activeElement.blur();
  }
});

// Add copy functionality for code examples
document.addEventListener('click', function(event) {
  if (event.target.classList.contains('copy-button')) {
    const codeBlock = event.target.nextElementSibling;
    if (codeBlock) {
      navigator.clipboard.writeText(codeBlock.textContent).then(function() {
        event.target.textContent = 'Copied!';
        setTimeout(function() {
          event.target.textContent = 'Copy';
        }, 2000);
      });
    }
  }
});

// Add version selector if multiple versions are available
function addVersionSelector() {
  const versions = ['v1.0', 'v1.1', 'v2.0']; // This would be dynamic
  
  if (versions.length > 1) {
    const topbar = document.querySelector('.swagger-ui .topbar');
    const versionSelector = document.createElement('select');
    versionSelector.className = 'version-selector';
    
    versions.forEach(version => {
      const option = document.createElement('option');
      option.value = version;
      option.textContent = version;
      versionSelector.appendChild(option);
    });
    
    versionSelector.addEventListener('change', function() {
      const newUrl = window.location.href.replace(/v\\d+\\.\\d+/, this.value);
      window.location.href = newUrl;
    });
    
    topbar.appendChild(versionSelector);
  }
}

// Initialize additional features
setTimeout(function() {
  addVersionSelector();
}, 1000);`;
  }
}