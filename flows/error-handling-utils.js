/**
 * Error Handling Utilities for n8n Workflows
 * Provides comprehensive error handling, logging, and retry mechanisms
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

/**
 * Exponential backoff utility for API rate limiting
 * @param {number} attempt - Current attempt number (0-based)
 * @param {number} baseDelay - Base delay in milliseconds (default: 1000)
 * @param {number} maxDelay - Maximum delay in milliseconds (default: 30000)
 * @returns {number} Delay in milliseconds
 */
function calculateExponentialBackoff(attempt, baseDelay = 1000, maxDelay = 30000) {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.1 * delay;
  return Math.floor(delay + jitter);
}

/**
 * Sanitize data for logging to prevent sensitive information exposure
 * @param {any} data - Data to sanitize
 * @returns {any} Sanitized data
 */
function sanitizeForLogging(data) {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sensitiveKeys = [
    'password', 'token', 'key', 'secret', 'auth', 'credential',
    'authorization', 'x-goog-api-key', 'api_key', 'apikey',
    'phone', 'email', 'address', 'ssn', 'credit_card'
  ];

  const sanitized = Array.isArray(data) ? [] : {};

  for (const [key, value] of Object.entries(data)) {
    const keyLower = key.toLowerCase();
    const isSensitive = sensitiveKeys.some(sensitive => keyLower.includes(sensitive));

    if (isSensitive) {
      if (typeof value === 'string' && value.length > 4) {
        sanitized[key] = value.substring(0, 4) + '*'.repeat(value.length - 4);
      } else {
        sanitized[key] = '[REDACTED]';
      }
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLogging(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Enhanced logging function with timestamp and context
 * @param {string} level - Log level (info, warn, error, debug)
 * @param {string} component - Component name
 * @param {string} message - Log message
 * @param {any} data - Additional data to log
 */
function logWithContext(level, component, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    component,
    message,
    ...(data && { data: sanitizeForLogging(data) })
  };

  console.log(JSON.stringify(logEntry));
}

/**
 * Retry mechanism with exponential backoff
 * @param {Function} operation - Async operation to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {string} operationName - Name for logging
 * @returns {Promise<any>} Operation result
 */
async function retryWithBackoff(operation, maxRetries = 3, operationName = 'operation') {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      logWithContext('debug', 'RetryHandler', `Attempting ${operationName}`, { attempt, maxRetries });
      const result = await operation();
      
      if (attempt > 0) {
        logWithContext('info', 'RetryHandler', `${operationName} succeeded after ${attempt} retries`);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        logWithContext('error', 'RetryHandler', `${operationName} failed after ${maxRetries} retries`, {
          error: error.message,
          stack: error.stack
        });
        throw error;
      }

      const delay = calculateExponentialBackoff(attempt);
      logWithContext('warn', 'RetryHandler', `${operationName} failed, retrying in ${delay}ms`, {
        attempt,
        error: error.message,
        nextRetryIn: delay
      });

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Database connection retry mechanism
 * @param {Function} dbOperation - Database operation to execute
 * @param {string} operationName - Operation name for logging
 * @returns {Promise<any>} Operation result
 */
async function retryDatabaseOperation(dbOperation, operationName = 'database operation') {
  return retryWithBackoff(async () => {
    try {
      return await dbOperation();
    } catch (error) {
      // Check if it's a connection error that should be retried
      const retryableErrors = [
        'ECONNREFUSED',
        'ENOTFOUND',
        'ETIMEDOUT',
        'ECONNRESET',
        'connection terminated',
        'server closed the connection'
      ];

      const isRetryable = retryableErrors.some(errType => 
        error.message.toLowerCase().includes(errType.toLowerCase())
      );

      if (!isRetryable) {
        logWithContext('error', 'DatabaseRetry', `Non-retryable database error for ${operationName}`, {
          error: error.message,
          code: error.code
        });
        throw error;
      }

      logWithContext('warn', 'DatabaseRetry', `Retryable database error for ${operationName}`, {
        error: error.message,
        code: error.code
      });
      throw error;
    }
  }, 3, operationName);
}

/**
 * Gemini API specific error handling with rate limiting
 * @param {Function} geminiOperation - Gemini API operation
 * @returns {Promise<any>} API response
 */
async function handleGeminiAPICall(geminiOperation) {
  return retryWithBackoff(async () => {
    try {
      const response = await geminiOperation();
      
      // Check for rate limiting in response
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
        
        logWithContext('warn', 'GeminiAPI', 'Rate limit hit, backing off', { retryAfter: delay });
        await new Promise(resolve => setTimeout(resolve, delay));
        throw new Error('Rate limited - retry needed');
      }

      if (response.status === 403) {
        logWithContext('error', 'GeminiAPI', 'API quota exceeded or invalid key');
        throw new Error('Gemini API quota exceeded or invalid API key');
      }

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      }

      return response;
    } catch (error) {
      logWithContext('error', 'GeminiAPI', 'API call failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }, 3, 'Gemini API call');
}

/**
 * Workflow-level error handler
 * @param {Error} error - Error object
 * @param {string} nodeName - Name of the node where error occurred
 * @param {any} context - Additional context data
 */
function handleWorkflowError(error, nodeName, context = {}) {
  logWithContext('error', 'WorkflowError', `Error in node: ${nodeName}`, {
    error: error.message,
    stack: error.stack,
    node: nodeName,
    context: sanitizeForLogging(context)
  });

  // Return a standardized error response
  return {
    error: true,
    message: error.message,
    node: nodeName,
    timestamp: new Date().toISOString(),
    context: sanitizeForLogging(context)
  };
}

/**
 * Token usage tracking for Gemini API
 */
class TokenTracker {
  constructor() {
    this.dailyTokens = 0;
    this.lastReset = new Date().toDateString();
    this.maxDailyTokens = 1000000; // 1M tokens per day for free tier
  }

  estimateTokens(text) {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  checkAndUpdateTokens(inputText, outputText = '') {
    const today = new Date().toDateString();
    
    // Reset daily counter if new day
    if (this.lastReset !== today) {
      this.dailyTokens = 0;
      this.lastReset = today;
      logWithContext('info', 'TokenTracker', 'Daily token counter reset');
    }

    const inputTokens = this.estimateTokens(inputText);
    const outputTokens = this.estimateTokens(outputText);
    const totalTokens = inputTokens + outputTokens;

    if (this.dailyTokens + totalTokens > this.maxDailyTokens) {
      logWithContext('error', 'TokenTracker', 'Daily token limit would be exceeded', {
        currentTokens: this.dailyTokens,
        requestTokens: totalTokens,
        maxTokens: this.maxDailyTokens
      });
      throw new Error('Daily Gemini API token limit would be exceeded');
    }

    this.dailyTokens += totalTokens;
    
    logWithContext('info', 'TokenTracker', 'Token usage updated', {
      inputTokens,
      outputTokens,
      totalTokens,
      dailyTotal: this.dailyTokens,
      remainingTokens: this.maxDailyTokens - this.dailyTokens
    });

    return {
      inputTokens,
      outputTokens,
      totalTokens,
      dailyTotal: this.dailyTokens,
      remainingTokens: this.maxDailyTokens - this.dailyTokens
    };
  }
}

// Export utilities for use in n8n workflow nodes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calculateExponentialBackoff,
    sanitizeForLogging,
    logWithContext,
    retryWithBackoff,
    retryDatabaseOperation,
    handleGeminiAPICall,
    handleWorkflowError,
    TokenTracker
  };
}