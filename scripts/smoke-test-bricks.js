#!/usr/bin/env node

/**
 * Smoke Test Script for Pulse AI Brick Layer
 * 
 * This script tests all bricks with real API integration for manual/staging testing.
 * It includes cleanup procedures to remove test data.
 * 
 * Usage:
 *   node scripts/smoke-test-bricks.js [--cleanup-only] [--brick=<name>]
 * 
 * Environment Variables Required:
 *   - BRICK_AUTH_KEY: Authentication key for brick endpoints
 *   - N8N_BASE_URL: Base URL for n8n instance (default: http://localhost:5678)
 *   - MOCK_MODE: Should be 'false' for real API testing
 */

const fetch = require('node-fetch');
const { promisify } = require('util');
const sleep = promisify(setTimeout);

// Configuration
const BASE_URL = process.env.PULSE_BASE_URL || 'http://localhost:5678/webhook/webhook-brick';
const BRICK_AUTH_KEY = process.env.BRICK_AUTH_KEY;
const CLEANUP_ONLY = process.argv.includes('--cleanup-only');
const SPECIFIC_BRICK = process.argv.find(arg => arg.startsWith('--brick='))?.split('=')[1];

// Test data tracking for cleanup
const testData = {
  emailDrafts: [],
  calendarEvents: [],
  testStartTime: new Date().toISOString()
};

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

// Helper function to make brick API calls
async function callBrick(brickName, payload = {}) {
  const url = `${BASE_URL}/${brickName}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Pulse-Key': BRICK_AUTH_KEY
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    return {
      status: response.status,
      data,
      success: response.ok
    };
  } catch (error) {
    return {
      status: 0,
      data: { error: error.message },
      success: false
    };
  }
}

// Test create_email_draft with actual Gmail API integration
async function testCreateEmailDraft() {
  logInfo('Testing create_email_draft with real Gmail API...');

  const testEmail = {
    to: 'test@example.com',
    subject: `Smoke Test Email Draft - ${new Date().toISOString()}`,
    body: `This is a smoke test email draft created at ${new Date().toISOString()}.\n\nThis draft should be automatically cleaned up.`
  };

  try {
    const response = await callBrick('create_email_draft', testEmail);

    if (response.success && response.data.ok) {
      const draftId = response.data.data.draftId;
      testData.emailDrafts.push(draftId);

      logSuccess(`Email draft created successfully: ${draftId}`);

      // Verify draft ID format (Gmail draft IDs are typically numeric or alphanumeric)
      if (!/^[a-zA-Z0-9_-]+$/.test(draftId)) {
        logWarning(`Draft ID format seems unusual: ${draftId}`);
      }

      return true;
    } else {
      logError(`Failed to create email draft: ${response.data.error || 'Unknown error'}`);
      return false;
    }
  } catch (error) {
    logError(`Exception in create_email_draft test: ${error.message}`);
    return false;
  }
}

// Test summarize_emails with real email fetching and Gemini API
async function testSummarizeEmails() {
  logInfo('Testing summarize_emails with real Gmail and Gemini API...');

  // Use a recent timestamp to get some emails
  const sinceISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 24 hours ago

  try {
    const response = await callBrick('summarize_emails', { sinceISO });

    if (response.success && response.data.ok) {
      const { summary, emailCount, timeRange } = response.data.data;

      logSuccess(`Email summary generated successfully`);
      logInfo(`  Email count: ${emailCount}`);
      logInfo(`  Time range: ${timeRange.from} to ${timeRange.to}`);
      logInfo(`  Summary preview: ${summary.substring(0, 100)}...`);

      // Verify response structure
      if (typeof summary !== 'string' || typeof emailCount !== 'number') {
        logWarning('Response structure validation failed');
        return false;
      }

      return true;
    } else {
      logError(`Failed to summarize emails: ${response.data.error || 'Unknown error'}`);
      return false;
    }
  } catch (error) {
    logError(`Exception in summarize_emails test: ${error.message}`);
    return false;
  }
}

// Test create_calendar_event with actual Google Calendar API
async function testCreateCalendarEvent() {
  logInfo('Testing create_calendar_event with real Google Calendar API...');

  const now = new Date();
  const startTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
  const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 minutes duration

  const testEvent = {
    title: `Smoke Test Event - ${now.toISOString()}`,
    startISO: startTime.toISOString(),
    endISO: endTime.toISOString(),
    guests: ['test@example.com'],
    description: 'This is a smoke test calendar event that should be automatically cleaned up.',
    location: 'Test Location'
  };

  try {
    const response = await callBrick('create_calendar_event', testEvent);

    if (response.success && response.data.ok) {
      const { eventId, htmlLink } = response.data.data;
      testData.calendarEvents.push(eventId);

      logSuccess(`Calendar event created successfully: ${eventId}`);
      logInfo(`  Event URL: ${htmlLink}`);

      // Verify response structure
      if (!eventId || !htmlLink) {
        logWarning('Missing eventId or htmlLink in response');
        return false;
      }

      return true;
    } else {
      logError(`Failed to create calendar event: ${response.data.error || 'Unknown error'}`);
      return false;
    }
  } catch (error) {
    logError(`Exception in create_calendar_event test: ${error.message}`);
    return false;
  }
}

// Test list_todays_events with actual Google Calendar API
async function testListTodaysEvents() {
  logInfo('Testing list_todays_events with real Google Calendar API...');

  try {
    const response = await callBrick('list_todays_events', {});

    if (response.success && response.data.ok) {
      const { events } = response.data.data;

      logSuccess(`Today's events retrieved successfully`);
      logInfo(`  Event count: ${events.length}`);

      // Log first few events for verification
      events.slice(0, 3).forEach((event, index) => {
        logInfo(`  Event ${index + 1}: ${event.title} (${event.start} - ${event.end})`);
      });

      // Verify response structure
      if (!Array.isArray(events)) {
        logWarning('Events is not an array');
        return false;
      }

      // Verify event structure if events exist
      if (events.length > 0) {
        const event = events[0];
        if (!event.title || !event.start || !event.end) {
          logWarning('Event structure validation failed');
          return false;
        }
      }

      return true;
    } else {
      logError(`Failed to list today's events: ${response.data.error || 'Unknown error'}`);
      return false;
    }
  } catch (error) {
    logError(`Exception in list_todays_events test: ${error.message}`);
    return false;
  }
}

