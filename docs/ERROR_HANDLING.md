# Error Handling and Logging Documentation

## Overview

This document describes the comprehensive error handling and logging system implemented for the Pulse AI Secretary workflow. The system addresses requirements 5.1-5.5 by providing robust error handling, exponential backoff, database retry mechanisms, and secure logging.

## Architecture

### Core Components

1. **Error Handling Utilities** (`flows/error-handling-utils.js`)
   - Exponential backoff calculations
   - Data sanitization for logging
   - Retry mechanisms with circuit breaker pattern
   - Token usage tracking for Gemini API

2. **Logging Configuration** (`flows/logging-config.js`)
   - Secure logging with sensitive data filtering
   - Structured JSON logging format
   - Component-specific loggers
   - Workflow execution tracking

3. **Database Retry Utilities** (`flows/database-retry-utils.js`)
   - PostgreSQL connection retry logic
   - n8n workflow static data operations with retry
   - Circuit breaker pattern for database operations

## Error Handling Strategies

### 1. Try-Catch Blocks (Requirement 5.1)

Every workflow node implements comprehensive try-catch blocks:

```javascript
try {
  // Main operation logic
  const result = await performOperation();
  logWithContext('info', nodeName, 'Operation completed successfully', result);
  return { json: { ...result, error: false } };
} catch (error) {
  const errorResponse = handleWorkflowError(error, nodeName, context);
  return { json: { ...errorResponse, fallbackData: generateFallback() } };
}
```

**Features:**
- Detailed error logging with context
- Graceful fallback responses
- Error propagation control
- Sanitized error data

### 2. API Rate Limiting and Exponential Backoff (Requirement 5.2, 5.3)

#### Gemini API Error Handling

```javascript
const response = await handleGeminiAPICall(async () => {
  // API call with timeout and retry logic
  return fetch(apiUrl, requestOptions);
});
```

**Rate Limiting Features:**
- Exponential backoff with jitter
- Token usage tracking (1M tokens/day limit)
- HTTP 429 (rate limit) detection
- HTTP 403 (quota exceeded) handling
- Automatic retry with increasing delays

#### Backoff Calculation

```javascript
function calculateExponentialBackoff(attempt, baseDelay = 1000, maxDelay = 30000) {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  const jitter = Math.random() * 0.1 * delay; // 10% jitter
  return Math.floor(delay + jitter);
}
```

### 3. Database Connection Retry (Requirement 5.4)

#### Retryable Error Detection

```javascript
const RETRYABLE_ERROR_CODES = [
  'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET',
  'EPIPE', 'ECONNABORTED', 'ENETUNREACH', 'ENETDOWN'
];

const RETRYABLE_ERROR_MESSAGES = [
  'connection terminated', 'server closed the connection',
  'connection lost', 'connection timeout', 'database is not available'
];
```

#### Circuit Breaker Pattern

```javascript
class DatabaseRetryHandler {
  constructor() {
    this.circuitBreaker = {
      failures: 0,
      lastFailureTime: null,
      state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
      threshold: 5,
      timeout: 60000 // 1 minute
    };
  }
}
```

**Circuit Breaker States:**
- **CLOSED**: Normal operation, requests allowed
- **OPEN**: Too many failures, requests blocked
- **HALF_OPEN**: Testing if service recovered

### 4. Sensitive Data Protection (Requirement 5.5)

#### Data Sanitization Patterns

```javascript
const SENSITIVE_PATTERNS = [
  /api[_-]?key[s]?[\s]*[:=][\s]*['"']?([a-zA-Z0-9_-]{20,})['"']?/gi,
  /token[s]?[\s]*[:=][\s]*['"']?([a-zA-Z0-9_.-]{20,})['"']?/gi,
  /password[s]?[\s]*[:=][\s]*['"']?([^'"'\s]{6,})['"']?/gi,
  /phone[\s]*[:=][\s]*['"']?(\+?[\d\s\-\(\)]{10,})['"']?/gi
];
```

#### Field-Level Protection

```javascript
const SENSITIVE_FIELDS = [
  'password', 'token', 'apiKey', 'secret', 'credential',
  'authorization', 'x-goog-api-key', 'auth_token'
];
```

## Workflow Node Error Handling

### 1. Gmail Trigger Node

**Error Scenarios:**
- OAuth token expiration
- Gmail API rate limiting
- Network connectivity issues

**Handling:**
- Automatic token refresh
- Exponential backoff for rate limits
- Graceful degradation with logging

### 2. Email Processing Node

**Error Scenarios:**
- Invalid email structure
- HTML parsing failures
- Attachment processing errors

**Handling:**
```javascript
try {
  emailBody = emailData.textPlain || htmlToText(emailData.textHtml) || emailData.snippet || '';
} catch (error) {
  logWithContext('warn', nodeName, 'Error processing email body', { error: error.message });
  emailBody = 'Unable to process email content';
}
```

### 3. Gemini API Node

**Error Scenarios:**
- API quota exceeded
- Rate limiting (HTTP 429)
- Invalid API key (HTTP 403)
- Network timeouts
- Token limit exceeded

**Handling:**
```javascript
const response = await handleGeminiAPICall(async () => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  
  try {
    return await fetch(apiUrl, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
});
```

### 4. Gmail Draft Creation Node

**Error Scenarios:**
- OAuth token issues
- Gmail API errors
- Invalid message structure

**Handling:**
- Retry with fresh token
- Fallback draft creation
- Error logging with context

### 5. SMS Notification Node

**Error Scenarios:**
- Twilio API errors
- Invalid phone numbers
- Rate limiting
- Network failures

