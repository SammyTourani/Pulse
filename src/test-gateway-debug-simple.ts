#!/usr/bin/env node

import dotenv from 'dotenv';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

const GATEWAY_URL = 'http://localhost:5678/webhook/pulse-gateway';
const HMAC_SECRET = process.env.PULSE_HMAC_SECRET!;

async function testSimpleRequest() {
  console.log('🔧 Simple Gateway Debug Test...');
  
  const timestamp = Math.floor(Date.now() / 1000);
  const body = {
    brick: 'gmail.search_messages',
    connectionId: 'test-connection-123',
    params: {
      query: 'test email',
      maxResults: 5
    }
  };

  const bodyString = JSON.stringify(body);
  const hmacPayload = String(timestamp) + bodyString;
  const signature = crypto.createHmac('sha256', HMAC_SECRET).update(hmacPayload).digest('hex');

  console.log('📊 Request Details:');
  console.log('Timestamp:', timestamp);
  console.log('Body string:', bodyString);
  console.log('HMAC payload:', hmacPayload);
  console.log('Signature:', `sha256=${signature}`);
  console.log('HMAC secret (first 20 chars):', HMAC_SECRET.substring(0, 20) + '...');

  try {
    const response = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Pulse-Timestamp': timestamp.toString(),
        'X-Pulse-Signature': `sha256=${signature}`
      },
      body: bodyString
    });

    const result = await response.json();
    console.log('📤 Response status:', response.status);
    console.log('📥 Response body:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ Request failed:', error);
  }
}

testSimpleRequest();
