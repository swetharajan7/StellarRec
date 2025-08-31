import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

interface WAFRule {
  name: string;
  pattern: RegExp;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'log' | 'block' | 'challenge';
  description: string;
}

class WebApplicationFirewall {
  private rules: WAFRule[] = [
    // SQL Injection Rules
    {
      name: 'SQL_INJECTION_UNION',
      pattern: /(\bunion\b.*\bselect\b)|(\bselect\b.*\bunion\b)/gi,
      severity: 'critical',
      action: 'block',
      description: 'SQL injection attempt using UNION SELECT'
    },
    {
      name: 'SQL_INJECTION_COMMENT',
      pattern: /(--|\#|\/\*|\*\/)/g,
      severity: 'high',
      action: 'block',
      description: 'SQL injection attempt using comments'
    },
    {
      name: 'SQL_INJECTION_STACKED',
      pattern: /;\s*(drop|delete|insert|update|create|alter|exec|execute)/gi,
      severity: 'critical',
      action: 'block',
      description: 'SQL injection attempt using stacked queries'
    },
    {
      name: 'SQL_INJECTION_BLIND',
      pattern: /(sleep\(|benchmark\(|waitfor\s+delay)/gi,
      severity: 'high',
      action: 'block',
      description: 'Blind SQL injection attempt'
    },

    // XSS Rules
    {
      name: 'XSS_SCRIPT_TAG',
      pattern: /<script[^>]*>.*?<\/script>/gi,
      severity: 'critical',
      action: 'block',
      description: 'XSS attempt using script tags'
    },
    {
      name: 'XSS_EVENT_HANDLER',
      pattern: /on(load|error|click|mouseover|focus|blur|change|submit)\s*=/gi,
      severity: 'high',
      action: 'block',
      description: 'XSS attempt using event handlers'
    },
    {
      name: 'XSS_JAVASCRIPT_PROTOCOL',
      pattern: /javascript\s*:/gi,
      severity: 'high',
      action: 'block',
      description: 'XSS attempt using javascript protocol'
    },
    {
      name: 'XSS_DATA_URI',
      pattern: /data\s*:\s*text\/html/gi,
      severity: 'medium',
      action: 'block',
      description: 'XSS attempt using data URI'
    },

    // Command Injection Rules
    {
      name: 'COMMAND_INJECTION_BASIC',
      pattern: /[;&|`$(){}[\]]/g,
      severity: 'high',
      action: 'block',
      description: 'Command injection attempt using shell metacharacters'
    },
    {
      name: 'COMMAND_INJECTION_UNIX',
      pattern: /(cat|ls|pwd|whoami|id|uname|ps|netstat|ifconfig|wget|curl)\s/gi,
      severity: 'high',
      action: 'block',
      description: 'Command injection attempt using Unix commands'
    },
    {
      name: 'COMMAND_INJECTION_WINDOWS',
      pattern: /(dir|type|copy|del|net|ping|ipconfig|systeminfo)\s/gi,
      severity: 'high',
      action: 'block',
      description: 'Command injection attempt using Windows commands'
    },

    // Path Traversal Rules
    {
      name: 'PATH_TRAVERSAL_BASIC',
      pattern: /\.\.[\/\\]/g,
      severity: 'high',
      action: 'block',
      description: 'Path traversal attempt'
    },
    {
      name: 'PATH_TRAVERSAL_ENCODED',
      pattern: /(%2e%2e[%2f%5c]|%252e%252e[%252f%255c])/gi,
      severity: 'high',
      action: 'block',
      description: 'Encoded path traversal attempt'
    },

    // File Inclusion Rules
    {
      name: 'LFI_ATTEMPT',
      pattern: /(\/etc\/passwd|\/etc\/shadow|\/proc\/self\/environ|\/var\/log)/gi,
      severity: 'critical',
      action: 'block',
      description: 'Local file inclusion attempt'
    },
    {
      name: 'RFI_ATTEMPT',
      pattern: /(https?:\/\/|ftp:\/\/|file:\/\/)/gi,
      severity: 'high',
      action: 'log',
      description: 'Remote file inclusion attempt'
    },

    // LDAP Injection Rules
    {
      name: 'LDAP_INJECTION',
      pattern: /[()&|!*]/g,
      severity: 'medium',
      action: 'log',
      description: 'LDAP injection attempt'
    },

    // XML/XXE Rules
    {
      name: 'XXE_EXTERNAL_ENTITY',
      pattern: /<!ENTITY.*SYSTEM/gi,
      severity: 'critical',
      action: 'block',
      description: 'XXE attack attempt'
    },
    {
      name: 'XML_BOMB',
      pattern: /<!ENTITY.*&.*>/gi,
      severity: 'high',
      action: 'block',
      description: 'XML bomb attempt'
    },

    // NoSQL Injection Rules
    {
      name: 'NOSQL_INJECTION_MONGO',
      pattern: /(\$where|\$ne|\$gt|\$lt|\$regex|\$or|\$and)/gi,
      severity: 'high',
      action: 'block',
      description: 'NoSQL injection attempt (MongoDB)'
    },

    // HTTP Header Injection Rules
    {
      name: 'HEADER_INJECTION_CRLF',
      pattern: /(\r\n|\n|\r)/g,
      severity: 'medium',
      action: 'block',
      description: 'HTTP header injection attempt'
    },

    // Server-Side Template Injection Rules
    {
      name: 'SSTI_JINJA2',
      pattern: /\{\{.*\}\}/g,
      severity: 'high',
      action: 'block',
      description: 'Server-side template injection (Jinja2)'
    },
    {
      name: 'SSTI_FREEMARKER',
      pattern: /<#.*>/g,
      severity: 'high',
      action: 'block',
      description: 'Server-side template injection (FreeMarker)'
    },

    // Suspicious User Agents
    {
      name: 'SUSPICIOUS_USER_AGENT',
      pattern: /(sqlmap|nikto|nmap|masscan|nessus|openvas|burp|zap|w3af|skipfish)/gi,
      severity: 'high',
      action: 'block',
      description: 'Suspicious user agent detected'
    },

    // Suspicious File Extensions
    {
      name: 'SUSPICIOUS_FILE_EXTENSION',
      pattern: /\.(php|asp|aspx|jsp|cgi|pl|py|rb|sh|bat|cmd|exe|dll)$/gi,
      severity: 'medium',
      action: 'log',
      description: 'Suspicious file extension in request'
    }
  ];

  private blockedIPs: Set<string> = new Set();
  private suspiciousIPs: Map<string, number> = new Map();

  checkRequest(req: Request): { blocked: boolean; violations: string[]; severity: string } {
    const violations: string[] = [];
    let maxSeverity = 'low';
    const ip = req.ip || req.connection.remoteAddress || 'unknown';

    // Check if IP is already blocked
    if (this.blockedIPs.has(ip)) {
      return { blocked: true, violations: ['IP_BLOCKED'], severity: 'critical' };
    }

    // Combine all request data for analysis
    const requestData = this.extractRequestData(req);

    // Check each rule
    for (const rule of this.rules) {
      if (this.testRule(rule, requestData, req)) {
        violations.push(rule.name);
        
        // Update max severity
        if (this.getSeverityLevel(rule.severity) > this.getSeverityLevel(maxSeverity)) {
          maxSeverity = rule.severity;
        }

        // Handle rule action
        if (rule.action === 'block') {
          this.handleViolation(ip, rule);
          return { blocked: true, violations, severity: maxSeverity };
        }
      }
    }

    // Check for multiple violations from same IP
    if (violations.length > 0) {
      const suspiciousCount = this.suspiciousIPs.get(ip) || 0;
      this.suspiciousIPs.set(ip, suspiciousCount + violations.length);

      if (suspiciousCount > 10) {
        this.blockedIPs.add(ip);
        logger.warn(`IP ${ip} blocked due to multiple violations`);
        return { blocked: true, violations: [...violations, 'MULTIPLE_VIOLATIONS'], severity: 'critical' };
      }
    }

    return { blocked: false, violations, severity: maxSeverity };
  }

  private extractRequestData(req: Request): string {
    const parts: string[] = [];
    
    // URL and query parameters
    parts.push(req.url || '');
    
    // Headers (excluding sensitive ones)
    const headers = req.headers;
    for (const [key, value] of Object.entries(headers)) {
      if (!['authorization', 'cookie', 'x-api-key'].includes(key.toLowerCase())) {
        parts.push(`${key}: ${value}`);
      }
    }
    
    // Body (if present and not too large)
    if (req.body && typeof req.body === 'object') {
      try {
        const bodyStr = JSON.stringify(req.body);
        if (bodyStr.length < 10000) { // Limit body size for analysis
          parts.push(bodyStr);
        }
      } catch (error) {
        // Ignore JSON stringify errors
      }
    } else if (typeof req.body === 'string' && req.body.length < 10000) {
      parts.push(req.body);
    }

    return parts.join(' ');
  }

  private testRule(rule: WAFRule, requestData: string, req: Request): boolean {
    // Special handling for user agent rules
    if (rule.name === 'SUSPICIOUS_USER_AGENT') {
      const userAgent = req.get('User-Agent') || '';
      return rule.pattern.test(userAgent);
    }

    // Special handling for file extension rules
    if (rule.name === 'SUSPICIOUS_FILE_EXTENSION') {
      const url = req.url || '';
      return rule.pattern.test(url);
    }

    // Special handling for header injection (check specific headers)
    if (rule.name === 'HEADER_INJECTION_CRLF') {
      const headers = req.headers;
      for (const value of Object.values(headers)) {
        if (typeof value === 'string' && rule.pattern.test(value)) {
          return true;
        }
      }
      return false;
    }

    return rule.pattern.test(requestData);
  }

  private getSeverityLevel(severity: string): number {
    const levels = { low: 1, medium: 2, high: 3, critical: 4 };
    return levels[severity as keyof typeof levels] || 1;
  }

  private handleViolation(ip: string, rule: WAFRule): void {
    logger.warn('WAF rule violation', {
      ip,
      rule: rule.name,
      severity: rule.severity,
      description: rule.description
    });

    // Increment suspicious activity counter
    const count = this.suspiciousIPs.get(ip) || 0;
    this.suspiciousIPs.set(ip, count + 1);

    // Auto-block for critical violations
    if (rule.severity === 'critical') {
      this.blockedIPs.add(ip);
      logger.error(`IP ${ip} auto-blocked due to critical violation: ${rule.name}`);
    }
  }

  // Admin methods
  blockIP(ip: string): void {
    this.blockedIPs.add(ip);
    logger.info(`IP ${ip} manually blocked`);
  }

  unblockIP(ip: string): void {
    this.blockedIPs.delete(ip);
    this.suspiciousIPs.delete(ip);
    logger.info(`IP ${ip} unblocked`);
  }

  getBlockedIPs(): string[] {
    return Array.from(this.blockedIPs);
  }

  getSuspiciousIPs(): Array<{ ip: string; violations: number }> {
    return Array.from(this.suspiciousIPs.entries()).map(([ip, violations]) => ({
      ip,
      violations
    }));
  }

  clearSuspiciousActivity(): void {
    this.suspiciousIPs.clear();
    logger.info('Suspicious activity counters cleared');
  }

  addCustomRule(rule: WAFRule): void {
    this.rules.push(rule);
    logger.info(`Custom WAF rule added: ${rule.name}`);
  }

  removeRule(ruleName: string): void {
    const index = this.rules.findIndex(rule => rule.name === ruleName);
    if (index !== -1) {
      this.rules.splice(index, 1);
      logger.info(`WAF rule removed: ${ruleName}`);
    }
  }
}

export const waf = new WebApplicationFirewall();

export const wafMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = waf.checkRequest(req);
    
    if (result.blocked) {
      logger.warn('Request blocked by WAF', {
        ip: req.ip,
        url: req.url,
        method: req.method,
        userAgent: req.get('User-Agent'),
        violations: result.violations,
        severity: result.severity
      });
      
      return res.status(403).json({
        error: 'Request blocked by security policy',
        reference: `WAF-${Date.now()}`
      });
    }

    if (result.violations.length > 0) {
      logger.info('WAF violations detected but not blocked', {
        ip: req.ip,
        url: req.url,
        violations: result.violations,
        severity: result.severity
      });
    }

    // Attach WAF analysis to request for logging
    (req as any).wafAnalysis = result;
    next();
  } catch (error) {
    logger.error('WAF middleware error:', error);
    next(); // Continue processing even if WAF fails
  }
};