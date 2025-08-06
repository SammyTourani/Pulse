#!/usr/bin/env node

/**
 * Debug script to see the raw response from the gateway
 */

const crypto = require('crypto');

async function debugGatewayResponse() {
  console.log('🔍 Debugging gateway response...\n');

  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = {
      brick: 'gmail.search_messages',
      connectionId: 'test-connection-123',
      params: { query: 'test email', maxResults: 5 }
    };
    
    const payloadString = JSON.stringify(body);
    const hmacPayload = timestamp + payloadString;
    
    // Use the same secret as in .env
    const secret = process.env.PULSE_HMAC_SECRET || '58222cced25229c292d807ae59d64961197daf2692d06f566e58694502a258c8';
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(hmacPayload);
    const signature = `sha256=${hmac.digest('hex')}`;

    console.log('Request details:');
    console.log('- Timestamp:', timestamp);
    console.log('- Body:', payloadString);
    console.log('- Signature:', signature.substring(0, 20) + '...');
    console.log('');

    const response = await fetch('http://localhost:5678/webhook/pulse-gateway', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Pulse-Timestamp': timestamp,
        'X-Pulse-Signature': signature
      },
      body: payloadString
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('Response body length:', responseText.length);
    console.log('Response body (first 500 chars):');
    console.log(responseText.substring(0, 500));
    
    if (responseText.length > 500) {
      console.log('...(truncated)');
    }

  } catch (e) {
    console.log('❌ Debug failed:', e.message);
  }
}

debugGatewayResponse();
