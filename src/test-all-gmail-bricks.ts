#!/usr/bin/env npx ts-node

/**
 * Comprehensive Gmail bricks test - Test all three Gmail bricks
 */

import * as dotenv from 'dotenv';
import * as crypto from 'crypto';

// Load environment variables
dotenv.config();

async function testAllGmailBricks() {
  console.log('🧪 Testing All Gmail Bricks...\n');

  const hmacSecret = process.env.PULSE_HMAC_SECRET!;
  
  // Test 1: Gmail Search Messages
  console.log('📋 Test 1: Gmail Search Messages');
  try {
    const timestamp1 = Math.floor(Date.now() / 1000).toString();
    const body1 = {
      brick: 'gmail.search_messages',
      connectionId: 'test-connection-123',
      params: { query: 'test email', maxResults: 5 }
    };
    
    const payloadString1 = JSON.stringify(body1);
    const hmacPayload1 = timestamp1 + payloadString1;
    const hmac1 = crypto.createHmac('sha256', hmacSecret);
    hmac1.update(hmacPayload1);
    const signature1 = `sha256=${hmac1.digest('hex')}`;

    const response1 = await fetch('http://localhost:5678/webhook/pulse-gateway', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Pulse-Timestamp': timestamp1,
        'X-Pulse-Signature': signature1
      },
      body: payloadString1
    });
    
    const result1 = await response1.json() as any;
    console.log('✅ Gmail Search Response:', result1.ok ? 'SUCCESS' : `ERROR: ${result1.error?.code}`);
    if (result1.ok) {
      console.log('   Data:', `Found ${result1.data?.messages?.length || 0} messages`);
    } else {
      console.log('   Error:', result1.error?.message);
    }
  } catch (e) {
    console.log('❌ Gmail Search failed:', (e as Error).message);
  }

  console.log('');

  // Test 2: Gmail Create Email Draft
  console.log('📋 Test 2: Gmail Create Email Draft');
  try {
    const timestamp2 = Math.floor(Date.now() / 1000).toString();
    const body2 = {
      brick: 'gmail.create_email_draft',
      connectionId: 'test-connection-123',
      params: { 
        to: 'test@example.com',
        subject: 'Test Draft from Pulse',
        body: 'This is a test draft created by the Pulse system.'
      }
    };
    
    const payloadString2 = JSON.stringify(body2);
    const hmacPayload2 = timestamp2 + payloadString2;
    const hmac2 = crypto.createHmac('sha256', hmacSecret);
    hmac2.update(hmacPayload2);
    const signature2 = `sha256=${hmac2.digest('hex')}`;

    const response2 = await fetch('http://localhost:5678/webhook/pulse-gateway', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Pulse-Timestamp': timestamp2,
        'X-Pulse-Signature': signature2
      },
      body: payloadString2
    });
    
    const result2 = await response2.json() as any;
    console.log('✅ Gmail Draft Response:', result2.ok ? 'SUCCESS' : `ERROR: ${result2.error?.code}`);
    if (result2.ok) {
      console.log('   Data:', `Draft created with ID: ${result2.data?.draftId}`);
    } else {
      console.log('   Error:', result2.error?.message);
    }
  } catch (e) {
    console.log('❌ Gmail Draft failed:', (e as Error).message);
  }

  console.log('');

  // Test 3: Gmail Send Email  
  console.log('📋 Test 3: Gmail Send Email');
  try {
    const timestamp3 = Math.floor(Date.now() / 1000).toString();
    const body3 = {
      brick: 'gmail.send_email',
      connectionId: 'test-connection-123',
      params: { 
        to: 'test@example.com',
        subject: 'Test Email from Pulse',
        body: 'This is a test email sent by the Pulse system.'
      }
    };
    
    const payloadString3 = JSON.stringify(body3);
    const hmacPayload3 = timestamp3 + payloadString3;
    const hmac3 = crypto.createHmac('sha256', hmacSecret);
    hmac3.update(hmacPayload3);
    const signature3 = `sha256=${hmac3.digest('hex')}`;

    const response3 = await fetch('http://localhost:5678/webhook/pulse-gateway', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Pulse-Timestamp': timestamp3,
        'X-Pulse-Signature': signature3
      },
      body: payloadString3
    });
    
    const result3 = await response3.json() as any;
    console.log('✅ Gmail Send Response:', result3.ok ? 'SUCCESS' : `ERROR: ${result3.error?.code}`);
    if (result3.ok) {
      console.log('   Data:', `Email sent with message ID: ${result3.data?.messageId}`);
    } else {
      console.log('   Error:', result3.error?.message);
    }
  } catch (e) {
    console.log('❌ Gmail Send failed:', (e as Error).message);
  }

  console.log('\n🎉 All Gmail bricks testing complete!');
  console.log('\n📊 Summary:');
  console.log('- gmail.search_messages: Searches for emails in Gmail');
  console.log('- gmail.create_email_draft: Creates email drafts in Gmail');
  console.log('- gmail.send_email: Sends emails via Gmail');
}

if (require.main === module) {
  testAllGmailBricks().catch(console.error);
}
