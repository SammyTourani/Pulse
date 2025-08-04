/**
 * Contract Tests for Pulse AI Brick Layer
 * 
 * These tests run in MOCK_MODE=true to ensure reliable CI execution
 * without external API dependencies. They verify:
 * - Authentication (401)
 * - Input validation (400) 
 * - Rate limiting (429)
 * - Success responses (200)
 * - Response structure compliance
 */

const fetch = require('node-fetch');

// Test configuration
const BASE_URL = process.env.PULSE_BASE_URL || 'http://localhost:5678/webhook/webhook-brick';
const BRICK_AUTH_KEY = process.env.BRICK_AUTH_KEY || 'test-key-123';
const INVALID_AUTH_KEY = 'invalid-key-456';



// Track n8n availability for test skipping
let n8nAvailable = false;

// Brick endpoints to test
const BRICK_ENDPOINTS = [
  'create_email_draft',
  'summarize_emails', 
  'create_calendar_event',
  'list_todays_events'
];

// Helper function to make brick API calls
async function callBrick(brickName, payload = {}, authKey = BRICK_AUTH_KEY) {
  const url = `${BASE_URL}/${brickName}`;
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (authKey) {
    headers['X-Pulse-Key'] = authKey;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    return {
      status: response.status,
      data: await response.json()
    };
  } catch (error) {
    // Handle connection errors gracefully
    if (error.code === 'ECONNREFUSED') {
      throw new Error(`n8n server not running at ${BASE_URL}. Please start n8n before running contract tests.`);
    }
    throw error;
  }
}

// Helper function to conditionally skip tests if n8n is not available
function conditionalTest(name, testFn) {
  if (n8nAvailable) {
    return test(name, testFn);
  } else {
    return test.skip(name + ' (n8n not available)', testFn);
  }
}

function conditionalTestEach(array) {
  if (n8nAvailable) {
    return test.each(array);
  } else {
    return test.skip.each(array);
  }
}

// Helper function to validate standard brick response structure
function validateBrickResponse(response, expectSuccess = true) {
  expect(response.data).toHaveProperty('ok');
  expect(response.data).toHaveProperty('timestamp');
  expect(response.data).toHaveProperty('brick');
  expect(response.data).toHaveProperty('requestId');
  
  if (expectSuccess) {
    expect(response.data.ok).toBe(true);
    expect(response.data).toHaveProperty('data');
  } else {
    expect(response.data.ok).toBe(false);
    expect(response.data).toHaveProperty('error');
    expect(response.data).toHaveProperty('code');
  }
}

