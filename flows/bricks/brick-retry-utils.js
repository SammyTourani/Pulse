/**
 * Brick-specific retry utilities for external API calls
 * Extends the existing error-handling-utils.js patterns for brick workflows
 * Requirements: 8.1, 8.2
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
 * Gmail API specific retry wrapper with exponential backoff
 * @param {Function} gmailOperation - Gmail API operation function
 * @param {string} operationName - Name for logging
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @returns {Promise<any>} API response
 */
async function retryGmailAPICall(gmailOperation, operationName = 'Gmail API call', maxRetries = 3) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[INFO] BrickRetry: Attempting ${operationName}`, { 
        attempt, 
        maxRetries,
        timestamp: new Date().toISOString()
      });
      
      const result = await gmailOperation();
      
      if (attempt > 0) {
        console.log(`[INFO] BrickRetry: ${operationName} succeeded after ${attempt} retries`);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      // Check if error is retryable
      const isRetryable = isGmailErrorRetryable(error);
      
      if (!isRetryable || attempt === maxRetries) {
        console.log(`[ERROR] BrickRetry: ${operationName} failed after ${attempt} attempts`, {
          error: error.message,
          retryable: isRetryable,
          finalAttempt: attempt === maxRetries
        });
        throw error;
      }

      const delay = calculateExponentialBackoff(attempt);
      console.log(`[WARN] BrickRetry: ${operationName} failed, retrying in ${delay}ms`, {
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
 * Google Calendar API specific retry wrapper with exponential backoff
 * @param {Function} calendarOperation - Calendar API operation function
 * @param {string} operationName - Name for logging
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @returns {Promise<any>} API response
 */
async function retryCalendarAPICall(calendarOperation, operationName = 'Calendar API call', maxRetries = 3) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[INFO] BrickRetry: Attempting ${operationName}`, { 
        attempt, 
        maxRetries,
        timestamp: new Date().toISOString()
      });
      
      const result = await calendarOperation();
      
      if (attempt > 0) {
        console.log(`[INFO] BrickRetry: ${operationName} succeeded after ${attempt} retries`);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      // Check if error is retryable
      const isRetryable = isCalendarErrorRetryable(error);
      
      if (!isRetryable || attempt === maxRetries) {
        console.log(`[ERROR] BrickRetry: ${operationName} failed after ${attempt} attempts`, {
          error: error.message,
          retryable: isRetryable,
          finalAttempt: attempt === maxRetries
        });
        throw error;
      }

      const delay = calculateExponentialBackoff(attempt);
      console.log(`[WARN] BrickRetry: ${operationName} failed, retrying in ${delay}ms`, {
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
 * Gemini API specific retry wrapper with rate limiting consideration
 * @param {Function} geminiOperation - Gemini API operation function
 * @param {string} operationName - Name for logging
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @returns {Promise<any>} API response
 */
async function retryGeminiAPICall(geminiOperation, operationName = 'Gemini API call', maxRetries = 3) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[INFO] BrickRetry: Attempting ${operationName}`, { 
        attempt, 
        maxRetries,
        timestamp: new Date().toISOString()
      });
      
      const result = await geminiOperation();
      
      // Check for rate limiting in response
      if (result && result.status === 429) {
        const retryAfter = result.headers?.get?.('retry-after');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : calculateExponentialBackoff(attempt, 2000, 60000);
        
        console.log(`[WARN] BrickRetry: Gemini API rate limit hit, backing off`, { 
          retryAfter: delay,
          attempt,
          maxRetries
        });
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay));
          throw new Error('Rate limited - retry needed');
        }
      }

      if (result && result.status === 403) {
        console.log(`[ERROR] BrickRetry: Gemini API quota exceeded or invalid key`);
        throw new Error('Gemini API quota exceeded or invalid API key');
      }

      if (result && !result.ok && result.status) {
        throw new Error(`Gemini API error: ${result.status} ${result.statusText}`);
      }
      
      if (attempt > 0) {
        console.log(`[INFO] BrickRetry: ${operationName} succeeded after ${attempt} retries`);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      // Check if error is retryable
      const isRetryable = isGeminiErrorRetryable(error);
      
      if (!isRetryable || attempt === maxRetries) {
        console.log(`[ERROR] BrickRetry: ${operationName} failed after ${attempt} attempts`, {
          error: error.message,
          retryable: isRetryable,
          finalAttempt: attempt === maxRetries
        });
        throw error;
      }

      // Special handling for rate limiting
      let delay;
      if (error.message.includes('Rate limited') || error.message.includes('429')) {
        delay = calculateExponentialBackoff(attempt, 2000, 60000); // Longer delays for rate limiting
      } else {
        delay = calculateExponentialBackoff(attempt);
      }
      
      console.log(`[WARN] BrickRetry: ${operationName} failed, retrying in ${delay}ms`, {
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
 * Check if Gmail API error is retryable
 * @param {Error} error - Error object
 * @returns {boolean} Whether the error is retryable
 */
function isGmailErrorRetryable(error) {
  if (!error) return false;
  
  // Network errors are retryable
  const retryableNetworkErrors = [
    'ECONNRESET',
    'ENOTFOUND', 
    'ETIMEDOUT',
    'ECONNREFUSED',
    'EPIPE',
    'EHOSTUNREACH'
  ];
  
  if (error.code && retryableNetworkErrors.includes(error.code)) {
    return true;
  }
  
  // HTTP status codes that are retryable
  const retryableStatusCodes = [429, 500, 502, 503, 504];
  if (error.status && retryableStatusCodes.includes(error.status)) {
    return true;
  }
  
  // Check error message for retryable conditions
  const errorMessage = error.message?.toLowerCase() || '';
  const retryableMessages = [
    'rate limit',
    'timeout',
    'connection reset',
    'server error',
    'service unavailable',
    'bad gateway',
    'gateway timeout'
  ];
  
  return retryableMessages.some(msg => errorMessage.includes(msg));
}

/**
 * Check if Google Calendar API error is retryable
 * @param {Error} error - Error object
 * @returns {boolean} Whether the error is retryable
 */
function isCalendarErrorRetryable(error) {
  if (!error) return false;
  
  // Network errors are retryable
  const retryableNetworkErrors = [
    'ECONNRESET',
    'ENOTFOUND',
    'ETIMEDOUT', 
    'ECONNREFUSED',
    'EPIPE',
    'EHOSTUNREACH'
  ];
  
  if (error.code && retryableNetworkErrors.includes(error.code)) {
    return true;
  }
  
  // HTTP status codes that are retryable
  const retryableStatusCodes = [429, 500, 502, 503, 504];
  if (error.status && retryableStatusCodes.includes(error.status)) {
    return true;
  }
  
  // Check error message for retryable conditions
  const errorMessage = error.message?.toLowerCase() || '';
  const retryableMessages = [
    'rate limit',
    'timeout',
    'connection reset',
    'server error',
    'service unavailable',
    'bad gateway',
    'gateway timeout'
  ];
  
  return retryableMessages.some(msg => errorMessage.includes(msg));
}

/**
 * Check if Gemini API error is retryable
 * @param {Error} error - Error object
 * @returns {boolean} Whether the error is retryable
 */
function isGeminiErrorRetryable(error) {
  if (!error) return false;
  
  // Network errors are retryable
  const retryableNetworkErrors = [
    'ECONNRESET',
    'ENOTFOUND',
    'ETIMEDOUT',
    'ECONNREFUSED', 
    'EPIPE',
    'EHOSTUNREACH'
  ];
  
  if (error.code && retryableNetworkErrors.includes(error.code)) {
    return true;
  }
  
  // HTTP status codes that are retryable
  const retryableStatusCodes = [429, 500, 502, 503, 504];
  if (error.status && retryableStatusCodes.includes(error.status)) {
    return true;
  }
  
  // Check error message for retryable conditions
  const errorMessage = error.message?.toLowerCase() || '';
  const retryableMessages = [
    'rate limit',
    'rate limited',
    'timeout',
    'connection reset',
    'server error',
    'service unavailable',
    'bad gateway',
    'gateway timeout',
    'quota exceeded'
  ];
  
  return retryableMessages.some(msg => errorMessage.includes(msg));
}

/**
 * Generic retry wrapper for any async operation
 * @param {Function} operation - Async operation to retry
 * @param {string} operationName - Name for logging
 * @param {Function} isRetryable - Function to check if error is retryable
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @returns {Promise<any>} Operation result
 */
async function retryOperation(operation, operationName, isRetryable, maxRetries = 3) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[INFO] BrickRetry: Attempting ${operationName}`, { 
        attempt, 
        maxRetries,
        timestamp: new Date().toISOString()
      });
      
      const result = await operation();
      
      if (attempt > 0) {
        console.log(`[INFO] BrickRetry: ${operationName} succeeded after ${attempt} retries`);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      // Check if error is retryable
      const shouldRetry = isRetryable ? isRetryable(error) : true;
      
      if (!shouldRetry || attempt === maxRetries) {
        console.log(`[ERROR] BrickRetry: ${operationName} failed after ${attempt} attempts`, {
          error: error.message,
          retryable: shouldRetry,
          finalAttempt: attempt === maxRetries
        });
        throw error;
      }

      const delay = calculateExponentialBackoff(attempt);
      console.log(`[WARN] BrickRetry: ${operationName} failed, retrying in ${delay}ms`, {
        attempt,
        error: error.message,
        nextRetryIn: delay
      });

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// Export utilities for use in n8n workflow nodes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calculateExponentialBackoff,
    retryGmailAPICall,
    retryCalendarAPICall,
    retryGeminiAPICall,
    retryOperation,
    isGmailErrorRetryable,
    isCalendarErrorRetryable,
    isGeminiErrorRetryable
  };
}