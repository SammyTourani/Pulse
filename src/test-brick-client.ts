#!/usr/bin/env ts-node

import { callBrick, createBrickClient, BrickExecutionError } from './brick-client';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testBrickClient() {
  const hmacSecret = process.env.PULSE_HMAC_SECRET;
  if (!hmacSecret) {
    console.error('Error: PULSE_HMAC_SECRET not found in environment');
    process.exit(1);
  }

  // Create a client instance
  const client = createBrickClient({
    gatewayUrl: 'http://localhost:5678',
    hmacSecret,
    timeoutMs: 30000
  });

  console.log('Testing Pulse Gateway brick client...\n');

  try {
    // Test 1: Search Gmail messages
    console.log('🔍 Testing gmail.search_messages brick...');
    const searchResult = await client({
      brick: 'gmail.search_messages',
      connectionId: 'test-connection-1',
      params: {
        query: 'from:me',
        maxResults: 5,
        userId: 'me',
        tenantId: 'test-tenant'
      }
    });
    
    console.log('✅ Search successful:', {
      ok: searchResult.ok,
      brick: searchResult.brick,
      messageCount: searchResult.data?.messages?.length || 0,
      cached: searchResult.cached
    });

    // Test 2: Create email draft
    console.log('\n📝 Testing gmail.create_email_draft brick...');
    const draftResult = await client({
      brick: 'gmail.create_email_draft',
      connectionId: 'test-connection-2',
      params: {
        to: ['test@example.com'],
        subject: 'Test Draft from Pulse Client',
        body: '<h1>Hello from Pulse!</h1><p>This is a test draft created via the TypeScript client.</p>',
        userId: 'me',
        tenantId: 'test-tenant'
      }
    });
    
    console.log('✅ Draft created:', {
      ok: draftResult.ok,
      brick: draftResult.brick,
      draftId: draftResult.data?.draftId,
      messageId: draftResult.data?.messageId
    });

    console.log('\n🎉 All tests passed! The brick client is working correctly.');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('\n❌ Test failed:', errorMessage);
    
    if (error instanceof BrickExecutionError) {
      console.error('Brick response:', JSON.stringify(error.response, null, 2));
    }
    
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testBrickClient().catch(console.error);
}

export { testBrickClient };
