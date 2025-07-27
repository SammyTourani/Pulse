# Workflow Management System

This directory contains the comprehensive workflow management system for Pulse AI Secretary, providing export, import, versioning, and deployment health check capabilities.

## Overview

The workflow management system consists of four main components:

1. **Export System** (`export-workflow.js`) - Export n8n workflows with validation
2. **Import System** (`import-workflow.js`) - Import workflows with health checks and rollback
3. **Versioning System** (`workflow-versioning.js`) - Version control and backup management
4. **Health Check System** (`deployment-health-check.js`) - Deployment validation and monitoring

## Requirements Compliance

This system addresses the following requirements:

- **1.1**: Gmail trigger for new messages - Validated in workflow structure
- **1.2**: Email content processing - Verified through node type checking
- **1.3**: Gemini API integration with timeout - Confirmed via API connectivity tests
- **1.4**: Gmail draft creation - Validated through workflow node analysis
- **1.8**: Thread context preservation - Checked for threadId handling
- **3.1**: SMS notification capability - Verified through Twilio integration
- **3.2**: SMS content preparation - Validated through workflow structure

## Quick Start

### 1. Export Current Workflow

```bash
# Export specific workflow
npm run export-workflow export gmail-gemini-sms

# Export all workflows
npm run export-workflow export-all

# List available workflows
npm run export-workflow list
```

### 2. Import Workflow

```bash
# Import with full validation
npm run import-workflow import gmail-gemini-sms

# Dry run (validation only)
npm run import-workflow dry-run gmail-gemini-sms

# Import all workflows
npm run import-workflow import-all
```

### 3. Version Management

```bash
# Create new version
npm run workflow-version create gmail-gemini-sms "Added error handling"

# List versions
npm run workflow-version list gmail-gemini-sms

# Rollback to version
npm run workflow-version rollback gmail-gemini-sms 1.0.0

# Tag a version
npm run workflow-version tag gmail-gemini-sms 1.0.0 stable
```

### 4. Health Checks

```bash
# Run health checks
npm run workflow-health check gmail-gemini-sms

# Generate report
npm run workflow-health report gmail-gemini-sms markdown

# Monitor continuously
npm run workflow-health monitor gmail-gemini-sms
```

## System Architecture

```
workflows/
├── export-workflow.js          # Workflow export system
├── import-workflow.js          # Workflow import and deployment
├── workflow-versioning.js      # Version control system
├── deployment-health-check.js  # Health monitoring system
├── workflow-config.json        # Configuration file
└── README.md                   # This file

../flows/                       # Workflow JSON files
../versions/                    # Version history
../backups/                     # Backup storage
../logs/                        # System logs
```

## Configuration

The system is configured through `workflow-config.json`:

```json
{
  "version": "1.0.0",
  "workflows": {
    "gmail-gemini-sms": {
      "name": "Gmail to Gemini to SMS Workflow",
      "file": "gmail_gemini_sms_workflow_enhanced.json",
      "requirements": ["1.1", "1.2", "1.3", "1.4", "1.8", "3.1", "3.2"],
      "healthChecks": ["gmail-trigger-active", "gemini-api-responsive"]
    }
  }
}
```

## Export System

### Features

- **Schema Validation**: Validates workflow structure before export
- **Credential Handling**: Removes or replaces credentials for security
- **Backup Creation**: Automatic backup before overwriting
- **Version Tracking**: Updates version numbers automatically
- **Requirement Validation**: Ensures workflow meets specified requirements

### Usage

```bash
# Export with backup
node export-workflow.js export gmail-gemini-sms

# Export without backup
node export-workflow.js export gmail-gemini-sms --no-backup

# Validate only
node export-workflow.js validate gmail-gemini-sms
```

### Output

Exported workflows include metadata:

```json
{
  "name": "Gmail to Gemini to SMS Workflow",
  "nodes": [...],
  "meta": {
    "version": "1.0.1",
    "exportedAt": "2024-01-01T12:00:00.000Z",
    "requirements": ["1.1", "1.2", "1.3"],
    "dependencies": {...},
    "exporter": "pulse-workflow-exporter"
  }
}
```

## Import System

### Features

- **Pre-import Validation**: Schema and requirement validation
- **Health Checks**: Post-deployment validation
- **Rollback Capability**: Automatic rollback on failure
- **Credential Management**: Handles credential placeholders
- **Deployment Logging**: Comprehensive deployment logs

### Validation Process

1. **Structure Validation**: JSON schema and node validation
2. **Requirement Compliance**: Checks against specified requirements
3. **Connection Validation**: Validates node connections
4. **Credential Check**: Identifies placeholder credentials

### Health Checks

Post-deployment health checks include:

- **System Checks**: Docker services, n8n API, database
- **Workflow Checks**: Active status, node configuration
- **Integration Checks**: Gmail, Gemini, Twilio APIs
- **Requirement Checks**: Compliance with functional requirements

### Usage

```bash
# Full import with validation
node import-workflow.js import gmail-gemini-sms

# Skip health checks
node import-workflow.js import gmail-gemini-sms --skip-health-check

# Force update existing workflow
node import-workflow.js import gmail-gemini-sms --force
```

