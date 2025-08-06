#!/usr/bin/env npx ts-node

/**
 * Simple test to debug the gateway JSON parsing issue
 */

import * as dotenv from 'dotenv';
import * as crypto from 'crypto';

// Load environment variables
dotenv.config();

async function testWithValidHMAC() {
  console.log('🔧 Testing Gateway with Valid HMAC...\n');

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = {
    brick: 'gmail.search_messages',
    connectionId: 'test-connection-123',
    params: {
      query: 'test email',
      maxResults: 5
    }
  };
  
  const payloadString = JSON.stringify(body);
  const hmacPayload = timestamp + payloadString;
  const hmac = crypto.createHmac('sha256', process.env.PULSE_HMAC_SECRET!);
  hmac.update(hmacPayload);
  const signature = `sha256=${hmac.digest('hex')}`;

  console.log('Timestamp:', timestamp);
  console.log('Payload:', payloadString);
  console.log('HMAC Payload Length:', hmacPayload.length);
  console.log('Signature:', signature.substring(0, 20) + '...');
  console.log('');

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

    console.log('Response Status:', response.status);
    console.log('Response Headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('Response Body:', responseText);
    
    if (responseText) {
      try {
        const responseJson = JSON.parse(responseText);
        console.log('Parsed Response:', JSON.stringify(responseJson, null, 2));
      } catch (e) {
        console.log('Failed to parse response as JSON');
      }
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

if (require.main === module) {
  testWithValidHMAC().catch(console.error);
}
