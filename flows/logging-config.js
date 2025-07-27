/**
 * Logging Configuration for Pulse AI Secretary
 * Centralized logging configuration with security filters
 * Requirements: 5.4, 5.5
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const DEFAULT_LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';

/**
 * Sensitive data patterns to filter from logs
 */
const SENSITIVE_PATTERNS = [
  // API Keys and tokens
  /api[_-]?key[s]?[\s]*[:=][\s]*['"']?([a-zA-Z0-9_-]{20,})['"']?/gi,
  /token[s]?[\s]*[:=][\s]*['"']?([a-zA-Z0-9_.-]{20,})['"']?/gi,
  /bearer[\s]+([a-zA-Z0-9_.-]{20,})/gi,
  /authorization[\s]*:[\s]*['"']?([^'"'\s]{20,})['"']?/gi,
  
  // Passwords and secrets
  /password[s]?[\s]*[:=][\s]*['"']?([^'"'\s]{6,})['"']?/gi,
  /secret[s]?[\s]*[:=][\s]*['"']?([^'"'\s]{10,})['"']?/gi,
  /credential[s]?[\s]*[:=][\s]*['"']?([^'"'\s]{10,})['"']?/gi,
  
  // Personal information
  /phone[\s]*[:=][\s]*['"']?(\+?[\d\s\-\(\)]{10,})['"']?/gi,
  /email[\s]*[:=][\s]*['"']?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})['"']?/gi,
  
  // Twilio specific
  /AC[a-zA-Z0-9]{32}/g, // Twilio Account SID
  /SK[a-zA-Z0-9]{32}/g, // Twilio API Key SID
  
  // Google API specific
  /AIza[0-9A-Za-z_-]{35}/g, // Google API Key
  /ya29\.[0-9A-Za-z_-]+/g, // Google OAuth2 access token
];

/**
 * Fields that should be completely removed from logs
 */
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'apiKey',
  'api_key',
  'secret',
  'credential',
  'authorization',
  'x-goog-api-key',
  'auth_token',
  'access_token',
  'refresh_token'
];

/**
 * Filter sensitive data from log messages
 * @param {string} message - Log message to filter
 * @returns {string} Filtered message
 */
function filterSensitiveData(message) {
  if (typeof message !== 'string') {
    return message;
  }

  let filtered = message;
  
  SENSITIVE_PATTERNS.forEach(pattern => {
    filtered = filtered.replace(pattern, (match, captured) => {
      if (captured && captured.length > 4) {
        return match.replace(captured, captured.substring(0, 4) + '*'.repeat(captured.length - 4));
      }
      return match.replace(captured || match, '[REDACTED]');
    });
  });

  return filtered;
}

/**
 * Recursively filter sensitive data from objects
 * @param {any} obj - Object to filter
 * @returns {any} Filtered object
 */
function filterSensitiveObject(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return filterSensitiveData(obj);
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => filterSensitiveObject(item));
  }

  const filtered = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const keyLower = key.toLowerCase();
    
    // Remove sensitive fields entirely
    if (SENSITIVE_FIELDS.some(field => keyLower.includes(field))) {
      filtered[key] = '[REDACTED]';
      continue;
    }
    
    // Recursively filter nested objects
    if (typeof value === 'object' && value !== null) {
      filtered[key] = filterSensitiveObject(value);
    } else if (typeof value === 'string') {
      filtered[key] = filterSensitiveData(value);
    } else {
      filtered[key] = value;
    }
  }

  return filtered;
}

/**
 * Enhanced logger with security filtering
 */
class SecureLogger {
  constructor(component = 'Unknown') {
    this.component = component;
    this.logLevel = LOG_LEVELS[DEFAULT_LOG_LEVEL.toUpperCase()] || LOG_LEVELS.INFO;
  }

  shouldLog(level) {
    return LOG_LEVELS[level] <= this.logLevel;
  }

  formatLogEntry(level, message, data = null, error = null) {
    const entry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      component: this.component,
      message: filterSensitiveData(message),
      ...(data && { data: filterSensitiveObject(data) }),
      ...(error && { 
        error: {
          message: filterSensitiveData(error.message),
          stack: error.stack ? filterSensitiveData(error.stack) : undefined,
          code: error.code
        }
      })
    };

    return JSON.stringify(entry);
  }

  error(message, data = null, error = null) {
    if (this.shouldLog('ERROR')) {
      console.error(this.formatLogEntry('ERROR', message, data, error));
    }
  }

  warn(message, data = null) {
    if (this.shouldLog('WARN')) {
      console.warn(this.formatLogEntry('WARN', message, data));
    }
  }

  info(message, data = null) {
    if (this.shouldLog('INFO')) {
      console.log(this.formatLogEntry('INFO', message, data));
    }
  }

  debug(message, data = null) {
    if (this.shouldLog('DEBUG')) {
      console.log(this.formatLogEntry('DEBUG', message, data));
    }
  }
}

/**
 * Create a logger instance for a specific component
 * @param {string} component - Component name
 * @returns {SecureLogger} Logger instance
 */
function createLogger(component) {
  return new SecureLogger(component);
}

/**
 * Workflow execution logger with enhanced error tracking
 */
class WorkflowLogger extends SecureLogger {
  constructor() {
    super('Workflow');
    this.executionId = null;
    this.workflowName = null;
  }

  setExecutionContext(executionId, workflowName) {
    this.executionId = executionId;
    this.workflowName = workflowName;
  }

  formatLogEntry(level, message, data = null, error = null) {
    const baseEntry = JSON.parse(super.formatLogEntry(level, message, data, error));
    
    return JSON.stringify({
      ...baseEntry,
      ...(this.executionId && { executionId: this.executionId }),
      ...(this.workflowName && { workflowName: this.workflowName })
    });
  }

  logNodeExecution(nodeName, status, data = null, error = null) {
    const message = `Node ${nodeName} ${status}`;
    const logData = {
      nodeName,
      status,
      ...(data && { nodeData: data })
    };

    if (status === 'failed' || error) {
      this.error(message, logData, error);
    } else if (status === 'completed') {
      this.info(message, logData);
    } else {
      this.debug(message, logData);
    }
  }

  logAPICall(apiName, method, url, status, responseTime, error = null) {
    const message = `${apiName} API call ${status}`;
    const logData = {
      api: apiName,
      method,
      url: filterSensitiveData(url),
      status,
      responseTime,
      timestamp: new Date().toISOString()
    };

    if (error || (status >= 400)) {
      this.error(message, logData, error);
    } else {
      this.info(message, logData);
    }
  }

  logRateLimit(service, action, currentCount, limit, resetTime = null) {
    const message = `Rate limit ${action} for ${service}`;
    const logData = {
      service,
      action,
      currentCount,
      limit,
      ...(resetTime && { resetTime })
    };

    if (action === 'exceeded' || action === 'approaching') {
      this.warn(message, logData);
    } else {
      this.info(message, logData);
    }
  }
}

// Export for use in n8n workflows and other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SecureLogger,
    WorkflowLogger,
    createLogger,
    filterSensitiveData,
    filterSensitiveObject,
    LOG_LEVELS
  };
}

// Global workflow logger instance
const workflowLogger = new WorkflowLogger();

// Make available globally for n8n workflows
if (typeof global !== 'undefined') {
  global.workflowLogger = workflowLogger;
  global.createLogger = createLogger;
}