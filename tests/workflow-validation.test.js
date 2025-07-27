#!/usr/bin/env node

/**
 * workflow-validation.test.js - Comprehensive workflow validation tests
 * This file provides detailed testing for n8n workflow JSON files
 */

const fs = require('fs');
const path = require('path');

class WorkflowValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Validate a single workflow file
   * @param {string} filePath - Path to workflow JSON file
   * @returns {boolean} - True if validation passes
   */
  validateWorkflow(filePath) {
    this.errors = [];
    this.warnings = [];

    try {
      // Check file exists
      if (!fs.existsSync(filePath)) {
        this.errors.push(`Workflow file not found: ${filePath}`);
        return false;
      }

      // Parse JSON
      const workflowContent = fs.readFileSync(filePath, 'utf8');
      let workflow;
      
      try {
        workflow = JSON.parse(workflowContent);
      } catch (parseError) {
        this.errors.push(`Invalid JSON in ${filePath}: ${parseError.message}`);
        return false;
      }

      // Validate basic structure
      this.validateBasicStructure(workflow, filePath);
      
      // Validate nodes
      this.validateNodes(workflow.nodes || [], filePath);
      
      // Validate connections
      this.validateConnections(workflow.connections || {}, workflow.nodes || [], filePath);
      
      // Validate workflow-specific requirements
      this.validateWorkflowSpecificRequirements(workflow, filePath);

      return this.errors.length === 0;

    } catch (error) {
      this.errors.push(`Validation error for ${filePath}: ${error.message}`);
      return false;
    }
  }

  /**
   * Validate basic workflow structure
   */
  validateBasicStructure(workflow, filePath) {
    const requiredFields = ['name', 'nodes', 'connections'];
    
    requiredFields.forEach(field => {
      if (!workflow.hasOwnProperty(field)) {
        this.errors.push(`Missing required field '${field}' in ${filePath}`);
      }
    });

    // Validate field types
    if (workflow.name && typeof workflow.name !== 'string') {
      this.errors.push(`Field 'name' must be a string in ${filePath}`);
    }

    if (workflow.nodes && !Array.isArray(workflow.nodes)) {
      this.errors.push(`Field 'nodes' must be an array in ${filePath}`);
    }

    if (workflow.connections && typeof workflow.connections !== 'object') {
      this.errors.push(`Field 'connections' must be an object in ${filePath}`);
    }

    // Check for empty workflow
    if (workflow.nodes && workflow.nodes.length === 0) {
      this.warnings.push(`Workflow ${filePath} has no nodes`);
    }
  }

  /**
   * Validate individual nodes
   */
  validateNodes(nodes, filePath) {
    const nodeIds = new Set();
    const requiredNodeFields = ['id', 'name', 'type', 'position'];

    nodes.forEach((node, index) => {
      // Check required fields
      requiredNodeFields.forEach(field => {
        if (!node.hasOwnProperty(field)) {
          this.errors.push(`Node ${index} missing required field '${field}' in ${filePath}`);
        }
      });

      // Validate node ID uniqueness
      if (node.id) {
        if (nodeIds.has(node.id)) {
          this.errors.push(`Duplicate node ID '${node.id}' in ${filePath}`);
        }
        nodeIds.add(node.id);
      }

      // Validate position format
      if (node.position) {
        if (!Array.isArray(node.position) || node.position.length !== 2) {
          this.errors.push(`Node ${index} has invalid position format in ${filePath}`);
        } else {
          if (typeof node.position[0] !== 'number' || typeof node.position[1] !== 'number') {
            this.errors.push(`Node ${index} position coordinates must be numbers in ${filePath}`);
          }
        }
      }

      // Validate node type format
      if (node.type && !node.type.includes('.')) {
        this.warnings.push(`Node ${index} type '${node.type}' may not be in correct format in ${filePath}`);
      }

      // Check for common node configuration issues
      this.validateNodeConfiguration(node, index, filePath);
    });
  }

  /**
   * Validate node-specific configurations
   */
  validateNodeConfiguration(node, index, filePath) {
    // Gmail trigger node validation
    if (node.type === 'n8n-nodes-base.gmailTrigger') {
      if (!node.parameters || !node.parameters.pollTimes) {
        this.warnings.push(`Gmail trigger node ${index} missing poll configuration in ${filePath}`);
      }
    }

    // HTTP request node validation
    if (node.type === 'n8n-nodes-base.httpRequest') {
      if (!node.parameters || !node.parameters.url) {
        this.errors.push(`HTTP request node ${index} missing URL parameter in ${filePath}`);
      }
      
      if (node.parameters && node.parameters.timeout && node.parameters.timeout > 30000) {
        this.warnings.push(`HTTP request node ${index} has high timeout (${node.parameters.timeout}ms) in ${filePath}`);
      }
    }

    // Twilio node validation
    if (node.type === 'n8n-nodes-base.twilio') {
      if (!node.parameters || !node.parameters.resource) {
        this.warnings.push(`Twilio node ${index} missing resource configuration in ${filePath}`);
      }
    }

    // Code node validation
    if (node.type === 'n8n-nodes-base.code') {
      if (!node.parameters || !node.parameters.jsCode) {
        this.warnings.push(`Code node ${index} missing JavaScript code in ${filePath}`);
      }
    }
  }

  /**
   * Validate node connections
   */
  validateConnections(connections, nodes, filePath) {
    const nodeIds = new Set(nodes.map(node => node.id));

    Object.keys(connections).forEach(sourceNodeId => {
      // Check if source node exists
      if (!nodeIds.has(sourceNodeId)) {
        this.errors.push(`Connection references non-existent source node '${sourceNodeId}' in ${filePath}`);
        return;
      }

      const nodeConnections = connections[sourceNodeId];
      
      Object.keys(nodeConnections).forEach(outputIndex => {
        const outputs = nodeConnections[outputIndex];
        
        if (!Array.isArray(outputs)) {
          this.errors.push(`Invalid connection format for node '${sourceNodeId}' output ${outputIndex} in ${filePath}`);
          return;
        }

        outputs.forEach((connection, connIndex) => {
          // Validate connection structure
          if (!connection.node || typeof connection.node !== 'string') {
            this.errors.push(`Invalid target node in connection ${connIndex} from '${sourceNodeId}' in ${filePath}`);
          }

          if (connection.type && typeof connection.type !== 'string') {
            this.errors.push(`Invalid connection type in connection ${connIndex} from '${sourceNodeId}' in ${filePath}`);
          }

          if (typeof connection.index !== 'number') {
            this.errors.push(`Invalid connection index in connection ${connIndex} from '${sourceNodeId}' in ${filePath}`);
          }

          // Check if target node exists
          if (connection.node && !nodeIds.has(connection.node)) {
            this.errors.push(`Connection references non-existent target node '${connection.node}' in ${filePath}`);
          }
        });
      });
    });
  }

  /**
   * Validate workflow-specific requirements based on filename
   */
  validateWorkflowSpecificRequirements(workflow, filePath) {
    const filename = path.basename(filePath);

    // Main Gmail-Gemini workflow validation
    if (filename === 'gmail_gemini_sms_workflow.json') {
      this.validateMainWorkflow(workflow, filePath);
    }

    // Enhanced workflow validation
    if (filename.includes('enhanced')) {
      this.validateEnhancedFeatures(workflow, filePath);
    }
  }

  /**
   * Validate main Gmail-Gemini workflow requirements
   */
  validateMainWorkflow(workflow, filePath) {
    const nodeTypes = workflow.nodes.map(node => node.type);
    
    // Required node types for main workflow
    const requiredTypes = [
      'n8n-nodes-base.gmailTrigger',
      'n8n-nodes-base.httpRequest',
      'n8n-nodes-base.gmail'
    ];

    const missingTypes = requiredTypes.filter(type => !nodeTypes.includes(type));
    
    if (missingTypes.length > 0) {
      this.errors.push(`Main workflow missing required node types: ${missingTypes.join(', ')} in ${filePath}`);
    }

    // Check for SMS notification capability
    const hasTwilio = nodeTypes.includes('n8n-nodes-base.twilio');
    const hasWebhook = nodeTypes.includes('n8n-nodes-base.webhook');
    
    if (!hasTwilio && !hasWebhook) {
      this.warnings.push(`Main workflow missing SMS notification nodes in ${filePath}`);
    }

    // Validate workflow name
    if (!workflow.name || !workflow.name.toLowerCase().includes('gmail')) {
      this.warnings.push(`Main workflow name should include 'gmail' in ${filePath}`);
    }
  }

  /**
   * Validate enhanced workflow features
   */
  validateEnhancedFeatures(workflow, filePath) {
    const nodeTypes = workflow.nodes.map(node => node.type);
    
    // Check for error handling nodes
    const hasErrorHandling = nodeTypes.some(type => 
      type.includes('error') || 
      workflow.nodes.some(node => 
        node.parameters && 
        node.parameters.continueOnFail === true
      )
    );

    if (!hasErrorHandling) {
      this.warnings.push(`Enhanced workflow should include error handling in ${filePath}`);
    }

    // Check for rate limiting or delay nodes
    const hasRateLimit = nodeTypes.includes('n8n-nodes-base.wait') || 
                        nodeTypes.includes('n8n-nodes-base.function');

    if (!hasRateLimit) {
      this.warnings.push(`Enhanced workflow should include rate limiting in ${filePath}`);
    }
  }

  /**
   * Get validation results
   */
  getResults() {
    return {
      errors: this.errors,
      warnings: this.warnings,
      isValid: this.errors.length === 0
    };
  }

  /**
   * Print validation results
   */
  printResults(filePath) {
    console.log(`\n📋 Validation Results for ${path.basename(filePath)}:`);
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✅ All validations passed!');
      return;
    }

    if (this.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.errors.forEach(error => console.log(`   • ${error}`));
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      this.warnings.forEach(warning => console.log(`   • ${warning}`));
    }

    console.log(`\n📊 Summary: ${this.errors.length} errors, ${this.warnings.length} warnings`);
  }
}

