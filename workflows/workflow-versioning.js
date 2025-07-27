#!/usr/bin/env node

/**
 * Workflow Versioning System for Pulse AI Secretary
 * 
 * This script manages workflow versions, backup procedures, and schema validation
 * with comprehensive version control and rollback capabilities.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.8, 3.1, 3.2
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class WorkflowVersionManager {
  constructor() {
    this.workflowsDir = path.join(__dirname, '../flows');
    this.versionsDir = path.join(__dirname, '../versions');
    this.backupsDir = path.join(__dirname, '../backups/workflows');
    this.configFile = path.join(__dirname, 'workflow-config.json');
    this.versionRegistryFile = path.join(this.versionsDir, 'version-registry.json');
    
    // Ensure directories exist
    this.ensureDirectories();
    
    // Load configuration and registry
    this.config = this.loadConfig();
    this.versionRegistry = this.loadVersionRegistry();
  }

  ensureDirectories() {
    [this.workflowsDir, this.versionsDir, this.backupsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      }
    });
  }

  loadConfig() {
    if (!fs.existsSync(this.configFile)) {
      throw new Error(`Configuration file not found: ${this.configFile}`);
    }

    try {
      return JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
    } catch (error) {
      throw new Error(`Failed to parse configuration: ${error.message}`);
    }
  }

  loadVersionRegistry() {
    if (!fs.existsSync(this.versionRegistryFile)) {
      const defaultRegistry = {
        version: "1.0.0",
        workflows: {},
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };
      
      fs.writeFileSync(this.versionRegistryFile, JSON.stringify(defaultRegistry, null, 2));
      console.log(`Created version registry: ${this.versionRegistryFile}`);
      return defaultRegistry;
    }

    try {
      return JSON.parse(fs.readFileSync(this.versionRegistryFile, 'utf8'));
    } catch (error) {
      throw new Error(`Failed to parse version registry: ${error.message}`);
    }
  }

  saveVersionRegistry() {
    this.versionRegistry.lastUpdated = new Date().toISOString();
    fs.writeFileSync(this.versionRegistryFile, JSON.stringify(this.versionRegistry, null, 2));
  }

  /**
   * Calculate file hash for version tracking
   */
  calculateFileHash(filePath) {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Create new version of workflow
   * Requirements: 1.1, 1.2, 1.3, 1.4, 1.8, 3.1, 3.2
   */
  async createVersion(workflowId, options = {}) {
    const {
      message = 'Version created',
      tag = null,
      major = false,
      minor = false,
      patch = true
    } = options;

    console.log(`Creating new version for workflow: ${workflowId}`);

    try {
      // Get workflow configuration
      const workflowConfig = this.config.workflows[workflowId];
      if (!workflowConfig) {
        throw new Error(`Workflow configuration not found: ${workflowId}`);
      }

      const workflowPath = path.join(this.workflowsDir, workflowConfig.file);
      if (!fs.existsSync(workflowPath)) {
        throw new Error(`Workflow file not found: ${workflowPath}`);
      }

      // Calculate file hash
      const fileHash = this.calculateFileHash(workflowPath);

      // Initialize workflow in registry if not exists
      if (!this.versionRegistry.workflows[workflowId]) {
        this.versionRegistry.workflows[workflowId] = {
          name: workflowConfig.name,
          currentVersion: "0.0.0",
          versions: [],
          tags: {},
          createdAt: new Date().toISOString()
        };
      }

      const workflowRegistry = this.versionRegistry.workflows[workflowId];

      // Check if content has changed
      const lastVersion = workflowRegistry.versions[workflowRegistry.versions.length - 1];
      if (lastVersion && lastVersion.hash === fileHash) {
        console.log(`⚠️  No changes detected since version ${lastVersion.version}`);
        return {
          success: false,
          reason: 'no-changes',
          currentVersion: lastVersion.version
        };
      }

      // Calculate new version number
      const currentVersion = workflowRegistry.currentVersion;
      const newVersion = this.calculateNewVersion(currentVersion, { major, minor, patch });

      // Create version directory
      const versionDir = path.join(this.versionsDir, workflowId, newVersion);
      if (!fs.existsSync(versionDir)) {
        fs.mkdirSync(versionDir, { recursive: true });
      }

      // Copy workflow file to version directory
      const versionFilePath = path.join(versionDir, workflowConfig.file);
      fs.copyFileSync(workflowPath, versionFilePath);

      // Load and validate workflow
      const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
      await this.validateWorkflowVersion(workflow, workflowConfig);

      // Create version metadata
      const versionMetadata = {
        version: newVersion,
        workflowId: workflowId,
        file: workflowConfig.file,
        hash: fileHash,
        size: fs.statSync(workflowPath).size,
        message: message,
        tag: tag,
        createdAt: new Date().toISOString(),
        requirements: workflowConfig.requirements,
        dependencies: workflowConfig.dependencies,
        validation: {
          passed: true,
          checkedAt: new Date().toISOString()
        }
      };

      // Save version metadata
      const metadataPath = path.join(versionDir, 'metadata.json');
      fs.writeFileSync(metadataPath, JSON.stringify(versionMetadata, null, 2));

      // Update registry
      workflowRegistry.currentVersion = newVersion;
      workflowRegistry.versions.push(versionMetadata);
      workflowRegistry.lastUpdated = new Date().toISOString();

      // Add tag if specified
      if (tag) {
        workflowRegistry.tags[tag] = newVersion;
      }

      this.saveVersionRegistry();

      console.log(`✅ Version ${newVersion} created successfully`);
      console.log(`   File: ${versionFilePath}`);
      console.log(`   Hash: ${fileHash.substring(0, 12)}...`);
      console.log(`   Size: ${(versionMetadata.size / 1024).toFixed(1)} KB`);

      return {
        success: true,
        version: newVersion,
        hash: fileHash,
        file: versionFilePath,
        metadata: versionMetadata
      };

    } catch (error) {
      console.error(`❌ Version creation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate new version number
   */
  calculateNewVersion(currentVersion, { major, minor, patch }) {
    const parts = currentVersion.split('.').map(Number);
    
    if (major) {
      parts[0]++;
      parts[1] = 0;
      parts[2] = 0;
    } else if (minor) {
      parts[1]++;
      parts[2] = 0;
    } else if (patch) {
      parts[2]++;
    }

    return parts.join('.');
  }

  /**
   * Validate workflow version
   * Requirements: 1.1, 1.2, 1.3, 1.4, 1.8, 3.1, 3.2
   */
  async validateWorkflowVersion(workflow, workflowConfig) {
    console.log('🔍 Validating workflow version...');

    // Basic structure validation
    if (!workflow.name || !workflow.nodes || !Array.isArray(workflow.nodes)) {
      throw new Error('Invalid workflow structure');
    }

    // Validate requirements compliance
    const requirements = workflowConfig.requirements || [];
    const nodeTypes = workflow.nodes.map(n => n.type);

    const requirementValidation = {
      "1.1": () => nodeTypes.includes('n8n-nodes-base.gmailTrigger'),
      "1.2": () => nodeTypes.includes('n8n-nodes-base.code'),
      "1.3": () => nodeTypes.includes('n8n-nodes-base.httpRequest') || 
                   workflow.nodes.some(n => JSON.stringify(n).includes('gemini')),
      "1.4": () => workflow.nodes.some(n => 
        n.type === 'n8n-nodes-base.gmail' && 
        (n.parameters?.resource === 'draft' || n.name.toLowerCase().includes('draft'))
      ),
      "1.8": () => workflow.nodes.some(n => 
        JSON.stringify(n).includes('threadId') || JSON.stringify(n).includes('thread')
      ),
      "3.1": () => nodeTypes.includes('n8n-nodes-base.twilio'),
      "3.2": () => workflow.nodes.some(n => n.name.toLowerCase().includes('sms'))
    };

    const failedRequirements = [];
    requirements.forEach(req => {
      const validator = requirementValidation[req];
      if (validator && !validator()) {
        failedRequirements.push(req);
      }
    });

    if (failedRequirements.length > 0) {
      throw new Error(`Requirements validation failed: ${failedRequirements.join(', ')}`);
    }

    console.log('✅ Workflow version validation passed');
  }

  /**
   * List all versions of a workflow
   */
  listVersions(workflowId) {
    const workflowRegistry = this.versionRegistry.workflows[workflowId];
    if (!workflowRegistry) {
      console.log(`No versions found for workflow: ${workflowId}`);
      return [];
    }

    console.log(`\n📋 Versions for ${workflowId}:`);
    console.log('='.repeat(60));
    console.log(`Current Version: ${workflowRegistry.currentVersion}`);
    console.log(`Total Versions: ${workflowRegistry.versions.length}`);
    console.log('');

    workflowRegistry.versions.forEach((version, index) => {
      const isLatest = index === workflowRegistry.versions.length - 1;
      const tags = Object.entries(workflowRegistry.tags)
        .filter(([tag, ver]) => ver === version.version)
        .map(([tag]) => tag);

      console.log(`${isLatest ? '→' : ' '} ${version.version} ${tags.length > 0 ? `(${tags.join(', ')})` : ''}`);
      console.log(`   Created: ${new Date(version.createdAt).toLocaleString()}`);
      console.log(`   Message: ${version.message}`);
      console.log(`   Hash: ${version.hash.substring(0, 12)}...`);
      console.log(`   Size: ${(version.size / 1024).toFixed(1)} KB`);
      console.log('');
    });

    return workflowRegistry.versions;
  }

  /**
   * Get specific version of workflow
   */
  getVersion(workflowId, version) {
    const workflowRegistry = this.versionRegistry.workflows[workflowId];
    if (!workflowRegistry) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // Handle tag resolution
    if (workflowRegistry.tags[version]) {
      version = workflowRegistry.tags[version];
    }

    const versionData = workflowRegistry.versions.find(v => v.version === version);
    if (!versionData) {
      throw new Error(`Version not found: ${version}`);
    }

    const versionDir = path.join(this.versionsDir, workflowId, version);
    const workflowFile = path.join(versionDir, versionData.file);

    if (!fs.existsSync(workflowFile)) {
      throw new Error(`Version file not found: ${workflowFile}`);
    }

    const workflow = JSON.parse(fs.readFileSync(workflowFile, 'utf8'));
    const metadata = JSON.parse(fs.readFileSync(path.join(versionDir, 'metadata.json'), 'utf8'));

    return {
      workflow,
      metadata,
      file: workflowFile
    };
  }

  /**
   * Rollback to specific version
   */
  async rollbackToVersion(workflowId, targetVersion, options = {}) {
    const { createBackup = true, force = false } = options;

    console.log(`Rolling back ${workflowId} to version ${targetVersion}`);

    try {
      // Get target version
      const versionData = this.getVersion(workflowId, targetVersion);
      
      // Get current workflow path
      const workflowConfig = this.config.workflows[workflowId];
      const currentWorkflowPath = path.join(this.workflowsDir, workflowConfig.file);

      // Create backup of current version if requested
      if (createBackup && fs.existsSync(currentWorkflowPath)) {
        await this.createBackupBeforeRollback(workflowId, currentWorkflowPath);
      }

      // Copy target version to current location
      fs.copyFileSync(versionData.file, currentWorkflowPath);

      // Update registry
      const workflowRegistry = this.versionRegistry.workflows[workflowId];
      workflowRegistry.currentVersion = versionData.metadata.version;
      workflowRegistry.lastRollback = {
        to: targetVersion,
        at: new Date().toISOString(),
        reason: 'Manual rollback'
      };

      this.saveVersionRegistry();

      console.log(`✅ Rollback completed successfully`);
      console.log(`   Current version: ${targetVersion}`);
      console.log(`   File: ${currentWorkflowPath}`);

      return {
        success: true,
        version: targetVersion,
        file: currentWorkflowPath
      };

    } catch (error) {
      console.error(`❌ Rollback failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create backup before rollback
   */
  async createBackupBeforeRollback(workflowId, workflowPath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${workflowId}_pre_rollback_${timestamp}.json`;
    const backupPath = path.join(this.backupsDir, backupName);

    fs.copyFileSync(workflowPath, backupPath);
    console.log(`📦 Pre-rollback backup created: ${backupName}`);

    return backupPath;
  }

  /**
   * Tag a version
   */
  tagVersion(workflowId, version, tag) {
    const workflowRegistry = this.versionRegistry.workflows[workflowId];
    if (!workflowRegistry) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const versionExists = workflowRegistry.versions.some(v => v.version === version);
    if (!versionExists) {
      throw new Error(`Version not found: ${version}`);
    }

    workflowRegistry.tags[tag] = version;
    this.saveVersionRegistry();

    console.log(`✅ Tagged version ${version} as '${tag}'`);
  }

  /**
   * Compare two versions
   */
  compareVersions(workflowId, version1, version2) {
    const v1Data = this.getVersion(workflowId, version1);
    const v2Data = this.getVersion(workflowId, version2);

    console.log(`\n🔍 Comparing ${workflowId} versions:`);
    console.log('='.repeat(50));
    console.log(`Version ${version1} vs Version ${version2}`);
    console.log('');

    // Compare metadata
    console.log('📊 Metadata Comparison:');
    console.log(`   Size: ${(v1Data.metadata.size / 1024).toFixed(1)} KB → ${(v2Data.metadata.size / 1024).toFixed(1)} KB`);
    console.log(`   Created: ${new Date(v1Data.metadata.createdAt).toLocaleString()} → ${new Date(v2Data.metadata.createdAt).toLocaleString()}`);
    console.log(`   Hash: ${v1Data.metadata.hash.substring(0, 12)}... → ${v2Data.metadata.hash.substring(0, 12)}...`);

    // Compare node counts
    const v1Nodes = v1Data.workflow.nodes?.length || 0;
    const v2Nodes = v2Data.workflow.nodes?.length || 0;
    console.log(`   Nodes: ${v1Nodes} → ${v2Nodes} ${v2Nodes > v1Nodes ? '(+' + (v2Nodes - v1Nodes) + ')' : v2Nodes < v1Nodes ? '(-' + (v1Nodes - v2Nodes) + ')' : '(no change)'}`);

    // Compare node types
    const v1Types = new Set(v1Data.workflow.nodes?.map(n => n.type) || []);
    const v2Types = new Set(v2Data.workflow.nodes?.map(n => n.type) || []);
    
    const addedTypes = [...v2Types].filter(t => !v1Types.has(t));
    const removedTypes = [...v1Types].filter(t => !v2Types.has(t));

    if (addedTypes.length > 0) {
      console.log(`   Added node types: ${addedTypes.join(', ')}`);
    }
    if (removedTypes.length > 0) {
      console.log(`   Removed node types: ${removedTypes.join(', ')}`);
    }

    return {
      version1: v1Data,
      version2: v2Data,
      differences: {
        sizeChange: v2Data.metadata.size - v1Data.metadata.size,
        nodeChange: v2Nodes - v1Nodes,
        addedTypes,
        removedTypes
      }
    };
  }

  /**
   * Clean up old versions
   */
  cleanupVersions(workflowId, options = {}) {
    const { keepCount = 10, keepTags = true } = options;

    const workflowRegistry = this.versionRegistry.workflows[workflowId];
    if (!workflowRegistry) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const versions = [...workflowRegistry.versions];
    const taggedVersions = new Set(Object.values(workflowRegistry.tags));

    // Sort by creation date (oldest first)
    versions.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const toDelete = [];
    const toKeep = [];

    versions.forEach((version, index) => {
      const isRecent = index >= versions.length - keepCount;
      const isTagged = keepTags && taggedVersions.has(version.version);
      const isCurrent = version.version === workflowRegistry.currentVersion;

      if (isRecent || isTagged || isCurrent) {
        toKeep.push(version);
      } else {
        toDelete.push(version);
      }
    });

    console.log(`🧹 Cleaning up versions for ${workflowId}:`);
    console.log(`   Total versions: ${versions.length}`);
    console.log(`   To keep: ${toKeep.length}`);
    console.log(`   To delete: ${toDelete.length}`);

    // Delete old version directories
    toDelete.forEach(version => {
      const versionDir = path.join(this.versionsDir, workflowId, version.version);
      if (fs.existsSync(versionDir)) {
        fs.rmSync(versionDir, { recursive: true, force: true });
        console.log(`   Deleted: ${version.version}`);
      }
    });

    // Update registry
    workflowRegistry.versions = toKeep;
    this.saveVersionRegistry();

    console.log(`✅ Cleanup completed`);

    return {
      deleted: toDelete.length,
      kept: toKeep.length
    };
  }
}

// CLI interface
if (require.main === module) {
  const versionManager = new WorkflowVersionManager();
  const command = process.argv[2];
  const workflowId = process.argv[3];
  const param = process.argv[4];

  async function main() {
    try {
      switch (command) {
        case 'create':
          if (!workflowId) {
            console.error('Usage: node workflow-versioning.js create <workflow-id> [message]');
            process.exit(1);
          }
          const message = param || 'Version created';
          await versionManager.createVersion(workflowId, { message });
          break;

        case 'list':
          if (!workflowId) {
            console.error('Usage: node workflow-versioning.js list <workflow-id>');
            process.exit(1);
          }
          versionManager.listVersions(workflowId);
          break;

        case 'rollback':
          if (!workflowId || !param) {
            console.error('Usage: node workflow-versioning.js rollback <workflow-id> <version>');
            process.exit(1);
          }
          await versionManager.rollbackToVersion(workflowId, param);
          break;

        case 'tag':
          const tag = process.argv[5];
          if (!workflowId || !param || !tag) {
            console.error('Usage: node workflow-versioning.js tag <workflow-id> <version> <tag>');
            process.exit(1);
          }
          versionManager.tagVersion(workflowId, param, tag);
          break;

        case 'compare':
          const version2 = process.argv[5];
          if (!workflowId || !param || !version2) {
            console.error('Usage: node workflow-versioning.js compare <workflow-id> <version1> <version2>');
            process.exit(1);
          }
          versionManager.compareVersions(workflowId, param, version2);
          break;

        case 'cleanup':
          if (!workflowId) {
            console.error('Usage: node workflow-versioning.js cleanup <workflow-id>');
            process.exit(1);
          }
          versionManager.cleanupVersions(workflowId);
          break;

        default:
          console.log('Pulse AI Secretary - Workflow Versioning System');
          console.log('');
          console.log('Usage:');
          console.log('  node workflow-versioning.js create <workflow-id> [message]     Create new version');
          console.log('  node workflow-versioning.js list <workflow-id>                List all versions');
          console.log('  node workflow-versioning.js rollback <workflow-id> <version>  Rollback to version');
          console.log('  node workflow-versioning.js tag <workflow-id> <version> <tag> Tag a version');
          console.log('  node workflow-versioning.js compare <workflow-id> <v1> <v2>   Compare versions');
          console.log('  node workflow-versioning.js cleanup <workflow-id>             Clean old versions');
          console.log('');
          console.log('Available workflows:');
          Object.keys(versionManager.config.workflows).forEach(id => {
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

module.exports = { WorkflowVersionManager };