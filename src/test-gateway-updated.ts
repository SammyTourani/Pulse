#!/usr/bin/env npx ts-node

/**
 * Test script for the updated Pulse Gateway with timestamp-based HMAC
 */

import * as dotenv from 'dotenv';
import { callBrick } from './brick-client';

// Load environment variables
dotenv.config();

async function main() {
  console.log('🔧 Testing Pulse Gateway with Updated HMAC...\n');

  const config = {
    gatewayUrl: 'http://localhost:5678',
    hmacSecret: process.env.PULSE_HMAC_SECRET!,
    timeoutMs: 10000
  };

  console.log('Gateway URL:', config.gatewayUrl);
  console.log('HMAC Secret:', config.hmacSecret ? '✅ Configured' : '❌ Missing');
  console.log('');

  if (!config.hmacSecret) {
    console.error('❌ PULSE_HMAC_SECRET not found in environment variables');
    process.exit(1);
  }

  try {
    // Test Gmail search
    console.log('📧 Testing Gmail search brick...');
    const searchResult = await callBrick(config, {
      brick: 'gmail.search_messages',
      connectionId: 'test-connection-123',
      params: {
        query: 'test email',
        maxResults: 5
      },
      requestId: 'test-search-' + Date.now()
    });

    console.log('✅ Gmail search result:');
    console.log(JSON.stringify(searchResult, null, 2));
    console.log('');

  } catch (error: any) {
    console.error('❌ Error testing gateway:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response body:', await error.response.text());
    }
    console.log('');
  }

  try {
    // Test unknown brick
    console.log('🚫 Testing unknown brick (should fail gracefully)...');
    const unknownResult = await callBrick(config, {
      brick: 'unknown.brick',
      connectionId: 'test-connection-123',
      params: {},
      requestId: 'test-unknown-' + Date.now()
    });

    console.log('✅ Unknown brick result:');
    console.log(JSON.stringify(unknownResult, null, 2));
    console.log('');

  } catch (error: any) {
    console.error('❌ Error testing unknown brick:', error.message);
    console.log('');
  }

  console.log('🎉 Gateway testing complete!');
}

if (require.main === module) {
  main().catch(console.error);
}