// Cleanup test data
async function cleanupTestData() {
  logInfo('Starting cleanup of test data...');

  let cleanupSuccess = true;

  // Note: Actual cleanup would require direct API calls to Gmail and Calendar APIs
  // Since we're working through n8n bricks, we'll log what should be cleaned up
  // In a real implementation, you'd need separate cleanup scripts or API calls

  if (testData.emailDrafts.length > 0) {
    logInfo(`Email drafts to clean up: ${testData.emailDrafts.length}`);
    testData.emailDrafts.forEach(draftId => {
      logInfo(`  - Draft ID: ${draftId}`);
    });

    // TODO: Implement actual Gmail API cleanup
    logWarning('Email draft cleanup not implemented - manual cleanup required');
  }

  if (testData.calendarEvents.length > 0) {
    logInfo(`Calendar events to clean up: ${testData.calendarEvents.length}`);
    testData.calendarEvents.forEach(eventId => {
      logInfo(`  - Event ID: ${eventId}`);
    });

    // TODO: Implement actual Calendar API cleanup
    logWarning('Calendar event cleanup not implemented - manual cleanup required');
  }

  if (testData.emailDrafts.length === 0 && testData.calendarEvents.length === 0) {
    logSuccess('No test data to clean up');
  }

  return cleanupSuccess;
}

// Pre-flight checks
async function preflightChecks() {
  logInfo('Running pre-flight checks...');

  // Check required environment variables
  if (!BRICK_AUTH_KEY) {
    logError('BRICK_AUTH_KEY environment variable is required');
    return false;
  }



  // Test n8n connectivity
  try {
    const baseUrl = BASE_URL.replace('/webhook/webhook-brick', '');
    const response = await fetch(`${baseUrl}/healthz`);
    if (!response.ok) {
      logWarning(`n8n health check returned ${response.status} - continuing anyway`);
    } else {
      logSuccess('n8n connectivity verified');
    }
  } catch (error) {
    logWarning(`Could not verify n8n connectivity: ${error.message}`);
  }

  return true;
}

// Main test runner
async function runSmokeTests() {
  log(`${colors.bold}🧪 Pulse AI Brick Layer Smoke Tests${colors.reset}`);
  log(`${colors.blue}Started at: ${new Date().toISOString()}${colors.reset}`);
  log('');

  if (CLEANUP_ONLY) {
    logInfo('Running cleanup only...');
    await cleanupTestData();
    return;
  }

  // Pre-flight checks
  if (!(await preflightChecks())) {
    logError('Pre-flight checks failed - aborting tests');
    process.exit(1);
  }

  const testResults = {
    total: 0,
    passed: 0,
    failed: 0
  };

  const tests = [
    { name: 'create_email_draft', fn: testCreateEmailDraft },
    { name: 'summarize_emails', fn: testSummarizeEmails },
    { name: 'create_calendar_event', fn: testCreateCalendarEvent },
    { name: 'list_todays_events', fn: testListTodaysEvents }
  ];

  // Filter tests if specific brick requested
  const testsToRun = SPECIFIC_BRICK
    ? tests.filter(test => test.name === SPECIFIC_BRICK)
    : tests;

  if (testsToRun.length === 0) {
    logError(`No tests found for brick: ${SPECIFIC_BRICK}`);
    process.exit(1);
  }

  // Run tests
  for (const test of testsToRun) {
    log('');
    log(`${colors.bold}Testing ${test.name}...${colors.reset}`);

    testResults.total++;

    try {
      const success = await test.fn();
      if (success) {
        testResults.passed++;
      } else {
        testResults.failed++;
      }

      // Small delay between tests
      await sleep(1000);
    } catch (error) {
      logError(`Unexpected error in ${test.name}: ${error.message}`);
      testResults.failed++;
    }
  }

  // Cleanup
  log('');
  await cleanupTestData();

  // Summary
  log('');
  log(`${colors.bold}📊 Test Summary${colors.reset}`);
  log(`Total tests: ${testResults.total}`);
  logSuccess(`Passed: ${testResults.passed}`);
  if (testResults.failed > 0) {
    logError(`Failed: ${testResults.failed}`);
  }

  const successRate = (testResults.passed / testResults.total * 100).toFixed(1);
  log(`Success rate: ${successRate}%`);

  if (testResults.failed > 0) {
    process.exit(1);
  } else {
    logSuccess('All smoke tests passed! 🎉');
  }
}

// Handle cleanup on exit
process.on('SIGINT', async () => {
  log('');
  logWarning('Received interrupt signal - cleaning up...');
  await cleanupTestData();
  process.exit(0);
});

// Run the tests
if (require.main === module) {
  runSmokeTests().catch(error => {
    logError(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  runSmokeTests,
  cleanupTestData,
  testData
};