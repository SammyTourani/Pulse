#!/usr/bin/env node

/**
 * Simple script to test actual n8n workflows
 * This makes real HTTP calls to your imported workflows
 */

const https = require('http');

const BASE_URL = 'http://localhost:5678';
const BRICK_AUTH_KEY = process.env.BRICK_AUTH_KEY || 'test-key-123';

// Test cases for each workflow
const testCases = [
  {
    name: 'create_email_draft',
    path: '/webhook/webhook-brick/create_email_draft',
    data: {
      to: 'test@example.com',
      subject: 'Test Email Draft',
      body: 'This is a test email body created by the workflow test.'
    }
  },
  {
    name: 'summarize_emails',
    path: '/webhook/webhook-brick/summarize_emails',
    data: {
      sinceISO: new Date(Date.now() - 24*60*60*1000).toISOString() // 24 hours ago
    }
  },
  {
    name: 'create_calendar_event',
    path: '/webhook/webhook-brick/create_calendar_event',
    data: {
      title: 'Test Calendar Event',
      startISO: new Date(Date.now() + 60*60*1000).toISOString(), // 1 hour from now
      endISO: new Date(Date.now() + 2*60*60*1000).toISOString(), // 2 hours from now
      guests: ['test@example.com'],
      description: 'This is a test calendar event.',
      location: 'Test Location'
    }
  },
  {
    name: 'list_todays_events',
    path: '/webhook/webhook-brick/list_todays_events',
    data: {}
  }
];

async function testWorkflow(testCase) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(testCase.data);
    
    const options = {
      hostname: 'localhost',
      port: 5678,
      path: testCase.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Pulse-Key': BRICK_AUTH_KEY,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log(`\n🧱 Testing ${testCase.name}...`);
    console.log(`   URL: ${BASE_URL}${testCase.path}`);
    console.log(`   Data: ${JSON.stringify(testCase.data, null, 2)}`);

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({
            name: testCase.name,
            status: res.statusCode,
            response: response,
            success: res.statusCode === 200
          });
        } catch (error) {
          resolve({
            name: testCase.name,
            status: res.statusCode,
            response: data,
            error: 'Failed to parse JSON response',
            success: false
          });
        }
      });
    });

    req.on('error', (error) => {
      reject({
        name: testCase.name,
        error: error.message,
        success: false
      });
    });

    req.write(postData);
    req.end();
  });
}

async function testAllWorkflows() {
  console.log('🧪 Testing Pulse AI Brick Workflows');
  console.log('===================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Auth Key: ${BRICK_AUTH_KEY}`);
  console.log(`Time: ${new Date().toISOString()}`);

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  for (const testCase of testCases) {
    totalTests++;
    
    try {
      const result = await testWorkflow(testCase);
      
      if (result.success) {
        console.log(`✅ ${result.name}: HTTP ${result.status}`);
        console.log(`   Response: ${JSON.stringify(result.response, null, 2)}`);
        passedTests++;
      } else {
        console.log(`❌ ${result.name}: HTTP ${result.status}`);
        console.log(`   Response: ${JSON.stringify(result.response, null, 2)}`);
        if (result.error) {
          console.log(`   Error: ${result.error}`);
        }
        failedTests++;
      }
      
    } catch (error) {
      console.log(`❌ ${error.name}: ${error.error}`);
      failedTests++;
    }
  }

  // Test authentication failure
  console.log(`\n🔒 Testing authentication failure...`);
  totalTests++;
  
  try {
    const result = await new Promise((resolve, reject) => {
      const postData = JSON.stringify({ test: true });
      
      const options = {
        hostname: 'localhost',
        port: 5678,
        path: '/webhook/webhook-brick/create_email_draft',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Pulse-Key': 'wrong-key',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              response: JSON.parse(data)
            });
          } catch (error) {
            resolve({
              status: res.statusCode,
              response: data
            });
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
    
    if (result.status === 401) {
      console.log(`✅ Auth test: HTTP ${result.status} (correctly rejected)`);
      console.log(`   Response: ${JSON.stringify(result.response, null, 2)}`);
      passedTests++;
    } else {
      console.log(`❌ Auth test: HTTP ${result.status} (should be 401)`);
      console.log(`   Response: ${JSON.stringify(result.response, null, 2)}`);
      failedTests++;
    }
    
  } catch (error) {
    console.log(`❌ Auth test failed: ${error.message}`);
    failedTests++;
  }

  // Summary
  console.log(`\n📊 Test Results:`);
  console.log(`Total: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (failedTests === 0) {
    console.log(`\n🎉 All tests passed! Your workflows are working correctly.`);
  } else {
    console.log(`\n💥 ${failedTests} tests failed. Check the results above.`);
    process.exit(1);
  }
}

if (require.main === module) {
  testAllWorkflows().catch(console.error);
}

module.exports = { testAllWorkflows };