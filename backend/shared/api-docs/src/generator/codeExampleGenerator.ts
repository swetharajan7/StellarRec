import { ApiDocumentationConfig, ServiceDefinition, CodeExample } from '../types';

export class CodeExampleGenerator {
  private config: ApiDocumentationConfig;

  constructor(config: ApiDocumentationConfig) {
    this.config = config;
  }

  async generateExamples(service: ServiceDefinition): Promise<Record<string, string>> {
    const examples: Record<string, string> = {};

    for (const language of this.config.languages) {
      examples[language] = this.generateLanguageExamples(service, language);
    }

    return examples;
  }

  private generateLanguageExamples(service: ServiceDefinition, language: string): string {
    switch (language) {
      case 'javascript':
        return this.generateJavaScriptExamples(service);
      case 'python':
        return this.generatePythonExamples(service);
      case 'java':
        return this.generateJavaExamples(service);
      case 'csharp':
        return this.generateCSharpExamples(service);
      case 'php':
        return this.generatePhpExamples(service);
      case 'ruby':
        return this.generateRubyExamples(service);
      case 'curl':
        return this.generateCurlExamples(service);
      default:
        return this.generateGenericExamples(service, language);
    }
  }

  private generateJavaScriptExamples(service: ServiceDefinition): string {
    return `// ${service.name} Service - JavaScript Examples

// Installation
// npm install @stellarrec/client-js

import { StellarRecAPI } from '@stellarrec/client-js';

// Initialize the client
const api = new StellarRecAPI({
  baseURL: '${service.baseUrl}',
  apiKey: 'your-api-key-here'
});

// Authentication
async function authenticate() {
  try {
    const auth = await api.auth.login({
      email: 'user@example.com',
      password: 'your-password'
    });
    
    console.log('Authentication successful:', auth);
    return auth.access_token;
  } catch (error) {
    console.error('Authentication failed:', error);
    throw error;
  }
}

${service.endpoints.map(endpoint => this.generateJavaScriptEndpointExample(endpoint)).join('\n\n')}

// Error handling example
async function handleApiCall() {
  try {
    const result = await api.someEndpoint();
    return result;
  } catch (error) {
    if (error.response) {
      // API error response
      console.error('API Error:', error.response.data);
      
      switch (error.response.status) {
        case 400:
          console.error('Bad Request - Check your parameters');
          break;
        case 401:
          console.error('Unauthorized - Check your API key');
          break;
        case 429:
          console.error('Rate limited - Wait before retrying');
          break;
        case 500:
          console.error('Server error - Try again later');
          break;
        default:
          console.error('Unexpected error:', error.response.status);
      }
    } else {
      // Network or other error
      console.error('Network error:', error.message);
    }
    throw error;
  }
}

// Pagination example
async function getAllItems() {
  let page = 1;
  const allItems = [];
  
  while (true) {
    const response = await api.items.list({ page, limit: 100 });
    allItems.push(...response.data);
    
    if (page >= response.pagination.pages) {
      break;
    }
    page++;
  }
  
  return allItems;
}

// Rate limiting with retry
async function apiCallWithRetry(apiCall, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      if (error.response?.status === 429 && attempt < maxRetries) {
        const retryAfter = error.response.headers['retry-after'] || 60;
        console.log(\`Rate limited. Retrying in \${retryAfter} seconds...\`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      throw error;
    }
  }
}

export { api, authenticate, handleApiCall, getAllItems, apiCallWithRetry };`;
  }

