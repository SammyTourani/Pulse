#!/usr/bin/env npx ts-node

/**
 * Comprehensive gateway test to debug the body parsing issue
 */

import * as dotenv from 'dotenv';
import * as crypto from 'crypto';

// Load environment variables
dotenv.config();

async function testGateway() {
  console.log('🔧 Comprehensive Gateway Testing...\n');

  // Test 1: Missing headers (should get MISSING_TIMESTAMP)
  console.log('📋 Test 1: Missing headers');
  try {
    const response1 = await fetch('http://localhost:5678/webhook/pulse-gateway', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"brick":"test","connectionId":"test","params":{}}'
    });
    const result1 = await response1.json() as any;
    console.log('✅ Expected MISSING_TIMESTAMP:', result1.error?.code);
  } catch (e) {
    console.log('❌ Test 1 failed:', (e as Error).message);
  }

  // Test 2: Headers present but wrong signature (should get MISSING_BRICK or progress further)
  console.log('\n📋 Test 2: Headers present, wrong signature');
  try {
    const response2 = await fetch('http://localhost:5678/webhook/pulse-gateway', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Pulse-Timestamp': '1754435500',
        'X-Pulse-Signature': 'sha256=wrong'
      },
      body: '{"brick":"gmail.search_messages","connectionId":"test","params":{}}'
    });
    const result2 = await response2.json() as any;
    console.log('✅ Response:', result2.error?.code, '-', result2.error?.message);
  } catch (e) {
    console.log('❌ Test 2 failed:', (e as Error).message);
  }

  // Test 3: Valid signature
  console.log('\n📋 Test 3: Valid HMAC signature');
  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = {
      brick: 'gmail.search_messages',
      connectionId: 'test-connection-123',
      params: { query: 'test email', maxResults: 5 }
    };
    
    const payloadString = JSON.stringify(body);
    const hmacPayload = timestamp + payloadString;
    const hmac = crypto.createHmac('sha256', process.env.PULSE_HMAC_SECRET!);
    hmac.update(hmacPayload);
    const signature = `sha256=${hmac.digest('hex')}`;

    console.log('Timestamp:', timestamp);
    console.log('Body:', payloadString);
    console.log('HMAC payload length:', hmacPayload.length);
    console.log('Signature (first 20 chars):', signature.substring(0, 20) + '...');

    const response3 = await fetch('http://localhost:5678/webhook/pulse-gateway', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Pulse-Timestamp': timestamp,
        'X-Pulse-Signature': signature
      },
      body: payloadString
    });
    
    const result3 = await response3.json();
    console.log('✅ Response:', JSON.stringify(result3, null, 2));

  } catch (e) {
    console.log('❌ Test 3 failed:', (e as Error).message);
  }

  console.log('\n🎉 Gateway testing complete!');
  console.log('\n📝 Next steps:');
  console.log('1. Check n8n execution logs for DEBUG output');
  console.log('2. Look for webhook body parsing issues');
  console.log('3. Verify PULSE_HMAC_SECRET is set in n8n environment');
}

if (require.main === module) {
  testGateway().catch(console.error);
}
