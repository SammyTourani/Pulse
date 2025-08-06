#!/usr/bin/env npx ts-node

/**
 * Simple test to check if the gateway endpoint is accessible
 */

async function main() {
  console.log('🔍 Checking gateway endpoint availability...\n');

  const gatewayUrl = 'http://localhost:5678/webhook/pulse-gateway';
  
  try {
    // Try a simple GET request first (should fail but tell us if endpoint exists)
    console.log(`Testing GET ${gatewayUrl}...`);
    const getResponse = await fetch(gatewayUrl, { method: 'GET' });
    console.log('GET Response status:', getResponse.status);
    console.log('GET Response text:', await getResponse.text());
    console.log('');

    // Try a POST request without proper headers (should fail but tell us more)
    console.log(`Testing POST ${gatewayUrl} without headers...`);
    const postResponse = await fetch(gatewayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'data' })
    });
    console.log('POST Response status:', postResponse.status);
    console.log('POST Response text:', await postResponse.text());
    console.log('');

  } catch (error: any) {
    console.error('❌ Network error:', error.message);
    console.log('');
    console.log('This suggests that:');
    console.log('1. n8n is not running on localhost:5678, OR');
    console.log('2. The gateway workflow is not imported/active, OR');
    console.log('3. The webhook path is different');
    console.log('');
    console.log('Please check:');
    console.log('- Is n8n running? Visit http://localhost:5678');
    console.log('- Is the pulse.gateway workflow imported and active?');
    console.log('- Is the webhook URL correct?');
  }
}

if (require.main === module) {
  main().catch(console.error);
}
