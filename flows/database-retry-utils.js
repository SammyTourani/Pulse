/**
 * Database Connection Retry Utilities for n8n Workflows
 * Provides robust database connection handling with exponential backoff
 * Requirements: 5.3, 5.4
 */

const { createLogger } = require('./logging-config.js');
const logger = createLogger('DatabaseRetry');

/**
 * Database connection retry configuration
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  jitterFactor: 0.1
};

/**
 * Database error types that should trigger a retry
 */
const RETRYABLE_ERROR_CODES = [
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'ECONNRESET',
  'EPIPE',
  'ECONNABORTED',
  'ENETUNREACH',
  'ENETDOWN'
];

const RETRYABLE_ERROR_MESSAGES = [
  'connection terminated',
  'server closed the connection',
  'connection lost',
  'connection timeout',
  'database is not available',
  'too many connections',
  'connection refused',
  'network is unreachable'
];

/**
 * Calculate exponential backoff delay with jitter
 * @param {number} attempt - Current attempt number (0-based)
 * @param {object} config - Retry configuration
 * @returns {number} Delay in milliseconds
 */
function calculateBackoffDelay(attempt, config = RETRY_CONFIG) {
  const exponentialDelay = Math.min(
    config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
    config.maxDelay
  );
  
  // Add jitter to prevent thundering herd problem
  const jitter = exponentialDelay * config.jitterFactor * Math.random();
  
  return Math.floor(exponentialDelay + jitter);
}

/**
 * Check if an error is retryable
 * @param {Error} error - Error to check
 * @returns {boolean} True if error should trigger a retry
 */
function isRetryableError(error) {
  if (!error) return false;
  
  const errorCode = error.code || '';
  const errorMessage = (error.message || '').toLowerCase();
  
  // Check error codes
  if (RETRYABLE_ERROR_CODES.includes(errorCode)) {
    return true;
  }
  
  // Check error messages
  return RETRYABLE_ERROR_MESSAGES.some(msg => 
    errorMessage.includes(msg.toLowerCase())
  );
}

/**
 * Enhanced retry mechanism with circuit breaker pattern
 */
class DatabaseRetryHandler {
  constructor(config = RETRY_CONFIG) {
    this.config = config;
    this.circuitBreaker = {
      failures: 0,
      lastFailureTime: null,
      state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
      threshold: 5,
      timeout: 60000 // 1 minute
    };
  }

  /**
   * Check circuit breaker state
   * @returns {boolean} True if circuit is open (should not retry)
   */
  isCircuitOpen() {
    if (this.circuitBreaker.state === 'OPEN') {
      const timeSinceLastFailure = Date.now() - this.circuitBreaker.lastFailureTime;
      if (timeSinceLastFailure > this.circuitBreaker.timeout) {
        this.circuitBreaker.state = 'HALF_OPEN';
        logger.info('Circuit breaker transitioning to HALF_OPEN state');
        return false;
      }
      return true;
    }
    return false;
  }

  /**
   * Record operation success
   */
  recordSuccess() {
    if (this.circuitBreaker.state === 'HALF_OPEN') {
      this.circuitBreaker.state = 'CLOSED';
      this.circuitBreaker.failures = 0;
      logger.info('Circuit breaker reset to CLOSED state');
    }
  }

  /**
   * Record operation failure
   */
  recordFailure() {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();
    
    if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
      this.circuitBreaker.state = 'OPEN';
      logger.warn('Circuit breaker opened due to repeated failures', {
        failures: this.circuitBreaker.failures,
        threshold: this.circuitBreaker.threshold
      });
    }
  }

  /**
   * Execute database operation with retry logic
   * @param {Function} operation - Async database operation
   * @param {string} operationName - Name for logging
   * @param {object} context - Additional context for logging
   * @returns {Promise<any>} Operation result
   */
  async executeWithRetry(operation, operationName = 'database operation', context = {}) {
    // Check circuit breaker
    if (this.isCircuitOpen()) {
      const error = new Error('Circuit breaker is OPEN - database operations suspended');
      logger.error('Database operation blocked by circuit breaker', {
        operationName,
        context,
        circuitState: this.circuitBreaker.state
      });
      throw error;
    }

    let lastError;
    const startTime = Date.now();

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        logger.debug('Attempting database operation', {
          operationName,
          attempt: attempt + 1,
          maxRetries: this.config.maxRetries + 1,
          context
        });

        const result = await operation();
        
        // Record success for circuit breaker
        this.recordSuccess();
        
        if (attempt > 0) {
          logger.info('Database operation succeeded after retries', {
            operationName,
            attempt: attempt + 1,
            totalTime: Date.now() - startTime,
            context
          });
        }
        
        return result;
        
      } catch (error) {
        lastError = error;
        
        // Check if this is the last attempt
        if (attempt === this.config.maxRetries) {
          this.recordFailure();
          logger.error('Database operation failed after all retries', {
            operationName,
            attempts: attempt + 1,
            totalTime: Date.now() - startTime,
            error: error.message,
            errorCode: error.code,
            context
          });
          throw error;
        }

        // Check if error is retryable
        if (!isRetryableError(error)) {
          this.recordFailure();
          logger.error('Database operation failed with non-retryable error', {
            operationName,
            attempt: attempt + 1,
            error: error.message,
            errorCode: error.code,
            context
          });
          throw error;
        }

        // Calculate delay for next attempt
        const delay = calculateBackoffDelay(attempt, this.config);
        
        logger.warn('Database operation failed, retrying', {
          operationName,
          attempt: attempt + 1,
          maxRetries: this.config.maxRetries + 1,
          error: error.message,
          errorCode: error.code,
          nextRetryIn: delay,
          context
        });

        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // This should never be reached, but just in case
    this.recordFailure();
    throw lastError;
  }
}

