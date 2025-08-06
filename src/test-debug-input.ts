#!/usr/bin/env npx ts-node

/**
 * Debug what input the Gmail workflow is receiving
 */

import * as dotenv from 'dotenv';
import * as crypto from 'crypto';

// Load environment variables
dotenv.config();

async function testSpecificInput() {
  console.log('🔧 Debug Gmail Workflow Input...\n');

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = {
    brick: 'gmail.search_messages',
    connectionId: 'test-connection-123',
    params: {
      query: 'from:me',  // Simple query that should work
      pageSize: 5,
      userId: 'me'
    }
  };
  
  const payloadString = JSON.stringify(body);
  const hmacPayload = timestamp + payloadString;
  const hmac = crypto.createHmac('sha256', process.env.PULSE_HMAC_SECRET!);
  hmac.update(hmacPayload);
  const signature = `sha256=${hmac.digest('hex')}`;

  console.log('📤 Sending:');
  console.log('- Body:', payloadString);
  console.log('- Expected subInput:', JSON.stringify({
    connectionId: 'test-connection-123',
    query: 'from:me',
    pageSize: 5,
    userId: 'me'
  }, null, 2));

  try {
    const response = await fetch('http://localhost:5678/webhook/pulse-gateway', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Pulse-Timestamp': timestamp,
        'X-Pulse-Signature': signature
      },
      body: payloadString
    });
    
    console.log('\n📥 Response Status:', response.status);
    const responseText = await response.text();
    console.log('📥 Response Body:', responseText);

    if (responseText) {
      try {
        const result = JSON.parse(responseText);
        console.log('\n📋 Parsed Response:', JSON.stringify(result, null, 2));
      } catch (e) {
        console.log('\n❌ Could not parse response as JSON');
      }
    }

  } catch (e) {
    console.log('❌ Request failed:', (e as Error).message);
  }
}

if (require.main === module) {
  testSpecificInput().catch(console.error);
}