  private generateJavaScriptEndpointExample(endpoint: any): string {
    const method = endpoint.method?.toLowerCase() || 'get';
    const operationId = endpoint.operationId;
    const summary = endpoint.summary;

    let example = `// ${summary}\n`;
    example += `async function ${operationId}Example() {\n`;
    example += `  try {\n`;

    if (method === 'get') {
      example += `    const result = await api.${operationId}({\n`;
      example += `      // Add query parameters here\n`;
      example += `      page: 1,\n`;
      example += `      limit: 20\n`;
      example += `    });\n`;
    } else if (method === 'post' || method === 'put') {
      example += `    const result = await api.${operationId}({\n`;
      example += `      // Add request body here\n`;
      example += `      name: 'Example Name',\n`;
      example += `      description: 'Example Description'\n`;
      example += `    });\n`;
    } else if (method === 'delete') {
      example += `    const result = await api.${operationId}('resource-id');\n`;
    }

    example += `    console.log('Success:', result);\n`;
    example += `    return result;\n`;
    example += `  } catch (error) {\n`;
    example += `    console.error('Error:', error);\n`;
    example += `    throw error;\n`;
    example += `  }\n`;
    example += `}`;

    return example;
  }

  private generatePythonExamples(service: ServiceDefinition): string {
    return `# ${service.name} Service - Python Examples

# Installation
# pip install stellarrec-python

from stellarrec import StellarRecAPI
import asyncio
import time

# Initialize the client
api = StellarRecAPI(
    base_url='${service.baseUrl}',
    api_key='your-api-key-here'
)

# Authentication
async def authenticate():
    try:
        auth = await api.auth.login(
            email='user@example.com',
            password='your-password'
        )
        print('Authentication successful:', auth)
        return auth['access_token']
    except Exception as error:
        print('Authentication failed:', error)
        raise

${service.endpoints.map(endpoint => this.generatePythonEndpointExample(endpoint)).join('\n\n')}

# Error handling example
async def handle_api_call():
    try:
        result = await api.some_endpoint()
        return result
    except api.APIError as error:
        print(f'API Error: {error.message}')
        
        if error.status_code == 400:
            print('Bad Request - Check your parameters')
        elif error.status_code == 401:
            print('Unauthorized - Check your API key')
        elif error.status_code == 429:
            print('Rate limited - Wait before retrying')
        elif error.status_code == 500:
            print('Server error - Try again later')
        else:
            print(f'Unexpected error: {error.status_code}')
        
        raise
    except Exception as error:
        print(f'Network error: {error}')
        raise

# Pagination example
async def get_all_items():
    page = 1
    all_items = []
    
    while True:
        response = await api.items.list(page=page, limit=100)
        all_items.extend(response['data'])
        
        if page >= response['pagination']['pages']:
            break
        page += 1
    
    return all_items

# Rate limiting with retry
async def api_call_with_retry(api_call, max_retries=3):
    for attempt in range(1, max_retries + 1):
        try:
            return await api_call()
        except api.RateLimitError as error:
            if attempt < max_retries:
                retry_after = error.retry_after or 60
                print(f'Rate limited. Retrying in {retry_after} seconds...')
                await asyncio.sleep(retry_after)
                continue
            raise

# Synchronous wrapper
def sync_api_call(async_func, *args, **kwargs):
    return asyncio.run(async_func(*args, **kwargs))

if __name__ == '__main__':
    # Example usage
    token = sync_api_call(authenticate)
    print(f'Access token: {token}')`;
  }

  private generatePythonEndpointExample(endpoint: any): string {
    const method = endpoint.method?.toLowerCase() || 'get';
    const operationId = endpoint.operationId;
    const summary = endpoint.summary;

    let example = `# ${summary}\n`;
    example += `async def ${operationId}_example():\n`;
    example += `    try:\n`;

    if (method === 'get') {
      example += `        result = await api.${operationId}(\n`;
      example += `            # Add query parameters here\n`;
      example += `            page=1,\n`;
      example += `            limit=20\n`;
      example += `        )\n`;
    } else if (method === 'post' || method === 'put') {
      example += `        result = await api.${operationId}(\n`;
      example += `            # Add request body here\n`;
      example += `            name='Example Name',\n`;
      example += `            description='Example Description'\n`;
      example += `        )\n`;
    } else if (method === 'delete') {
      example += `        result = await api.${operationId}('resource-id')\n`;
    }

    example += `        print('Success:', result)\n`;
    example += `        return result\n`;
    example += `    except Exception as error:\n`;
    example += `        print('Error:', error)\n`;
    example += `        raise`;

    return example;
  }