## Versioning System

### Features

- **Semantic Versioning**: Major.minor.patch version numbers
- **Hash-based Change Detection**: Only versions when content changes
- **Tag Support**: Named tags for important versions
- **Backup Management**: Automatic cleanup of old versions
- **Version Comparison**: Compare different versions

### Version Storage

```
versions/
└── gmail-gemini-sms/
    ├── 1.0.0/
    │   ├── gmail_gemini_sms_workflow_enhanced.json
    │   └── metadata.json
    ├── 1.0.1/
    │   ├── gmail_gemini_sms_workflow_enhanced.json
    │   └── metadata.json
    └── version-registry.json
```

### Usage

```bash
# Create patch version
node workflow-versioning.js create gmail-gemini-sms

# Create minor version
node workflow-versioning.js create gmail-gemini-sms --minor

# Create major version
node workflow-versioning.js create gmail-gemini-sms --major

# Compare versions
node workflow-versioning.js compare gmail-gemini-sms 1.0.0 1.0.1
```

## Health Check System

### Check Categories

1. **System Checks**
   - Docker services status
   - n8n API connectivity
   - Database connection
   - Environment variables

2. **Workflow Checks**
   - Workflow active status
   - Node configuration
   - Credential validation
   - Connection integrity

3. **Integration Checks**
   - Gmail API connectivity
   - Gemini API responsiveness
   - Twilio SMS capability

4. **Requirement Checks**
   - Functional requirement compliance
   - Node type validation
   - Configuration verification

### Monitoring

Continuous monitoring with configurable intervals:

```bash
# Monitor for 5 minutes with 1-minute intervals
node deployment-health-check.js monitor gmail-gemini-sms
```

### Reports

Generate reports in multiple formats:

```bash
# Console report
node deployment-health-check.js report gmail-gemini-sms console

# Markdown report
node deployment-health-check.js report gmail-gemini-sms markdown

# JSON report
node deployment-health-check.js report gmail-gemini-sms json
```

## Error Handling and Recovery

### Rollback Procedures

1. **Automatic Rollback**: On health check failure
2. **Manual Rollback**: Using version management
3. **Backup Restoration**: From backup registry

### Error Scenarios

- **Import Failure**: Automatic rollback to previous version
- **Health Check Failure**: Alert and rollback option
- **Validation Error**: Detailed error reporting
- **API Connectivity**: Retry logic with exponential backoff

## Logging and Monitoring

### Log Files

- `logs/deployment.log` - Import/export operations
- `logs/health-checks.log` - Health check results
- `backups/backup-registry.json` - Backup tracking

### Log Format

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "info",
  "message": "Workflow imported successfully",
  "data": {
    "workflowId": "gmail-gemini-sms",
    "version": "1.0.1"
  }
}
```

## Security Considerations

### Credential Handling

- Credentials are replaced with placeholders during export
- Sensitive data is filtered from logs
- Environment variables are validated but not logged

### Access Control

- Basic authentication for n8n API access
- File system permissions for backup directories
- Secure credential storage in n8n

## Troubleshooting

### Common Issues

1. **Export Fails**
   - Check workflow file exists
   - Verify configuration file
   - Ensure write permissions

2. **Import Validation Fails**
   - Review requirement compliance
   - Check node configuration
   - Validate JSON structure

3. **Health Checks Fail**
   - Verify environment variables
   - Check service status
   - Review API connectivity

4. **Version Creation Fails**
   - Ensure file changes exist
   - Check version registry
   - Verify directory permissions

### Debug Commands

```bash
# Validate workflow structure
npm run validate-workflow gmail-gemini-sms

# Check environment variables
npm run validate-env

# Test health checks individually
npm run workflow-health check gmail-gemini-sms

# View deployment history
npm run import-workflow history
```

## Development and Extension

### Adding New Workflows

1. Add workflow configuration to `workflow-config.json`
2. Define requirements and health checks
3. Create workflow JSON file in `flows/`
4. Test export/import cycle

### Custom Health Checks

Add new health checks to `deployment-health-check.js`:

```javascript
'custom-check': async () => {
  // Custom validation logic
  return {
    status: 'passed',
    message: 'Custom check passed',
    details: { ... }
  };
}
```

### Extending Requirements

Add new requirement validators to import system:

```javascript
'requirement-X.X': async () => {
  return await this.checkRequirement('X.X', workflowId,
    'Requirement description',
    (workflow) => /* validation logic */
  );
}
```

## Performance Considerations

- **Backup Cleanup**: Automatic cleanup of old versions
- **Log Rotation**: Manual log file management required
- **Health Check Timeout**: Configurable timeout values
- **Concurrent Operations**: Single workflow operations only

## Future Enhancements

- **API Integration**: Direct n8n API integration
- **Webhook Support**: Deployment notifications
- **Metrics Collection**: Performance monitoring
- **Multi-environment**: Development/staging/production
- **Automated Testing**: Workflow execution testing