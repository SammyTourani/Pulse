const crypto = require('crypto');

const HMAC_SECRET = '58222cced25229c292d807ae59d64961197daf2692d06f566e58694502a258c8';
const timestamp = '1754437986';

// Test different JSON.stringify formats
const body1 = {"brick":"gmail.search_messages","connectionId":"test-connection-123","params":{"query":"test email","maxResults":5}};
const body2 = {brick:"gmail.search_messages",connectionId:"test-connection-123",params:{query:"test email",maxResults:5}};

const payload1 = timestamp + JSON.stringify(body1);
const payload2 = timestamp + JSON.stringify(body2);

console.log('🔍 HMAC Debug Analysis:');
console.log('Timestamp:', timestamp);
console.log('Body1 (with quotes):', JSON.stringify(body1));
console.log('Body2 (no quotes):', JSON.stringify(body2));
console.log('Payload1:', payload1);
console.log('Payload2:', payload2);
console.log('');

const sig1 = crypto.createHmac('sha256', HMAC_SECRET).update(payload1).digest('hex');
const sig2 = crypto.createHmac('sha256', HMAC_SECRET).update(payload2).digest('hex');

console.log('Signature1:', 'sha256=' + sig1);
console.log('Signature2:', 'sha256=' + sig2);

// Test what the gateway likely receives (no spacing)
const compactBody = {"brick":"gmail.search_messages","connectionId":"test-connection-123","params":{"query":"test email","maxResults":5}};
const compactPayload = timestamp + JSON.stringify(compactBody);
const compactSig = crypto.createHmac('sha256', HMAC_SECRET).update(compactPayload).digest('hex');

console.log('');
console.log('Compact payload:', compactPayload);
console.log('Compact signature:', 'sha256=' + compactSig);