/**
 * Global retry handler instance
 */
const globalRetryHandler = new DatabaseRetryHandler();

/**
 * Convenience function for n8n workflow usage
 * @param {Function} operation - Database operation to retry
 * @param {string} operationName - Operation name for logging
 * @param {object} context - Additional context
 * @returns {Promise<any>} Operation result
 */
async function retryDatabaseOperation(operation, operationName = 'database operation', context = {}) {
  return globalRetryHandler.executeWithRetry(operation, operationName, context);
}

/**
 * PostgreSQL specific retry wrapper
 * @param {Function} pgOperation - PostgreSQL operation
 * @param {string} operationName - Operation name
 * @param {object} context - Context data
 * @returns {Promise<any>} Operation result
 */
async function retryPostgreSQLOperation(pgOperation, operationName = 'PostgreSQL operation', context = {}) {
  return retryDatabaseOperation(async () => {
    try {
      return await pgOperation();
    } catch (error) {
      // Add PostgreSQL specific error handling
      if (error.code === '53300') { // too_many_connections
        logger.warn('PostgreSQL connection limit reached', {
          operationName,
          context
        });
        throw new Error('PostgreSQL connection limit reached');
      }
      
      if (error.code === '08006') { // connection_failure
        logger.warn('PostgreSQL connection failure', {
          operationName,
          context
        });
        throw new Error('PostgreSQL connection failure');
      }
      
      throw error;
    }
  }, operationName, context);
}

/**
 * n8n workflow static data operations with retry
 */
class WorkflowDataRetryHandler {
  constructor(workflow) {
    this.workflow = workflow;
    this.retryHandler = new DatabaseRetryHandler();
  }

  /**
   * Get workflow static data with retry
   * @param {string} key - Data key
   * @param {string} scope - Data scope ('global' or 'node')
   * @returns {Promise<any>} Data value
   */
  async getStaticData(key, scope = 'global') {
    return this.retryHandler.executeWithRetry(
      async () => {
        const data = this.workflow.getStaticData(scope);
        return data[key];
      },
      `get workflow static data: ${key}`,
      { key, scope }
    );
  }

  /**
   * Set workflow static data with retry
   * @param {string} key - Data key
   * @param {any} value - Data value
   * @param {string} scope - Data scope ('global' or 'node')
   * @returns {Promise<void>}
   */
  async setStaticData(key, value, scope = 'global') {
    return this.retryHandler.executeWithRetry(
      async () => {
        const data = this.workflow.getStaticData(scope);
        data[key] = value;
        return true;
      },
      `set workflow static data: ${key}`,
      { key, scope, valueType: typeof value }
    );
  }

  /**
   * Update workflow static data atomically with retry
   * @param {string} key - Data key
   * @param {Function} updateFn - Update function
   * @param {string} scope - Data scope
   * @returns {Promise<any>} Updated value
   */
  async updateStaticData(key, updateFn, scope = 'global') {
    return this.retryHandler.executeWithRetry(
      async () => {
        const data = this.workflow.getStaticData(scope);
        const currentValue = data[key];
        const newValue = updateFn(currentValue);
        data[key] = newValue;
        return newValue;
      },
      `update workflow static data: ${key}`,
      { key, scope }
    );
  }
}

// Export for use in n8n workflows
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DatabaseRetryHandler,
    WorkflowDataRetryHandler,
    retryDatabaseOperation,
    retryPostgreSQLOperation,
    isRetryableError,
    calculateBackoffDelay,
    RETRY_CONFIG
  };
}

// Make available globally for n8n workflows
if (typeof global !== 'undefined') {
  global.retryDatabaseOperation = retryDatabaseOperation;
  global.retryPostgreSQLOperation = retryPostgreSQLOperation;
  global.WorkflowDataRetryHandler = WorkflowDataRetryHandler;
}