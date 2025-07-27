#!/usr/bin/env node

/**
 * import-workflow.js - Script to import n8n workflow from JSON file
 * This script helps deploy the Gmail-Gemini workflow to n8n instance
 */

const fs = require('fs');
const path = require('path');

const WORKFLOW_FILE = 'flows/gmail_gemini_sms_workflow.json';
const N8N_BASE_URL = process.env.N8N_BASE_URL || 'http://localhost:5678';
const N8N_USER = process.env.N8N_BASIC_AUTH_USER || 'admin';
const N8N_PASSWORD = process.env.N8N_BASIC_AUTH_PASSWORD || '';

async function importWorkflow() {
  try {
    // Read workflow file
    if (!fs.existsSync(WORKFLOW_FILE)) {
      console.error(`❌ Workflow file not found: ${WORKFLOW_FILE}`);
      process.exit(1);
    }

    const workflowData = JSON.parse(fs.readFileSync(WORKFLOW_FILE, 'utf8'));
    console.log(`📋 Loaded workflow: ${workflowData.name}`);

    // Validate required environment variables
    if (!N8N_PASSWORD) {
      console.error('❌ N8N_BASIC_AUTH_PASSWORD environment variable is required');
      process.exit(1);
    }

    // Create basic auth header
    const auth = Buffer.from(`${N8N_USER}:${N8N_PASSWORD}`).toString('base64');

    // Import workflow to n8n
    console.log(`🔄 Importing workflow to ${N8N_BASE_URL}...`);
    
    const response = await fetch(`${N8N_BASE_URL}/api/v1/workflows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify(workflowData)
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Workflow imported successfully!`);
      console.log(`   ID: ${result.id}`);
      console.log(`   Name: ${result.name}`);
      console.log(`   Active: ${result.active}`);
      console.log(`   Nodes: ${result.nodes.length}`);
      
      console.log(`\\n📝 Next steps:`);
      console.log(`   1. Configure Gmail OAuth2 credentials in n8n`);
      console.log(`   2. Set up Gemini API key in environment variables`);
      console.log(`   3. Activate the workflow in n8n interface`);
      console.log(`   4. Test with a sample email`);
      
    } else {
      const error = await response.text();
      console.error(`❌ Failed to import workflow: ${response.status} ${response.statusText}`);
      console.error(`   Error: ${error}`);
      process.exit(1);
    }

  } catch (error) {
    console.error(`💥 Import failed: ${error.message}`);
    process.exit(1);
  }
}

// Validate workflow JSON before import
function validateWorkflow() {
  try {
    const workflowData = JSON.parse(fs.readFileSync(WORKFLOW_FILE, 'utf8'));
    
    // Basic validation
    const requiredFields = ['name', 'nodes', 'connections'];
    for (const field of requiredFields) {
      if (!workflowData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate nodes
    if (!Array.isArray(workflowData.nodes) || workflowData.nodes.length === 0) {
      throw new Error('Workflow must have at least one node');
    }

    // Check for required node types
    const nodeTypes = workflowData.nodes.map(node => node.type);
    const requiredNodeTypes = [
      'n8n-nodes-base.gmailTrigger',
      'n8n-nodes-base.httpRequest',
      'n8n-nodes-base.code',
      'n8n-nodes-base.gmail'
    ];

    for (const requiredType of requiredNodeTypes) {
      if (!nodeTypes.includes(requiredType)) {
        console.warn(`⚠️  Missing recommended node type: ${requiredType}`);
      }
    }

    console.log(`✅ Workflow validation passed`);
    console.log(`   Nodes: ${workflowData.nodes.length}`);
    console.log(`   Node types: ${[...new Set(nodeTypes)].join(', ')}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Workflow validation failed: ${error.message}`);
    return false;
  }
}

// Main execution
if (require.main === module) {
  console.log('🔍 n8n Workflow Import Tool');
  console.log('============================\\n');
  
  if (validateWorkflow()) {
    importWorkflow();
  } else {
    process.exit(1);
  }
}

module.exports = { importWorkflow, validateWorkflow };