**Handling:**
```javascript
// Rate limiting check
if (dailyCount >= dailyLimit) {
  logWithContext('warn', nodeName, 'Daily SMS limit reached');
  return { json: { shouldSend: false, reason: 'Daily limit reached' } };
}

// SMS sending with retry
await retryWithBackoff(async () => {
  return twilioClient.messages.create(messageOptions);
}, 2, 'SMS sending');
```

## Logging System

### 1. Structured Logging Format

```json
{
  "timestamp": "2025-01-26T12:00:00.000Z",
  "level": "INFO",
  "component": "GeminiAPI",
  "message": "API call completed successfully",
  "data": {
    "responseTime": 1250,
    "tokenUsage": 45,
    "messageId": "msg_123"
  }
}
```

### 2. Log Levels

- **ERROR**: System failures, API errors, critical issues
- **WARN**: Rate limits, retries, degraded performance
- **INFO**: Normal operations, successful completions
- **DEBUG**: Detailed execution flow, debugging information

### 3. Component-Specific Loggers

```javascript
const emailLogger = createLogger('EmailProcessor');
const apiLogger = createLogger('GeminiAPI');
const smsLogger = createLogger('SMSHandler');
const dbLogger = createLogger('DatabaseRetry');
```

### 4. Sensitive Data Filtering

All logs automatically filter:
- API keys and tokens
- Passwords and secrets
- Phone numbers and email addresses
- OAuth tokens and credentials

## Monitoring and Alerting

### 1. Health Check Integration

The error handling system integrates with the health check endpoint (`/healthz`):

```javascript
// Health check includes error rates and circuit breaker states
{
  "status": "healthy",
  "services": {
    "gemini_api": { "status": "up", "error_rate": 0.02 },
    "database": { "circuit_breaker": "CLOSED" }
  }
}
```

### 2. Metrics Collection

Key metrics tracked:
- API response times
- Error rates by component
- Retry attempt counts
- Circuit breaker state changes
- Token usage rates

### 3. Alert Conditions

Automatic alerts for:
- Circuit breaker opens
- Error rate exceeds 5%
- API quota approaching limits
- Database connection failures

## Configuration

### Environment Variables

```bash
# Logging configuration
LOG_LEVEL=INFO                    # ERROR, WARN, INFO, DEBUG
ENABLE_DEBUG_LOGGING=false        # Enable detailed debug logs

# Retry configuration
MAX_RETRIES=3                     # Maximum retry attempts
BASE_RETRY_DELAY=1000            # Base delay in milliseconds
MAX_RETRY_DELAY=30000            # Maximum delay in milliseconds

# Circuit breaker configuration
CIRCUIT_BREAKER_THRESHOLD=5       # Failures before opening
CIRCUIT_BREAKER_TIMEOUT=60000     # Timeout in milliseconds

# Rate limiting
GEMINI_DAILY_TOKEN_LIMIT=1000000  # Daily token limit
SMS_DAILY_LIMIT=50               # Daily SMS limit
SMS_PER_RUN_LIMIT=3              # SMS per workflow run
```

### Workflow Settings

```json
{
  "settings": {
    "executionOrder": "v1",
    "saveManualExecutions": true,
    "callerPolicy": "workflowsFromSameOwner",
    "errorWorkflow": "",
    "timezone": "America/New_York"
  }
}
```

## Testing Error Scenarios

### 1. API Failure Simulation

```javascript
// Test Gemini API failures
process.env.GEMINI_API_KEY = 'invalid_key';  // Test 403 errors
// Block network access to test timeouts
// Set low rate limits to test 429 errors
```

### 2. Database Failure Simulation

```javascript
// Test database connection failures
// Stop PostgreSQL container
// Simulate network partitions
// Test circuit breaker behavior
```

### 3. SMS Failure Testing

```javascript
// Test invalid phone numbers
// Test Twilio API failures
// Test rate limiting behavior
// Test daily limit enforcement
```

## Best Practices

### 1. Error Handling

- Always use try-catch blocks in workflow nodes
- Provide meaningful fallback responses
- Log errors with sufficient context
- Sanitize sensitive data before logging

### 2. Retry Logic

- Use exponential backoff with jitter
- Implement maximum retry limits
- Distinguish between retryable and non-retryable errors
- Use circuit breakers for external services

### 3. Logging

- Use structured JSON logging
- Include correlation IDs for tracing
- Filter sensitive information
- Use appropriate log levels

### 4. Monitoring

- Monitor error rates and response times
- Set up alerts for critical failures
- Track resource usage and limits
- Monitor circuit breaker states

## Troubleshooting Guide

### Common Issues

1. **High Error Rates**
   - Check API quotas and rate limits
   - Verify network connectivity
   - Review circuit breaker states

2. **Database Connection Issues**
   - Check PostgreSQL container status
   - Verify connection parameters
   - Review retry attempt logs

3. **SMS Delivery Failures**
   - Verify Twilio credentials
   - Check phone number format
   - Review rate limiting logs

4. **Token Limit Exceeded**
   - Monitor daily token usage
   - Implement token usage alerts
   - Consider request optimization

### Log Analysis

```bash
# Filter error logs
grep '"level":"ERROR"' /var/log/n8n/workflow.log

# Monitor API response times
grep '"component":"GeminiAPI"' /var/log/n8n/workflow.log | jq '.data.responseTime'

# Check circuit breaker events
grep '"circuit_breaker"' /var/log/n8n/workflow.log

# Monitor retry attempts
grep '"RetryHandler"' /var/log/n8n/workflow.log
```

This comprehensive error handling system ensures the Pulse AI Secretary workflow operates reliably even under adverse conditions, providing detailed logging for troubleshooting and maintaining user privacy through data sanitization.