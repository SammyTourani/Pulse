#!/usr/bin/env node

/**
 * Direct n8n Workflow Import Script
 * This script copies the workflow JSON to clipboard for easy import
 */

const fs = require('fs');
const path = require('path');

const workflowPath = path.join(__dirname, 'flows/gmail_gemini_sms_workflow_enhanced.json');

if (!fs.existsSync(workflowPath)) {
  console.error('❌ Workflow file not found:', workflowPath);
  process.exit(1);
}

const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

console.log('📋 WORKFLOW JSON FOR n8n IMPORT');
console.log('='.repeat(50));
console.log('');
console.log('1. In n8n, click the "+" button to create a new workflow');
console.log('2. Look for "Import" or "..." menu');
console.log('3. Choose "Import from JSON" or "Paste JSON"');
console.log('4. Copy the JSON below and paste it:');
console.log('');
console.log('='.repeat(50));
console.log(JSON.stringify(workflow, null, 2));
console.log('='.repeat(50));
console.log('');
console.log('✅ After importing:');
console.log('1. Update credential references to match your created credentials');
console.log('2. Save the workflow');
console.log('3. Activate the workflow');