/**
 * n8n Security Configuration for Production Deployment
 * Implements security hardening for n8n workflow engine
 * Requirements: 2.2, 2.3, 2.4
 */

/**
 * Production security environment variables for n8n
 * These should be set in production deployments
 */
const PRODUCTION_SECURITY_ENV = {
  // Disable UI credential editing for security
  N8N_DISABLE_UI: 'true',
  
  // Enable secure cookies for HTTPS
  N8N_SECURE_COOKIE: 'true',
  
  // Disable production warnings
  N8N_DISABLE_PRODUCTION_MAIN_PROCESS: 'false',
  
  // Enable metrics endpoint for monitoring
  N8N_METRICS: 'true',
  
  // Set secure session settings
  N8N_SESSION_COOKIE_SECURE: 'true',
  N8N_SESSION_COOKIE_SAME_SITE: 'strict',
  
  // Disable telemetry for privacy
  N8N_DIAGNOSTICS_ENABLED: 'false',
  N8N_VERSION_NOTIFICATIONS_ENABLED: 'false',
  
  // Set secure defaults
  N8N_DEFAULT_BINARY_DATA_MODE: 'filesystem',
  N8N_BINARY_DATA_TTL: '24', // 24 hours
  
  // Logging configuration
  N8N_LOG_LEVEL: 'info',
  N8N_LOG_OUTPUT: 'console',
  
  // Security headers
  N8N_SECURITY_AUDIT_EVENTS: 'true'
};

/**
 * Development security environment variables
 * Secure defaults for development environments
 */
const DEVELOPMENT_SECURITY_ENV = {
  // Allow UI credential editing in development
  N8N_DISABLE_UI: 'false',
  
  // HTTP cookies for local development
  N8N_SECURE_COOKIE: 'false',
  
  // Enable detailed logging for debugging
  N8N_LOG_LEVEL: 'debug',
  
  // Enable metrics for development monitoring
  N8N_METRICS: 'true',
  
  // Disable telemetry for privacy
  N8N_DIAGNOSTICS_ENABLED: 'false',
  N8N_VERSION_NOTIFICATIONS_ENABLED: 'false'
};

/**
 * Security headers for n8n HTTP responses
 * Implements security best practices
 */
const SECURITY_HEADERS = {
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  
  // XSS protection
  'X-XSS-Protection': '1; mode=block',
  
  // Content type sniffing protection
  'X-Content-Type-Options': 'nosniff',
  
  // Referrer policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Content Security Policy
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // n8n requires inline scripts
    "style-src 'self' 'unsafe-inline'", // n8n requires inline styles
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "frame-ancestors 'none'"
  ].join('; '),
  
  // HSTS for HTTPS deployments
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
};

/**
 * Credential security configuration
 * Defines how credentials should be handled securely
 */
const CREDENTIAL_SECURITY_CONFIG = {
  // Encryption settings
  encryptionKey: {
    required: true,
    envVar: 'N8N_ENCRYPTION_KEY',
    minLength: 32,
    description: 'AES-256 encryption key for credential storage'
  },
  
  // Credential storage settings
  storage: {
    type: 'database', // Store in PostgreSQL, not filesystem
    encrypted: true,
    backupEnabled: false, // Disable credential backups for security
    exportEnabled: false // Disable credential export
  },
  
  // Access control
  access: {
    uiEditingDisabled: true, // Disable credential editing in UI for production
    apiAccessRestricted: true, // Restrict API access to credentials
    auditLogging: true // Log all credential access
  }
};

/**
 * Workflow security configuration
 * Defines security settings for workflow execution
 */
const WORKFLOW_SECURITY_CONFIG = {
  // Execution settings
  execution: {
    timeout: 300000, // 5 minutes maximum execution time
    maxConcurrency: 10, // Maximum concurrent workflow executions
    retryAttempts: 3, // Maximum retry attempts
    
    // Memory limits
    maxMemoryUsage: '512MB',
    
    // Network restrictions
    allowedDomains: [
      'generativelanguage.googleapis.com', // Gemini API
      'gmail.googleapis.com', // Gmail API
      'api.twilio.com', // Twilio API
      'accounts.google.com' // Google OAuth
    ]
  },
  
  // Data handling
  data: {
    maxPayloadSize: '10MB',
    sensitiveDataFiltering: true,
    dataRetention: '7d', // Keep execution data for 7 days
    binaryDataTTL: '24h' // Binary data TTL
  },
  
  // Logging and monitoring
  monitoring: {
    executionLogging: true,
    errorLogging: true,
    performanceMetrics: true,
    securityAuditLog: true
  }
};

/**
 * Database security configuration
 * PostgreSQL security settings
 */
const DATABASE_SECURITY_CONFIG = {
  // Connection security
  connection: {
    ssl: process.env.NODE_ENV === 'production',
    sslMode: 'require',
    connectionTimeout: 10000,
    idleTimeout: 30000,
    maxConnections: 20
  },
  
  // Data encryption
  encryption: {
    encryptAtRest: true,
    encryptInTransit: true,
    keyRotation: true
  },
  
  // Access control
  access: {
    readOnlyUser: false, // n8n needs write access
    restrictedTables: [], // No table restrictions for n8n
    auditLogging: true
  },
  
  // Backup and recovery
  backup: {
    enabled: true,
    encrypted: true,
    retention: '30d',
    schedule: 'daily'
  }
};

/**
 * Security configuration validator
 * Validates security settings and environment
 */
class SecurityConfigValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Validate complete security configuration
   * @returns {Object} Validation results
   */
  validateConfiguration() {
    this.errors = [];
    this.warnings = [];

    // Validate environment-specific settings
    this.validateEnvironmentSecurity();
    
    // Validate credential configuration
    this.validateCredentialSecurity();
    
    // Validate workflow security
    this.validateWorkflowSecurity();
    
    // Validate database security
    this.validateDatabaseSecurity();

    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      validatedAt: new Date().toISOString()
    };
  }

  /**
   * Validate environment-specific security settings
   */
  validateEnvironmentSecurity() {
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
      // Check production security requirements
      if (process.env.N8N_DISABLE_UI !== 'true') {
        this.errors.push('N8N_DISABLE_UI must be true in production');
      }
      
      if (process.env.N8N_SECURE_COOKIE !== 'true') {
        this.errors.push('N8N_SECURE_COOKIE must be true in production');
      }
      
      if (!process.env.N8N_ENCRYPTION_KEY) {
        this.errors.push('N8N_ENCRYPTION_KEY is required in production');
      } else if (process.env.N8N_ENCRYPTION_KEY.length < 32) {
        this.errors.push('N8N_ENCRYPTION_KEY must be at least 32 characters');
      }
    } else {
      // Development environment warnings
      if (!process.env.N8N_ENCRYPTION_KEY) {
        this.warnings.push('N8N_ENCRYPTION_KEY not set - using default (insecure)');
      }
    }
  }

  /**
   * Validate credential security configuration
   */
  validateCredentialSecurity() {
    // Check if sensitive credentials are properly configured
    const requiredCredentials = [
      'GEMINI_API_KEY',
      'GOOGLE_CLIENT_SECRET',
      'TWILIO_AUTH_TOKEN'
    ];

    for (const credential of requiredCredentials) {
      if (!process.env[credential]) {
        this.errors.push(`Required credential ${credential} is missing`);
      }
    }

    // Check credential strength
    if (process.env.N8N_BASIC_AUTH_PASSWORD) {
      const password = process.env.N8N_BASIC_AUTH_PASSWORD;
      if (password.length < 12) {
        this.warnings.push('N8N_BASIC_AUTH_PASSWORD should be at least 12 characters');
      }
    }
  }

  /**
   * Validate workflow security settings
   */
  validateWorkflowSecurity() {
    // Check execution timeout
    const timeout = parseInt(process.env.N8N_WORKFLOW_TIMEOUT || '300000');
    if (timeout > 600000) { // 10 minutes
      this.warnings.push('Workflow timeout is very high - consider reducing for security');
    }

    // Check if metrics are enabled for monitoring
    if (process.env.N8N_METRICS !== 'true') {
      this.warnings.push('N8N_METRICS should be enabled for security monitoring');
    }
  }

  /**
   * Validate database security settings
   */
  validateDatabaseSecurity() {
    // Check database password strength
    const dbPassword = process.env.DB_POSTGRESDB_PASSWORD;
    if (dbPassword && dbPassword.length < 16) {
      this.warnings.push('Database password should be at least 16 characters');
    }

    // Check SSL configuration for production
    if (process.env.NODE_ENV === 'production' && !process.env.DB_POSTGRESDB_SSL) {
      this.warnings.push('Database SSL should be enabled in production');
    }
  }
}

/**
 * Security audit logger
 * Logs security-related events for monitoring
 */
class SecurityAuditLogger {
  constructor() {
    this.component = 'SecurityAudit';
  }

  /**
   * Log security event
   * @param {string} event - Event type
   * @param {Object} details - Event details
   * @param {string} severity - Event severity (low, medium, high, critical)
   */
  logSecurityEvent(event, details = {}, severity = 'medium') {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: severity === 'critical' ? 'ERROR' : 'WARN',
      component: this.component,
      event: event,
      severity: severity,
      details: this.sanitizeDetails(details)
    };

    console.log(JSON.stringify(logEntry));
  }

  /**
   * Sanitize event details to remove sensitive information
   * @param {Object} details - Details to sanitize
   * @returns {Object} Sanitized details
   */
  sanitizeDetails(details) {
    const sanitized = { ...details };
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'key', 'secret', 'credential'];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Log credential access
   * @param {string} credentialType - Type of credential accessed
   * @param {string} action - Action performed (read, write, delete)
   * @param {boolean} success - Whether action was successful
   */
  logCredentialAccess(credentialType, action, success) {
    this.logSecurityEvent('credential_access', {
      credentialType: credentialType,
      action: action,
      success: success,
      timestamp: new Date().toISOString()
    }, success ? 'low' : 'high');
  }

  /**
   * Log authentication event
   * @param {string} method - Authentication method
   * @param {boolean} success - Whether authentication was successful
   * @param {string} userAgent - User agent string
   */
  logAuthenticationEvent(method, success, userAgent = '') {
    this.logSecurityEvent('authentication', {
      method: method,
      success: success,
      userAgent: userAgent,
      timestamp: new Date().toISOString()
    }, success ? 'low' : 'medium');
  }
}

// Export configuration and utilities
module.exports = {
  PRODUCTION_SECURITY_ENV,
  DEVELOPMENT_SECURITY_ENV,
  SECURITY_HEADERS,
  CREDENTIAL_SECURITY_CONFIG,
  WORKFLOW_SECURITY_CONFIG,
  DATABASE_SECURITY_CONFIG,
  SecurityConfigValidator,
  SecurityAuditLogger
};

// Make available globally for n8n workflows
if (typeof global !== 'undefined') {
  global.SecurityAuditLogger = SecurityAuditLogger;
  global.SecurityConfigValidator = SecurityConfigValidator;
}