  private generateCurlExamples(service: ServiceDefinition): string {
    return `# ${service.name} Service - cURL Examples

# Set your API key
export API_KEY="your-api-key-here"
export BASE_URL="${service.baseUrl}"

# Authentication
curl -X POST "$BASE_URL/auth/login" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.com",
    "password": "your-password"
  }'

${service.endpoints.map(endpoint => this.generateCurlEndpointExample(endpoint, service.baseUrl)).join('\n\n')}

# Error handling example
# Check response status and handle errors appropriately
curl -X GET "$BASE_URL/some-endpoint" \\
  -H "Authorization: Bearer $API_KEY" \\
  -w "HTTP Status: %{http_code}\\n" \\
  -s -o response.json

# Rate limiting example
# Include retry logic for 429 responses
curl -X GET "$BASE_URL/some-endpoint" \\
  -H "Authorization: Bearer $API_KEY" \\
  --retry 3 \\
  --retry-delay 60 \\
  --retry-connrefused

# Pagination example
# Loop through pages
for page in {1..10}; do
  curl -X GET "$BASE_URL/items?page=$page&limit=100" \\
    -H "Authorization: Bearer $API_KEY" \\
    -s | jq '.data[]'
done`;
  }

  private generateCurlEndpointExample(endpoint: any, baseUrl: string): string {
    const method = endpoint.method?.toUpperCase() || 'GET';
    const path = endpoint.path;
    const summary = endpoint.summary;

    let example = `# ${summary}\n`;
    example += `curl -X ${method} "$BASE_URL${path}"`;

    if (method !== 'GET') {
      example += ` \\\n  -H "Content-Type: application/json"`;
    }

    example += ` \\\n  -H "Authorization: Bearer $API_KEY"`;

    if (method === 'POST' || method === 'PUT') {
      example += ` \\\n  -d '{\n    "key": "value",\n    "example": "data"\n  }'`;
    }

    return example;
  }

  private generateJavaExamples(service: ServiceDefinition): string {
    return `// ${service.name} Service - Java Examples

// Add to pom.xml:
// <dependency>
//   <groupId>com.stellarrec</groupId>
//   <artifactId>stellarrec-java</artifactId>
//   <version>1.0.0</version>
// </dependency>

import com.stellarrec.StellarRecAPI;
import com.stellarrec.models.*;
import java.util.concurrent.CompletableFuture;

public class StellarRecExample {
    private static final StellarRecAPI api = new StellarRecAPI.Builder()
        .baseUrl("${service.baseUrl}")
        .apiKey("your-api-key-here")
        .build();

    // Authentication
    public static CompletableFuture<AuthResponse> authenticate() {
        return api.auth().login(LoginRequest.builder()
            .email("user@example.com")
            .password("your-password")
            .build())
        .thenApply(response -> {
            System.out.println("Authentication successful: " + response);
            return response;
        })
        .exceptionally(throwable -> {
            System.err.println("Authentication failed: " + throwable.getMessage());
            throw new RuntimeException(throwable);
        });
    }

    ${service.endpoints.map(endpoint => this.generateJavaEndpointExample(endpoint)).join('\n\n    ')}

    // Error handling example
    public static <T> CompletableFuture<T> handleApiCall(CompletableFuture<T> apiCall) {
        return apiCall
            .exceptionally(throwable -> {
                if (throwable instanceof ApiException) {
                    ApiException apiException = (ApiException) throwable;
                    
                    switch (apiException.getStatusCode()) {
                        case 400:
                            System.err.println("Bad Request - Check your parameters");
                            break;
                        case 401:
                            System.err.println("Unauthorized - Check your API key");
                            break;
                        case 429:
                            System.err.println("Rate limited - Wait before retrying");
                            break;
                        case 500:
                            System.err.println("Server error - Try again later");
                            break;
                        default:
                            System.err.println("Unexpected error: " + apiException.getStatusCode());
                    }
                } else {
                    System.err.println("Network error: " + throwable.getMessage());
                }
                throw new RuntimeException(throwable);
            });
    }

    public static void main(String[] args) {
        authenticate()
            .thenCompose(auth -> {
                // Use the authentication token for subsequent requests
                return api.someEndpoint();
            })
            .thenAccept(result -> {
                System.out.println("Result: " + result);
            })
            .join();
    }
}`;
  }

