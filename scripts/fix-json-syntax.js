#!/usr/bin/env node

/**
 * Fix JSON syntax issues in workflow files
 */

const fs = require('fs');
const path = require('path');

function fixJsonSyntax(filePath) {
  console.log(`Fixing JSON syntax in: ${filePath}`);
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Fix literal \n characters that should be actual newlines
    content = content.replace(/\\n/g, '\n');
    
    // Try to parse and reformat the JSON
    const jsonData = JSON.parse(content);
    const fixedContent = JSON.stringify(jsonData, null, 2);
    
    fs.writeFileSync(filePath, fixedContent);
    console.log(`✅ Fixed JSON syntax in: ${filePath}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}: ${error.message}`);
    return false;
  }
}

// Fix the summarize_emails.json file
const filePath = path.join(__dirname, '../flows/bricks/summarize_emails.json');
fixJsonSyntax(filePath);