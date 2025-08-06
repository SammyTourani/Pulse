#!/usr/bin/env ts-node

import * as dotenv from 'dotenv';

dotenv.config();

async function listWorkflows() {
  console.log('🔍 Checking available workflows in n8n...\n');
  
  try {
    // Try to get workflow list - this might require authentication
    const response = await fetch('http://localhost:5678/api/v1/workflows', {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      const workflows = await response.json() as any;
      console.log('✅ Found workflows:');
      workflows.data?.forEach((workflow: any) => {
        console.log(`  - ID: "${workflow.id}" | Name: "${workflow.name}" | Active: ${workflow.active}`);
      });
    } else {
      console.log('❌ Could not fetch workflows (authentication might be required)');
      console.log(`Response: ${response.status} ${response.statusText}`);
      
      // Try alternative approach - check webhook endpoints
      console.log('\n🔄 Trying alternative approach - checking webhook endpoints...');
      
      const testWorkflows = [
        'gmail.search_messages',
        'gmail.create_email_draft', 
        'gmail.send_email',
        'gmail-search-messages',
        'gmail-create-email-draft',
        'gmail-send-email'
      ];
      
      for (const workflowName of testWorkflows) {
        try {
          const webhookResponse = await fetch(`http://localhost:5678/webhook-test/${workflowName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ test: true })
          });
          
          if (webhookResponse.status !== 404) {
            console.log(`✅ Found webhook: ${workflowName}`);
          }
        } catch (e) {
          // Ignore errors
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

if (require.main === module) {
  listWorkflows().catch(console.error);
}