/**
 * Main validation function
 */
function validateAllWorkflows() {
  const flowsDir = path.join(__dirname, '..', 'flows');
  let allValid = true;
  let totalErrors = 0;
  let totalWarnings = 0;

  console.log('🔍 Starting comprehensive workflow validation...\n');

  if (!fs.existsSync(flowsDir)) {
    console.error('❌ Flows directory not found');
    process.exit(1);
  }

  const workflowFiles = fs.readdirSync(flowsDir)
    .filter(file => file.endsWith('.json'))
    .map(file => path.join(flowsDir, file));

  if (workflowFiles.length === 0) {
    console.warn('⚠️  No workflow JSON files found in flows directory');
    process.exit(1);
  }

  workflowFiles.forEach(filePath => {
    const validator = new WorkflowValidator();
    const isValid = validator.validateWorkflow(filePath);
    const results = validator.getResults();

    validator.printResults(filePath);

    if (!isValid) {
      allValid = false;
    }

    totalErrors += results.errors.length;
    totalWarnings += results.warnings.length;
  });

  // Final summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 VALIDATION SUMMARY');
  console.log('='.repeat(50));
  console.log(`Files validated: ${workflowFiles.length}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log(`Total warnings: ${totalWarnings}`);
  console.log(`Overall status: ${allValid ? '✅ PASSED' : '❌ FAILED'}`);

  if (!allValid) {
    console.log('\n💡 Fix all errors before proceeding with deployment');
    process.exit(1);
  } else {
    console.log('\n🎉 All workflow validations passed successfully!');
  }
}

// Run validation if called directly
if (require.main === module) {
  validateAllWorkflows();
}

module.exports = { WorkflowValidator, validateAllWorkflows };