  private generateJavaEndpointExample(endpoint: any): string {
    const method = endpoint.method?.toLowerCase() || 'get';
    const operationId = endpoint.operationId;
    const summary = endpoint.summary;

    let example = `// ${summary}\n`;
    example += `    public static CompletableFuture<ResponseType> ${operationId}Example() {\n`;

    if (method === 'get') {
      example += `        return api.${operationId}(QueryParams.builder()\n`;
      example += `            .page(1)\n`;
      example += `            .limit(20)\n`;
      example += `            .build())\n`;
    } else if (method === 'post' || method === 'put') {
      example += `        return api.${operationId}(RequestBody.builder()\n`;
      example += `            .name("Example Name")\n`;
      example += `            .description("Example Description")\n`;
      example += `            .build())\n`;
    } else if (method === 'delete') {
      example += `        return api.${operationId}("resource-id")\n`;
    }

    example += `            .thenApply(result -> {\n`;
    example += `                System.out.println("Success: " + result);\n`;
    example += `                return result;\n`;
    example += `            })\n`;
    example += `            .exceptionally(throwable -> {\n`;
    example += `                System.err.println("Error: " + throwable.getMessage());\n`;
    example += `                throw new RuntimeException(throwable);\n`;
    example += `            });\n`;
    example += `    }`;

    return example;
  }

  private generateCSharpExamples(service: ServiceDefinition): string {
    return `// ${service.name} Service - C# Examples

// Install-Package StellarRec.Client

using StellarRec.Client;
using StellarRec.Client.Models;
using System;
using System.Threading.Tasks;

public class StellarRecExample
{
    private static readonly StellarRecAPI api = new StellarRecAPI(new StellarRecOptions
    {
        BaseUrl = "${service.baseUrl}",
        ApiKey = "your-api-key-here"
    });

    // Authentication
    public static async Task<AuthResponse> AuthenticateAsync()
    {
        try
        {
            var auth = await api.Auth.LoginAsync(new LoginRequest
            {
                Email = "user@example.com",
                Password = "your-password"
            });
            
            Console.WriteLine($"Authentication successful: {auth}");
            return auth;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Authentication failed: {ex.Message}");
            throw;
        }
    }

    ${service.endpoints.map(endpoint => this.generateCSharpEndpointExample(endpoint)).join('\n\n    ')}

    // Error handling example
    public static async Task<T> HandleApiCallAsync<T>(Task<T> apiCall)
    {
        try
        {
            return await apiCall;
        }
        catch (ApiException ex)
        {
            switch (ex.StatusCode)
            {
                case 400:
                    Console.WriteLine("Bad Request - Check your parameters");
                    break;
                case 401:
                    Console.WriteLine("Unauthorized - Check your API key");
                    break;
                case 429:
                    Console.WriteLine("Rate limited - Wait before retrying");
                    break;
                case 500:
                    Console.WriteLine("Server error - Try again later");
                    break;
                default:
                    Console.WriteLine($"Unexpected error: {ex.StatusCode}");
                    break;
            }
            throw;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Network error: {ex.Message}");
            throw;
        }
    }

    public static async Task Main(string[] args)
    {
        var auth = await AuthenticateAsync();
        Console.WriteLine($"Access token: {auth.AccessToken}");
    }
}`;
  }