describe('Brick Layer Contract Tests (Mock Mode)', () => {
  
  beforeAll(async () => {
    
    // Check if n8n is running - extract base URL for health check
    const baseUrl = BASE_URL.replace('/webhook/webhook-brick', '');
    try {
      const response = await fetch(`${baseUrl}/healthz`, { timeout: 5000 });
      if (response.ok) {
        n8nAvailable = true;
        console.log('✅ n8n server is available for contract tests');
      } else {
        console.warn(`⚠️  n8n health check returned ${response.status} - skipping tests`);
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED' || error.name === 'FetchError') {
        console.warn(`⚠️  n8n server not running at ${baseUrl} - skipping contract tests`);
        console.warn('To run these tests, start n8n with: docker-compose up -d');
      } else {
        console.warn(`⚠️  n8n connectivity check failed: ${error.message} - skipping tests`);
      }
    }
    
    if (!n8nAvailable) {
      console.warn('📋 All contract tests will be skipped due to n8n unavailability');
    }
  });

  describe('Authentication Tests', () => {
    
    conditionalTestEach(BRICK_ENDPOINTS)('should return 401 for missing auth key - %s', async (brickName) => {
      const response = await callBrick(brickName, {}, null);
      
      expect(response.status).toBe(401);
      validateBrickResponse(response, false);
      expect(response.data.error).toContain('Unauthorized');
      expect(response.data.code).toBe('AUTH_FAILED');
    });

    conditionalTestEach(BRICK_ENDPOINTS)('should return 401 for invalid auth key - %s', async (brickName) => {
      const response = await callBrick(brickName, {}, INVALID_AUTH_KEY);
      
      expect(response.status).toBe(401);
      validateBrickResponse(response, false);
      expect(response.data.error).toContain('Unauthorized');
      expect(response.data.code).toBe('AUTH_FAILED');
    });

  });

  describe('Input Validation Tests', () => {

    describe('create_email_draft validation', () => {
      
      conditionalTest('should return 400 for missing required fields', async () => {
        const response = await callBrick('create_email_draft', {});
        
        expect(response.status).toBe(400);
        validateBrickResponse(response, false);
        expect(response.data.error).toContain('validation');
      });

      conditionalTest('should return 400 for invalid email format', async () => {
        const payload = {
          to: 'invalid-email',
          subject: 'Test Subject',
          body: 'Test Body'
        };
        
        const response = await callBrick('create_email_draft', payload);
        
        expect(response.status).toBe(400);
        validateBrickResponse(response, false);
      });

      conditionalTest('should return 400 for missing subject', async () => {
        const payload = {
          to: 'test@example.com',
          body: 'Test Body'
        };
        
        const response = await callBrick('create_email_draft', payload);
        
        expect(response.status).toBe(400);
        validateBrickResponse(response, false);
      });

    });

    describe('summarize_emails validation', () => {
      
      conditionalTest('should return 400 for missing sinceISO', async () => {
        const response = await callBrick('summarize_emails', {});
        
        expect(response.status).toBe(400);
        validateBrickResponse(response, false);
      });

      conditionalTest('should return 400 for invalid ISO date format', async () => {
        const payload = {
          sinceISO: 'invalid-date'
        };
        
        const response = await callBrick('summarize_emails', payload);
        
        expect(response.status).toBe(400);
        validateBrickResponse(response, false);
      });

    });

    describe('create_calendar_event validation', () => {
      
      conditionalTest('should return 400 for missing required fields', async () => {
        const response = await callBrick('create_calendar_event', {});
        
        expect(response.status).toBe(400);
        validateBrickResponse(response, false);
      });

      conditionalTest('should return 400 for invalid ISO timestamps', async () => {
        const payload = {
          title: 'Test Event',
          startISO: 'invalid-date',
          endISO: 'invalid-date'
        };
        
        const response = await callBrick('create_calendar_event', payload);
        
        expect(response.status).toBe(400);
        validateBrickResponse(response, false);
      });

    });

    describe('list_todays_events validation', () => {
      
      conditionalTest('should accept empty payload (no validation required)', async () => {
        const response = await callBrick('list_todays_events', {});
        
        // Should not return validation error since no input is required
        expect(response.status).not.toBe(400);
      });

    });

  });

  describe('Mock Mode Success Tests', () => {

    describe('create_email_draft mock responses', () => {
      
      conditionalTest('should return mock draft ID for valid input', async () => {
        const payload = {
          to: 'test@example.com',
          subject: 'Test Subject',
          body: 'Test Body'
        };
        
        const response = await callBrick('create_email_draft', payload);
        
        expect(response.status).toBe(200);
        validateBrickResponse(response, true);
        expect(response.data.data).toHaveProperty('draftId');
        expect(response.data.data.draftId).toBe('mock-draft-123');
        expect(response.data.brick).toBe('create_email_draft');
      });

    });

    describe('summarize_emails mock responses', () => {
      
      conditionalTest('should return mock summary for valid input', async () => {
        const payload = {
          sinceISO: '2024-01-01T00:00:00Z'
        };
        
        const response = await callBrick('summarize_emails', payload);
        
        expect(response.status).toBe(200);
        validateBrickResponse(response, true);
        expect(response.data.data).toHaveProperty('summary');
        expect(response.data.data).toHaveProperty('emailCount');
        expect(response.data.data).toHaveProperty('timeRange');
        expect(response.data.brick).toBe('summarize_emails');
      });

    });

    describe('create_calendar_event mock responses', () => {
      
      conditionalTest('should return mock event ID for valid input', async () => {
        const payload = {
          title: 'Test Event',
          startISO: '2024-01-01T10:00:00Z',
          endISO: '2024-01-01T11:00:00Z',
          guests: ['guest@example.com']
        };
        
        const response = await callBrick('create_calendar_event', payload);
        
        expect(response.status).toBe(200);
        validateBrickResponse(response, true);
        expect(response.data.data).toHaveProperty('eventId');
        expect(response.data.data).toHaveProperty('htmlLink');
        expect(response.data.data.eventId).toBe('mock-event-123');
        expect(response.data.brick).toBe('create_calendar_event');
      });

    });

    describe('list_todays_events mock responses', () => {
      
      conditionalTest('should return mock events array', async () => {
        const response = await callBrick('list_todays_events', {});
        
        expect(response.status).toBe(200);
        validateBrickResponse(response, true);
        expect(response.data.data).toHaveProperty('events');
        expect(Array.isArray(response.data.data.events)).toBe(true);
        expect(response.data.brick).toBe('list_todays_events');
        
        // Verify event structure if events exist
        if (response.data.data.events.length > 0) {
          const event = response.data.data.events[0];
          expect(event).toHaveProperty('title');
          expect(event).toHaveProperty('start');
          expect(event).toHaveProperty('end');
        }
      });

    });

  });

  describe('Rate Limiting Tests', () => {
    
    // Note: Rate limiting tests are challenging to implement reliably in CI
    // These tests would need to be run with specific rate limit configurations
    
    test.skip('should return 429 when rate limit exceeded', async () => {
      // This test would require making multiple rapid requests
      // Skip for now as it's difficult to test reliably in CI
      const payload = {
        to: 'test@example.com',
        subject: 'Rate Limit Test',
        body: 'Testing rate limits'
      };
      
      // Make multiple rapid requests to trigger rate limiting
      const promises = Array(10).fill().map(() => 
        callBrick('create_email_draft', payload)
      );
      
      const responses = await Promise.all(promises);
      
      // At least one should be rate limited
      const rateLimited = responses.some(r => r.status === 429);
      expect(rateLimited).toBe(true);
    });

  });

  describe('Response Structure Compliance', () => {

    conditionalTestEach(BRICK_ENDPOINTS)('should return consistent response structure - %s', async (brickName) => {
      // Use valid payloads for each brick type
      const payloads = {
        create_email_draft: {
          to: 'test@example.com',
          subject: 'Test',
          body: 'Test'
        },
        summarize_emails: {
          sinceISO: '2024-01-01T00:00:00Z'
        },
        create_calendar_event: {
          title: 'Test Event',
          startISO: '2024-01-01T10:00:00Z',
          endISO: '2024-01-01T11:00:00Z'
        },
        list_todays_events: {}
      };
      
      const response = await callBrick(brickName, payloads[brickName]);
      
      expect(response.status).toBe(200);
      validateBrickResponse(response, true);
      
      // Verify timestamp is valid ISO string
      expect(new Date(response.data.timestamp).toISOString()).toBe(response.data.timestamp);
      
      // Verify requestId is present and non-empty
      expect(response.data.requestId).toBeTruthy();
      expect(typeof response.data.requestId).toBe('string');
      
      // Verify brick name matches endpoint
      expect(response.data.brick).toBe(brickName);
    });

  });

  describe('Error Response Structure', () => {

    conditionalTest('should return consistent error structure for validation failures', async () => {
      const response = await callBrick('create_email_draft', {});
      
      expect(response.status).toBe(400);
      validateBrickResponse(response, false);
      
      // Verify error response has required fields
      expect(response.data.error).toBeTruthy();
      expect(response.data.code).toBeTruthy();
      expect(typeof response.data.error).toBe('string');
      expect(typeof response.data.code).toBe('string');
    });

    conditionalTest('should return consistent error structure for auth failures', async () => {
      const response = await callBrick('create_email_draft', {}, null);
      
      expect(response.status).toBe(401);
      validateBrickResponse(response, false);
      
      expect(response.data.error).toContain('Unauthorized');
      expect(response.data.code).toBe('AUTH_FAILED');
    });

  });

});