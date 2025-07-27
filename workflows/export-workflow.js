#!/usr/bin/env node

/**
 * Workflow Export System for Pulse AI Secretary
 * 
 * This script exports n8n workflow configurations as validated JSON files
 * with versioning, backup procedures, and schema validation.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.8, 3.1, 3.2
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Load environment variables from .env file
function loadEnvFile() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#') && trimmedLine.includes('=')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        const value = valueParts.join('=');
        if (key && value && !process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
}

// Load environment variables at startup
loadEnvFile();

class WorkflowExporter {
  constructor() {
    this.workflowsDir = path.join(__dirname, '../flows');
    this.backupsDir = path.join(__dirname, '../backups/workflows');
    this.schemasDir = path.join(__dirname, '../schemas');
    this.configFile = path.join(__dirname, 'workflow-config.json');
    
    // Ensure directories exist
    this.ensureDirectories();
    
    // Load configuration
    this.config = this.loadConfig();
  }

  ensureDirectories() {
    [this.workflowsDir, this.backupsDir, this.schemasDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      }
    });
  }

  loadConfig() {
    const defaultConfig = {
      version: "1.0.0",
      workflows: {
        "gmail-gemini-sms": {
          name: "Gmail to Gemini to SMS Workflow",
          description: "Core email processing workflow with AI response generation",
          file: "gmail_gemini_sms_workflow_enhanced.json",
          version: "1.0.0",
          requirements: ["1.1", "1.2", "1.3", "1.4", "1.8", "3.1", "3.2"],
          dependencies: {
            "gmail": "OAuth2 credentials required",
            "gemini": "API key required",
            "twilio": "API credentials required"
          },
          healthChecks: [
            "gmail-trigger-active",
            "gemini-api-responsive",
            "twilio-sms-enabled"
          ]
        }
      },
      exportSettings: {
        includeCredentials: false,
        includeExecutionData: false,
        validateSchema: true,
        createBackup: true,
        compressionEnabled: false
      }
    };

    if (fs.existsSync(this.configFile)) {
      try {
        const config = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
        return { ...defaultConfig, ...config };
      } catch (error) {
        console.warn(`Warning: Could not load config file, using defaults: ${error.message}`);
        return defaultConfig;
      }
    }

    // Create default config file
    fs.writeFileSync(this.configFile, JSON.stringify(defaultConfig, null, 2));
    console.log(`Created default configuration: ${this.configFile}`);
    return defaultConfig;
  }

  saveConfig() {
    fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2));
  }

  /**
   * Export workflow from n8n instance
   * Requirements: 1.1, 1.2, 1.3, 1.4, 1.8
   */
  async exportWorkflow(workflowId, options = {}) {
    const {
      outputFile = null,
      createBackup = this.config.exportSettings.createBackup,
      validateSchema = this.config.exportSettings.validateSchema,
      includeCredentials = this.config.exportSettings.includeCredentials
    } = options;

    console.log(`Exporting workflow: ${workflowId}`);

    try {
      // Get workflow configuration
      const workflowConfig = this.config.workflows[workflowId];
      if (!workflowConfig) {
        throw new Error(`Workflow configuration not found: ${workflowId}`);
      }

      const outputPath = outputFile || path.join(this.workflowsDir, workflowConfig.file);

      // Create backup if requested
      if (createBackup && fs.existsSync(outputPath)) {
        await this.createBackup(outputPath, workflowId);
      }

      // Export workflow from n8n
      const workflowData = await this.fetchWorkflowFromN8n(workflowId);

      // Process workflow data
      const processedWorkflow = this.processWorkflowData(workflowData, {
        includeCredentials,
        workflowConfig
      });

      // Validate schema if requested
      if (validateSchema) {
        await this.validateWorkflowSchema(processedWorkflow);
      }

      // Write workflow file
      fs.writeFileSync(outputPath, JSON.stringify(processedWorkflow, null, 2));

      // Update version
      this.updateWorkflowVersion(workflowId);

      console.log(`✅ Workflow exported successfully: ${outputPath}`);
      return {
        success: true,
        file: outputPath,
        version: workflowConfig.version,
        size: fs.statSync(outputPath).size
      };

    } catch (error) {
      console.error(`❌ Export failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetch workflow data from n8n instance
   * This would typically use n8n API, but for now we'll use the existing file
   */
  async fetchWorkflowFromN8n(workflowId) {
    const workflowConfig = this.config.workflows[workflowId];
    const workflowPath = path.join(this.workflowsDir, workflowConfig.file);

    if (!fs.existsSync(workflowPath)) {
      throw new Error(`Workflow file not found: ${workflowPath}`);
    }

    try {
      const workflowData = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
      console.log(`Loaded workflow from: ${workflowPath}`);
      return workflowData;
    } catch (error) {
      throw new Error(`Failed to parse workflow JSON: ${error.message}`);
    }
  }

  /**
   * Process workflow data for export
   * Requirements: 1.1, 1.2, 1.3, 1.4, 1.8, 3.1, 3.2
   */
  processWorkflowData(workflowData, options = {}) {
    const { includeCredentials = false, workflowConfig } = options;

    // Create processed copy
    const processed = JSON.parse(JSON.stringify(workflowData));

    // Add metadata
    processed.meta = {
      version: workflowConfig.version,
      exportedAt: new Date().toISOString(),
      requirements: workflowConfig.requirements,
      dependencies: workflowConfig.dependencies,
      healthChecks: workflowConfig.healthChecks,
      exporter: "pulse-workflow-exporter",
      exporterVersion: this.config.version
    };

    // Remove credentials if not included
    if (!includeCredentials && processed.nodes) {
      processed.nodes.forEach(node => {
        if (node.credentials) {
          // Replace with placeholder
          Object.keys(node.credentials).forEach(credType => {
            node.credentials[credType] = {
              id: "CREDENTIAL_PLACEHOLDER",
              name: `${credType} (configure after import)`
            };
          });
        }
      });
    }

    // Remove execution data
    if (processed.nodes) {
      processed.nodes.forEach(node => {
        delete node.executionData;
        delete node.runData;
      });
    }

    // Validate required nodes for requirements
    this.validateRequiredNodes(processed, workflowConfig.requirements);

    return processed;
  }

  /**
   * Validate workflow has required nodes for specified requirements
   * Requirements: 1.1, 1.2, 1.3, 1.4, 1.8, 3.1, 3.2
   */
  validateRequiredNodes(workflow, requirements) {
    const nodeTypes = workflow.nodes ? workflow.nodes.map(n => n.type) : [];
    const nodeNames = workflow.nodes ? workflow.nodes.map(n => n.name) : [];

    const requiredNodes = {
      "1.1": ["n8n-nodes-base.gmailTrigger"], // Gmail trigger
      "1.2": ["n8n-nodes-base.code"], // Email processing
      "1.3": ["n8n-nodes-base.code"], // Gemini API call
      "1.4": ["n8n-nodes-base.gmail"], // Draft creation
      "1.8": ["n8n-nodes-base.gmail"], // Thread preservation
      "3.1": ["n8n-nodes-base.twilio"], // SMS notification
      "3.2": ["n8n-nodes-base.code"] // SMS content preparation
    };

    requirements.forEach(req => {
      const required = requiredNodes[req];
      if (required) {
        const hasRequired = required.some(nodeType => nodeTypes.includes(nodeType));
        if (!hasRequired) {
          console.warn(`⚠️  Warning: Requirement ${req} may not be satisfied - missing node types: ${required.join(', ')}`);
        }
      }
    });

    // Check for specific node configurations
    const gmailTrigger = workflow.nodes?.find(n => n.type === 'n8n-nodes-base.gmailTrigger');
    if (gmailTrigger && requirements.includes('1.1')) {
      if (!gmailTrigger.parameters?.filters?.readStatus) {
        console.warn('⚠️  Warning: Gmail trigger should filter for unread messages (Requirement 1.1)');
      }
    }

    console.log(`✅ Validated ${requirements.length} requirements against workflow nodes`);
  }

  /**
   * Create backup of existing workflow
   */
  async createBackup(filePath, workflowId) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${workflowId}_${timestamp}.json`;
    const backupPath = path.join(this.backupsDir, backupName);

    try {
      fs.copyFileSync(filePath, backupPath);
      console.log(`📦 Backup created: ${backupPath}`);

      // Update backup registry
      this.updateBackupRegistry(workflowId, backupPath);

      return backupPath;
    } catch (error) {
      console.warn(`⚠️  Warning: Could not create backup: ${error.message}`);
      return null;
    }
  }

  updateBackupRegistry(workflowId, backupPath) {
    const registryPath = path.join(this.backupsDir, 'backup-registry.json');
    let registry = {};

    if (fs.existsSync(registryPath)) {
      try {
        registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      } catch (error) {
        console.warn(`Warning: Could not read backup registry: ${error.message}`);
      }
    }

    if (!registry[workflowId]) {
      registry[workflowId] = [];
    }

    registry[workflowId].push({
      path: backupPath,
      createdAt: new Date().toISOString(),
      size: fs.statSync(backupPath).size
    });

    // Keep only last 10 backups per workflow
    if (registry[workflowId].length > 10) {
      const oldBackups = registry[workflowId].splice(0, registry[workflowId].length - 10);
      oldBackups.forEach(backup => {
        try {
          if (fs.existsSync(backup.path)) {
            fs.unlinkSync(backup.path);
            console.log(`🗑️  Cleaned up old backup: ${backup.path}`);
          }
        } catch (error) {
          console.warn(`Warning: Could not clean up backup: ${error.message}`);
        }
      });
    }

    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
  }

  /**
   * Update workflow version
   */
  updateWorkflowVersion(workflowId) {
    const workflowConfig = this.config.workflows[workflowId];
    if (!workflowConfig) return;

    // Increment patch version
    const versionParts = workflowConfig.version.split('.');
    versionParts[2] = (parseInt(versionParts[2]) + 1).toString();
    workflowConfig.version = versionParts.join('.');
    workflowConfig.lastExported = new Date().toISOString();

    this.saveConfig();
    console.log(`📈 Version updated: ${workflowId} -> ${workflowConfig.version}`);
  }

  /**
   * Validate workflow against JSON schema
   */
  async validateWorkflowSchema(workflow) {
    console.log('🔍 Validating workflow schema...');

    // Basic structure validation
    const requiredFields = ['name', 'nodes'];
    const missingFields = requiredFields.filter(field => !workflow[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate nodes structure
    if (!Array.isArray(workflow.nodes)) {
      throw new Error('Workflow nodes must be an array');
    }

    workflow.nodes.forEach((node, index) => {
      if (!node.id || !node.name || !node.type) {
        throw new Error(`Node ${index} missing required fields: id, name, or type`);
      }

      if (!node.position || !Array.isArray(node.position) || node.position.length !== 2) {
        throw new Error(`Node ${node.name} has invalid position format`);
      }
    });

    // Validate connections if present
    if (workflow.connections) {
      Object.keys(workflow.connections).forEach(nodeId => {
        const nodeExists = workflow.nodes.some(n => n.id === nodeId);
        if (!nodeExists) {
          throw new Error(`Connection references non-existent node: ${nodeId}`);
        }
      });
    }

    console.log('✅ Schema validation passed');
  }

  /**
   * List available workflows
   */
  listWorkflows() {
    console.log('\n📋 Available Workflows:');
    console.log('='.repeat(50));

    Object.entries(this.config.workflows).forEach(([id, config]) => {
      console.log(`\n🔧 ${id}`);
      console.log(`   Name: ${config.name}`);
      console.log(`   Version: ${config.version}`);
      console.log(`   File: ${config.file}`);
      console.log(`   Requirements: ${config.requirements.join(', ')}`);
      
      const filePath = path.join(this.workflowsDir, config.file);
      const exists = fs.existsSync(filePath);
      console.log(`   Status: ${exists ? '✅ Available' : '❌ Missing'}`);
      
      if (exists) {
        const stats = fs.statSync(filePath);
        console.log(`   Size: ${(stats.size / 1024).toFixed(1)} KB`);
        console.log(`   Modified: ${stats.mtime.toISOString()}`);
      }
    });

    console.log('\n');
  }

  /**
   * Export all configured workflows
   */
  async exportAll(options = {}) {
    console.log('🚀 Exporting all workflows...\n');

    const results = [];
    const workflowIds = Object.keys(this.config.workflows);

    for (const workflowId of workflowIds) {
      try {
        const result = await this.exportWorkflow(workflowId, options);
        results.push({ workflowId, ...result });
        console.log('');
      } catch (error) {
        results.push({ 
          workflowId, 
          success: false, 
          error: error.message 
        });
        console.log('');
      }
    }

    // Summary
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    console.log('📊 Export Summary:');
    console.log(`   ✅ Successful: ${successful}`);
    console.log(`   ❌ Failed: ${failed}`);

    if (failed > 0) {
      console.log('\n❌ Failed exports:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`   - ${r.workflowId}: ${r.error}`);
      });
    }

    return results;
  }
}

// CLI interface
if (require.main === module) {
  const exporter = new WorkflowExporter();
  const command = process.argv[2];
  const workflowId = process.argv[3];

  async function main() {
    try {
      switch (command) {
        case 'export':
          if (!workflowId) {
            console.error('Usage: node export-workflow.js export <workflow-id>');
            process.exit(1);
          }
          await exporter.exportWorkflow(workflowId);
          break;

        case 'export-all':
          await exporter.exportAll();
          break;

        case 'list':
          exporter.listWorkflows();
          break;

        case 'validate':
          if (!workflowId) {
            console.error('Usage: node export-workflow.js validate <workflow-id>');
            process.exit(1);
          }
          const workflowConfig = exporter.config.workflows[workflowId];
          if (!workflowConfig) {
            throw new Error(`Workflow not found: ${workflowId}`);
          }
          const workflowPath = path.join(exporter.workflowsDir, workflowConfig.file);
          const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
          await exporter.validateWorkflowSchema(workflow);
          console.log('✅ Validation passed');
          break;

        default:
          console.log('Pulse AI Secretary - Workflow Export System');
          console.log('');
          console.log('Usage:');
          console.log('  node export-workflow.js export <workflow-id>    Export specific workflow');
          console.log('  node export-workflow.js export-all              Export all workflows');
          console.log('  node export-workflow.js list                    List available workflows');
          console.log('  node export-workflow.js validate <workflow-id>  Validate workflow schema');
          console.log('');
          console.log('Available workflows:');
          Object.keys(exporter.config.workflows).forEach(id => {
            console.log(`  - ${id}`);
          });
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  }

  main();
}

module.exports = { WorkflowExporter };