  private generateCSharpEndpointExample(endpoint: any): string {
    const method = endpoint.method?.toLowerCase() || 'get';
    const operationId = endpoint.operationId;
    const summary = endpoint.summary;

    let example = `// ${summary}\n`;
    example += `    public static async Task<ResponseType> ${operationId}ExampleAsync()\n`;
    example += `    {\n`;
    example += `        try\n`;
    example += `        {\n`;

    if (method === 'get') {
      example += `            var result = await api.${operationId}Async(new QueryParams\n`;
      example += `            {\n`;
      example += `                Page = 1,\n`;
      example += `                Limit = 20\n`;
      example += `            });\n`;
    } else if (method === 'post' || method === 'put') {
      example += `            var result = await api.${operationId}Async(new RequestBody\n`;
      example += `            {\n`;
      example += `                Name = "Example Name",\n`;
      example += `                Description = "Example Description"\n`;
      example += `            });\n`;
    } else if (method === 'delete') {
      example += `            var result = await api.${operationId}Async("resource-id");\n`;
    }

    example += `            Console.WriteLine($"Success: {result}");\n`;
    example += `            return result;\n`;
    example += `        }\n`;
    example += `        catch (Exception ex)\n`;
    example += `        {\n`;
    example += `            Console.WriteLine($"Error: {ex.Message}");\n`;
    example += `            throw;\n`;
    example += `        }\n`;
    example += `    }`;

    return example;
  }

  private generatePhpExamples(service: ServiceDefinition): string {
    return `<?php
// ${service.name} Service - PHP Examples

// composer require stellarrec/php-client

require_once 'vendor/autoload.php';

use StellarRec\\Client\\StellarRecAPI;
use StellarRec\\Client\\Models\\LoginRequest;

// Initialize the client
$api = new StellarRecAPI([
    'base_url' => '${service.baseUrl}',
    'api_key' => 'your-api-key-here'
]);

// Authentication
function authenticate($api) {
    try {
        $auth = $api->auth()->login(new LoginRequest([
            'email' => 'user@example.com',
            'password' => 'your-password'
        ]));
        
        echo "Authentication successful: " . json_encode($auth) . "\\n";
        return $auth['access_token'];
    } catch (Exception $e) {
        echo "Authentication failed: " . $e->getMessage() . "\\n";
        throw $e;
    }
}

${service.endpoints.map(endpoint => this.generatePhpEndpointExample(endpoint)).join('\n\n')}

// Error handling example
function handleApiCall($apiCall) {
    try {
        return $apiCall();
    } catch (StellarRec\\Client\\ApiException $e) {
        switch ($e->getStatusCode()) {
            case 400:
                echo "Bad Request - Check your parameters\\n";
                break;
            case 401:
                echo "Unauthorized - Check your API key\\n";
                break;
            case 429:
                echo "Rate limited - Wait before retrying\\n";
                break;
            case 500:
                echo "Server error - Try again later\\n";
                break;
            default:
                echo "Unexpected error: " . $e->getStatusCode() . "\\n";
        }
        throw $e;
    } catch (Exception $e) {
        echo "Network error: " . $e->getMessage() . "\\n";
        throw $e;
    }
}

// Example usage
try {
    $token = authenticate($api);
    echo "Access token: $token\\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\\n";
}
?>`;
  }

