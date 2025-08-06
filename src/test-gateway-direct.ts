#!/usr/bin/env ts-node

import { createBrickClient } from './brick-client';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

async function testGatewayDirect() {
  const hmacSecret = process.env.PULSE_HMAC_SECRET!;
  
  // Test with a simple request first to see the exact response
  const payload = {
    brick: 'gmail.search_messages',
    connectionId: 'test-connection-1',
    params: {
      query: 'from:me',
      maxResults: 5,
      userId: 'me',
      tenantId: 'test-tenant'
    },
    requestId: crypto.randomUUID()
  };
  
  const payloadString = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', hmacSecret)
    .update(payloadString)
    .digest('hex');
  
  console.log('🧪 Testing direct gateway request...');
  console.log('Payload:', JSON.stringify(payload, null, 2));
  console.log('Signature:', signature);
  
  try {
    const response = await fetch('http://localhost:5678/webhook/pulse-gateway', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Pulse-Signature': signature
      },
      body: payloadString
    });
    
    console.log('\n📡 Gateway Response:');
    console.log('Status:', response.status, response.statusText);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('Body:', responseText);
    
    // Try to parse as JSON
    try {
      const responseJson = JSON.parse(responseText);
      console.log('Parsed JSON:', JSON.stringify(responseJson, null, 2));
    } catch (e) {
      console.log('Response is not valid JSON');
    }
    
  } catch (error) {
    console.error('Request failed:', error);
  }
}

if (require.main === module) {
  testGatewayDirect().catch(console.error);
}
