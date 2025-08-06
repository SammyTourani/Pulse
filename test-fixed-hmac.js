const crypto = require('crypto');

const GATEWAY_URL = 'http://localhost:5678/webhook/pulse-gateway';
const PULSE_HMAC_SECRET = '58222cced25229c292d807ae59d64961197daf2692d06f566e58694502a258c8';

async function testFixedHMAC() {
  console.log('🔧 Testing with FIXED HMAC generation...\n');

  // 1) Build the body object (no extras, no undefineds)
  const body = {
    brick: "gmail.search_messages",
    connectionId: "test-connection-123",
    params: { query: "test email", maxResults: 5 },
    // include requestId / idempotencyKey ONLY if you actually set them
  };

  // 2) Create ONE canonical JSON string
  const jsonString = JSON.stringify(body);   // <-- THIS string will be sent AND signed

  // 3) Create timestamp in **seconds**, not ms
  const ts = Math.floor(Date.now() / 1000).toString(); // e.g., "1754437529"

  // 4) Compute signature over (timestamp + jsonString)
  const payloadToSign = ts + jsonString;
  const signatureHex = crypto
    .createHmac("sha256", PULSE_HMAC_SECRET)
    .update(payloadToSign, "utf8")
    .digest("hex");

  console.log('📋 Debug Info:');
  console.log('Timestamp (seconds):', ts);
  console.log('Body object:', body);
  console.log('JSON string:', jsonString);
  console.log('Payload to sign:', payloadToSign);
  console.log('Signature hex:', signatureHex);
  console.log('Full signature:', `sha256=${signatureHex}`);
  console.log('');

  // 5) Use curl to send EXACTLY `jsonString` as the request body (don't re-stringify)
  const curlCommand = `curl -X POST "${GATEWAY_URL}" \\
    -H "Content-Type: application/json" \\
    -H "X-Pulse-Timestamp: ${ts}" \\
    -H "X-Pulse-Signature: sha256=${signatureHex}" \\
    -d '${jsonString}' \\
    -s`;

  console.log('🚀 Executing curl command:');
  console.log(curlCommand);
  console.log('');

  // Execute the curl command
  const { exec } = require('child_process');
  exec(curlCommand, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    if (stderr) {
      console.error('❌ Stderr:', stderr);
      return;
    }
    console.log('✅ Response:');
    try {
      const response = JSON.parse(stdout);
      console.log(JSON.stringify(response, null, 2));
    } catch (e) {
      console.log('Raw response:', stdout);
    }
  });
}

testFixedHMAC();
