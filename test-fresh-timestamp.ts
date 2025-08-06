import crypto from 'crypto';
import fetch from 'node-fetch';

const GATEWAY_URL = 'http://localhost:5678/webhook/pulse-gateway';
const HMAC_SECRET = '58222cced25229c292d807ae59d64961197daf2692d06f566e58694502a258c8';

async function testWithFreshTimestamp() {
  const timestamp = Math.floor(Date.now() / 1000);
  const body = {
    brick: "gmail.search_messages",
    connectionId: "test-connection-123", 
    params: {
      query: "test email",
      maxResults: 5
    }
  };
  
  const hmacPayload = String(timestamp) + JSON.stringify(body);
  const signature = 'sha256=' + crypto.createHmac('sha256', HMAC_SECRET).update(hmacPayload).digest('hex');
  
  console.log('🔧 Testing with fresh timestamp...');
  console.log('Timestamp:', timestamp);
  console.log('Body:', JSON.stringify(body));
  console.log('HMAC Payload:', hmacPayload);
  console.log('Signature:', signature);
  
  const response = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Pulse-Timestamp': String(timestamp),
      'X-Pulse-Signature': signature
    },
    body: JSON.stringify(body)
  });
  
  const result = await response.json();
  console.log('✅ Response:', JSON.stringify(result, null, 2));
}

testWithFreshTimestamp().catch(console.error);
