# Pulse AI Assistant Brick Layer

## Overview

The Pulse AI Assistant Brick Layer provides a standardized, modular approach to building reusable workflow components called "bricks". Each brick is a self-contained n8n workflow that exposes a specific functionality through a standardized HTTP API endpoint.

## Brick Naming Conventions

- **Brick names**: Use lowercase snake_case format (e.g., `create_email_draft`, `summarize_emails`)
- **File names**: `{brick_name}.json` (e.g., `create_email_draft.json`)
- **Endpoint paths**: `/webhook-brick/{brick_name}` (e.g., `/webhook-brick/create_email_draft`)
- **Workflow names**: Match the brick name exactly for consistency

## Standardized Brick Structure

Every brick workflow must follow this standardized structure:

### 1. Webhook Trigger Node
- **Type**: Webhook trigger
- **Method**: POST only
- **Path**: `/webhook-brick/{brick_name}`
- **Content Type**: `application/json`

### 2. Required Sub-workflow Calls

All bricks must call these shared sub-workflows in order:

1. **brick_auth_guard**: Authentication and rate limiting
2. **brick_validate**: Input validation (if input required)
3. **brick_respond**: Response formatting and logging

### 3. Business Logic Nodes
- External API calls (Gmail, Calendar, Gemini, etc.)
- Data processing and transformation
- Error handling with try/catch patterns

### 4. Call Workflow Trigger (Optional)
- Add "Call Workflow" trigger for internal n8n workflow calls
- Enables brick composition and internal usage

## Input/Output Schema Format

### Input Schema
All brick inputs must be valid JSON objects. Define schemas using this format:

```json
{
  "type": "object",
  "properties": {
    "fieldName": {
      "type": "string|number|boolean|array|object",
      "description": "Field description",
      "format": "email|date-time|uri" // optional
    }
  },
  "required": ["requiredField1", "requiredField2"],
  "additionalProperties": false
}
```

### Output Schema
All brick outputs follow the standardized response envelope:

```json
{
  "ok": true|false,
  "data": {}, // Present on success
  "error": "Error message", // Present on failure
  "code": "ERROR_CODE", // Present on failure
  "brick": "brick_name",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "requestId": "unique-request-id"
}
```

## MOCK_MODE Behavior

All bricks must support MOCK_MODE for testing and development:

### Environment Variable
- **Variable**: `MOCK_MODE`
- **Values**: `true` or `false` (default: `false`)

### Implementation
- Check `MOCK_MODE` environment variable early in workflow
- When `MOCK_MODE=true`, return canned/mock responses
- Mock responses must follow the same schema as real responses
- Use realistic but obviously fake data (e.g., `mock-draft-123`)

### Mock Response Examples

```javascript
// create_email_draft mock response
{
  "ok": true,
  "data": {
    "draftId": "mock-draft-123"
  },
  "brick": "create_email_draft",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "requestId": "mock-req-456"
}

// summarize_emails mock response
{
  "ok": true,
  "data": {
    "summary": "Mock summary: 3 emails received about project updates and meeting requests.",
    "emailCount": 3,
    "timeRange": {
      "from": "2024-01-01T00:00:00.000Z",
      "to": "2024-01-01T23:59:59.000Z"
    }
  },
  "brick": "summarize_emails",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "requestId": "mock-req-789"
}
```

## Development Guidelines

### 1. Error Handling and Retry Logic
- Always wrap external API calls in try/catch blocks
- Use the `brick_respond` sub-workflow for all responses
- Never return raw HTML error pages
- Map external API errors to appropriate HTTP status codes
- Implement exponential backoff retry for external API failures

#### Retry Configuration
- **Gmail API calls**: Up to 5 retries with 2-second base delay
- **Google Calendar API calls**: Up to 5 retries with 2-second base delay  
- **Gemini API calls**: Up to 3 retries with rate-limiting awareness
- **Retryable errors**: Network timeouts, rate limiting (429), server errors (5xx)
- **Non-retryable errors**: Authentication failures (401, 403), bad requests (400)

### 2. Authentication
- All bricks must call `brick_auth_guard` first
- Use `X-Pulse-Key` header for authentication
- Implement rate limiting per API key

### 3. Input Validation
- Call `brick_validate` for all bricks that accept input
- Define clear validation schemas
- Return 400 status with detailed error messages for invalid input

### 4. Privacy and Logging
- Use `brick_respond` for privacy-compliant logging
- Mask email addresses as `***@***` in logs
- Never log sensitive data like API keys or passwords

### 5. Testing Approach
- Write contract tests that work in MOCK_MODE
- Create separate smoke tests for real API integration
- Test authentication, validation, and error scenarios
- Verify response schema compliance

## Brick Implementation Checklist

When creating a new brick, ensure:

- [ ] Follows snake_case naming convention
- [ ] Has webhook trigger with correct path
- [ ] Calls `brick_auth_guard` sub-workflow
- [ ] Calls `brick_validate` if input required
- [ ] Implements MOCK_MODE support
- [ ] Uses `brick_respond` for all responses
- [ ] Has proper error handling
- [ ] Includes "Call Workflow" trigger
- [ ] Documented input/output schemas
- [ ] Privacy-compliant logging

## Retry Utilities

The brick layer includes shared retry utilities in `brick-retry-utils.js`:

### Functions
- `retryGmailAPICall(operation, name, maxRetries)`: Gmail-specific retry wrapper
- `retryCalendarAPICall(operation, name, maxRetries)`: Calendar-specific retry wrapper  
- `retryGeminiAPICall(operation, name, maxRetries)`: Gemini-specific retry wrapper
- `isGmailErrorRetryable(error)`: Check if Gmail error is retryable
- `isCalendarErrorRetryable(error)`: Check if Calendar error is retryable
- `isGeminiErrorRetryable(error)`: Check if Gemini error is retryable

### Usage Example
```javascript
const { retryGmailAPICall } = require('./flows/bricks/brick-retry-utils.js');

const result = await retryGmailAPICall(
  async () => {
    // Your Gmail API call here
    return await gmailApiCall();
  },
  'Gmail Draft Creation',
  3 // maxRetries
);
```

## Available Bricks

### Core Email Bricks
- `create_email_draft`: Create Gmail draft emails (with retry logic)
- `summarize_emails`: Generate AI summaries of recent emails (with retry logic)

### Core Calendar Bricks
- `create_calendar_event`: Create Google Calendar events (with retry logic)
- `list_todays_events`: Retrieve today's calendar events (with retry logic)

## Environment Variables

Required environment variables for brick functionality:

```bash
# Authentication
BRICK_AUTH_KEY=your-secure-api-key-here

# Rate Limiting
BRICK_RATE_LIMIT_REQUESTS=100

# Testing
MOCK_MODE=false

# AI Integration
GEMINI_DEFAULT_MODEL=gemini-1.5-flash-latest

# Timezone and Calendar
GENERIC_TIMEZONE=UTC
GOOGLE_CALENDAR_ID=primary
```

## Testing

### Contract Tests (MOCK_MODE=true)
```bash
npm run test:bricks
```

### Smoke Tests (Real APIs)
```bash
npm run smoke:local
npm run smoke:staging
```

### Manual Testing with Postman
Import the collection at `docs/Postman_Pulse_Bricks.json` for manual testing.