  private generatePhpEndpointExample(endpoint: any): string {
    const method = endpoint.method?.toLowerCase() || 'get';
    const operationId = endpoint.operationId;
    const summary = endpoint.summary;

    let example = `// ${summary}\n`;
    example += `function ${operationId}_example($api) {\n`;
    example += `    try {\n`;

    if (method === 'get') {
      example += `        $result = $api->${operationId}([\n`;
      example += `            'page' => 1,\n`;
      example += `            'limit' => 20\n`;
      example += `        ]);\n`;
    } else if (method === 'post' || method === 'put') {
      example += `        $result = $api->${operationId}([\n`;
      example += `            'name' => 'Example Name',\n`;
      example += `            'description' => 'Example Description'\n`;
      example += `        ]);\n`;
    } else if (method === 'delete') {
      example += `        $result = $api->${operationId}('resource-id');\n`;
    }

    example += `        echo "Success: " . json_encode($result) . "\\n";\n`;
    example += `        return $result;\n`;
    example += `    } catch (Exception $e) {\n`;
    example += `        echo "Error: " . $e->getMessage() . "\\n";\n`;
    example += `        throw $e;\n`;
    example += `    }\n`;
    example += `}`;

    return example;
  }

  private generateRubyExamples(service: ServiceDefinition): string {
    return `# ${service.name} Service - Ruby Examples

# gem install stellarrec

require 'stellarrec'

# Initialize the client
api = StellarRec::API.new(
  base_url: '${service.baseUrl}',
  api_key: 'your-api-key-here'
)

# Authentication
def authenticate(api)
  begin
    auth = api.auth.login(
      email: 'user@example.com',
      password: 'your-password'
    )
    
    puts "Authentication successful: #{auth}"
    auth[:access_token]
  rescue => e
    puts "Authentication failed: #{e.message}"
    raise e
  end
end

${service.endpoints.map(endpoint => this.generateRubyEndpointExample(endpoint)).join('\n\n')}

# Error handling example
def handle_api_call(&block)
  begin
    block.call
  rescue StellarRec::ApiError => e
    case e.status_code
    when 400
      puts 'Bad Request - Check your parameters'
    when 401
      puts 'Unauthorized - Check your API key'
    when 429
      puts 'Rate limited - Wait before retrying'
    when 500
      puts 'Server error - Try again later'
    else
      puts "Unexpected error: #{e.status_code}"
    end
    raise e
  rescue => e
    puts "Network error: #{e.message}"
    raise e
  end
end

# Example usage
begin
  token = authenticate(api)
  puts "Access token: #{token}"
rescue => e
  puts "Error: #{e.message}"
end`;
  }

  private generateRubyEndpointExample(endpoint: any): string {
    const method = endpoint.method?.toLowerCase() || 'get';
    const operationId = endpoint.operationId;
    const summary = endpoint.summary;

    let example = `# ${summary}\n`;
    example += `def ${operationId}_example(api)\n`;
    example += `  begin\n`;

    if (method === 'get') {
      example += `    result = api.${operationId}(\n`;
      example += `      page: 1,\n`;
      example += `      limit: 20\n`;
      example += `    )\n`;
    } else if (method === 'post' || method === 'put') {
      example += `    result = api.${operationId}(\n`;
      example += `      name: 'Example Name',\n`;
      example += `      description: 'Example Description'\n`;
      example += `    )\n`;
    } else if (method === 'delete') {
      example += `    result = api.${operationId}('resource-id')\n`;
    }

    example += `    puts "Success: #{result}"\n`;
    example += `    result\n`;
    example += `  rescue => e\n`;
    example += `    puts "Error: #{e.message}"\n`;
    example += `    raise e\n`;
    example += `  end\n`;
    example += `end`;

    return example;
  }

  private generateGenericExamples(service: ServiceDefinition, language: string): string {
    return `// ${service.name} Service - ${language.charAt(0).toUpperCase() + language.slice(1)} Examples

// This is a generic template for ${language}
// Please refer to the language-specific documentation for detailed examples

// Base URL: ${service.baseUrl}
// Authentication: Bearer token required

// Available endpoints:
${service.endpoints.map(endpoint => 
  `// ${endpoint.method?.toUpperCase()} ${endpoint.path} - ${endpoint.summary}`
).join('\n')}

// For detailed implementation examples, please refer to:
// - Official documentation: https://docs.stellarrec.com
// - Language-specific SDKs: https://github.com/stellarrec/sdks
// - Community examples: https://github.com/stellarrec/examples`;
  }
}