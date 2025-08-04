# Brick Layer Testing

This directory contains comprehensive tests for the Pulse AI Brick Layer system.

## Test Types

### 1. Contract Tests (`contract.test.js`)

Contract tests run in **MOCK_MODE=true** for reliable CI execution without external API dependencies. They verify:

- ✅ Authentication (401 responses)
- ✅ Input validation (400 responses) 
- ✅ Rate limiting (429 responses)
- ✅ Success responses (200 responses)
- ✅ Response structure compliance
- ✅ Mock response data format

**Prerequisites:**
- n8n server running at `http://localhost:5678` (or custom `PULSE_BASE_URL`)
- `BRICK_AUTH_KEY` environment variable set (defaults to 'test' for contract tests)
- `MOCK_MODE=true` (automatically set by npm script)
- **Note: n8n must be running for tests to execute, otherwise they will be skipped gracefully**

The test suite automatically detects if n8n is available by checking the health endpoint. If n8n is not running:
- All tests are skipped with clear messaging
- Exit code is 0 (success) to avoid breaking CI pipelines
- Clear instructions are provided on how to start n8n

**Run with:**
```bash
npm run test:bricks
```

### 2. Smoke Tests (`../scripts/smoke-test-bricks.js`)

Smoke tests run with **MOCK_MODE=false** for real API integration testing. They test:

- 🔗 Real Gmail API integration
- 🔗 Real Google Calendar API integration  
- 🔗 Real Gemini API integration
- 🧹 Test data cleanup procedures

**Prerequisites:**
- n8n server running with real API credentials configured
- `MOCK_MODE=false` (automatically set by npm scripts)
- Valid Google OAuth2 credentials
- Valid Gemini API key
- Valid Twilio credentials (if SMS features tested)

**Run with:**
```bash
# Local testing
npm run smoke:local

# Staging environment testing
npm run smoke:staging

# Test specific brick only
npm run smoke:local -- --brick=create_email_draft

# Cleanup test data only
npm run smoke:local -- --cleanup-only
```

## Environment Setup

### For Contract Tests (CI/Development)

```bash
# Required
export BRICK_AUTH_KEY="test"  # defaults to 'test' for contract tests
export PULSE_BASE_URL="http://localhost:5678/webhook/webhook-brick"  # optional, this is the default
export MOCK_MODE="true"

# Start n8n for testing
docker-compose up -d

# Verify n8n is running
curl http://localhost:5678/healthz
```

### For Smoke Tests (Integration/Staging)

```bash
# Required - all production environment variables
export BRICK_AUTH_KEY="your-production-auth-key"
export PULSE_BASE_URL="http://localhost:5678/webhook/webhook-brick"  # or staging URL
export MOCK_MODE="false"

# Google APIs
export GOOGLE_CLIENT_ID="your-client-id"
export GOOGLE_CLIENT_SECRET="your-client-secret"
export GEMINI_API_KEY="your-gemini-key"

# Twilio (if testing SMS features)
export TWILIO_ACCOUNT_SID="your-account-sid"
export TWILIO_AUTH_TOKEN="your-auth-token"
export TWILIO_FROM_NUMBER="+1234567890"

# Start n8n with real credentials
docker-compose -f docker-compose.prod.yml up -d
```

## Test Structure

### Contract Test Structure

```javascript
describe('Brick Layer Contract Tests (Mock Mode)', () => {
  describe('Authentication Tests', () => {
    // Tests for 401 responses with missing/invalid auth
  });
  
  describe('Input Validation Tests', () => {
    // Tests for 400 responses with invalid input
  });
  
  describe('Mock Mode Success Tests', () => {
    // Tests for 200 responses with mock data
  });
  
  describe('Response Structure Compliance', () => {
    // Tests for consistent response format
  });
});
```

### Smoke Test Structure

```javascript
// Individual brick tests
async function testCreateEmailDraft() { /* ... */ }
async function testSummarizeEmails() { /* ... */ }
async function testCreateCalendarEvent() { /* ... */ }
async function testListTodaysEvents() { /* ... */ }

// Cleanup procedures
async function cleanupTestData() { /* ... */ }
```

## Expected Response Formats

### Success Response
```json
{
  "ok": true,
  "timestamp": "2024-01-01T12:00:00.000Z",
  "brick": "create_email_draft",
  "requestId": "req-123-456",
  "data": {
    "draftId": "draft-123"
  }
}
```

### Error Response
```json
{
  "ok": false,
  "timestamp": "2024-01-01T12:00:00.000Z", 
  "brick": "create_email_draft",
  "requestId": "req-123-456",
  "error": "Validation failed: missing required field 'to'",
  "code": "VALIDATION_ERROR"
}
```

## Troubleshooting

### Contract Tests Failing

1. **Tests being skipped (n8n not available):**
   ```bash
   # Start n8n
   docker-compose up -d
   
   # Verify n8n is running
   curl http://localhost:5678/healthz
   
   # Check webhook endpoints are accessible
   curl -X POST http://localhost:5678/webhook/webhook-brick/create_email_draft \
     -H "Content-Type: application/json" \
     -H "X-Pulse-Key: test" \
     -d '{}'
   ```

2. **Authentication errors:**
   ```bash
   # Check auth key is set
   echo $BRICK_AUTH_KEY
   
   # Verify it matches n8n configuration
   ```

3. **Mock mode not working:**
   ```bash
   # Verify environment variable
   echo $MOCK_MODE  # should be "true"
   ```

### Smoke Tests Failing

1. **API credential errors:**
   - Verify all Google OAuth2 credentials are valid
   - Check Gemini API key has sufficient quota
   - Ensure Twilio credentials are correct

2. **Rate limiting:**
   - Wait between test runs
   - Check API quotas haven't been exceeded
   - Use `--brick=specific_brick` to test individually

3. **Test data cleanup:**
   ```bash
   # Run cleanup only
   npm run smoke:local -- --cleanup-only
   ```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run Contract Tests
  run: |
    export BRICK_AUTH_KEY="test"
    export MOCK_MODE="true"
    docker-compose up -d
    # Wait for n8n to be ready
    sleep 10
    npm run test:bricks
  env:
    PULSE_BASE_URL: http://localhost:5678/webhook/webhook-brick
```

### Pre-deployment Smoke Tests

```yaml
- name: Run Smoke Tests
  run: npm run smoke:staging
  env:
    PULSE_BASE_URL: ${{ secrets.STAGING_URL }}/webhook/webhook-brick
    BRICK_AUTH_KEY: ${{ secrets.STAGING_BRICK_AUTH_KEY }}
    MOCK_MODE: "false"
```

## Test Data Management

### Contract Tests
- No real data created (mock mode)
- No cleanup required
- Safe for CI/CD pipelines

### Smoke Tests  
- Creates real Gmail drafts and Calendar events
- Automatic cleanup attempted after tests
- Manual cleanup may be required if tests fail
- Test data is clearly marked with timestamps

### Cleanup Procedures

The smoke test script includes cleanup for:
- Gmail drafts created during testing
- Calendar events created during testing
- Logs all cleanup actions for verification

**Note:** Cleanup requires the same API credentials used for creation.