#!/usr/bin/env ts-node

import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function checkWorkflows() {
  console.log('🔍 Checking n8n workflows and webhooks...\n');
  
  try {
    // Test various webhook patterns
    const testUrls = [
      'http://localhost:5678/webhook/pulse-gateway',
      'http://localhost:5678/webhook-test/pulse-gateway', 
      'http://localhost:5678/webhook/gmail-send-email',
      'http://localhost:5678/webhook-test/gmail-send-email'
    ];
    
    for (const url of testUrls) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: true })
        });
        
        const text = await response.text();
        console.log(`✅ ${url}: ${response.status} ${response.statusText}`);
        
        if (text.includes('registered') || text.includes('webhook')) {
          console.log(`   Response: ${text.substring(0, 100)}...`);
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`❌ ${url}: ${errorMessage}`);
      }
    }
    
  } catch (error) {
    console.error('Error checking workflows:', error);
  }
}

// Run check if this file is executed directly
if (require.main === module) {
  checkWorkflows().catch(console.error);
}

export { checkWorkflows };
