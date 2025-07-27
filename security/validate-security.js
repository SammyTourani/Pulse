#!/usr/bin/env node

/**
 * Security Validation Script for Pulse AI Secretary
 * Validates security configuration and compliance
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

const { CredentialValidator, EnvironmentSecurityScanner } = require('./credential-manager.js');
const { SecurityConfigValidator } = require('./n8n-security-config.js');
const { validateOAuthEnvironment } = require('./oauth-config.js');

// Colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

/**
 * Security validation results
 */
class SecurityValidationResults {
  constructor() {
    this.results = [];
    this.hasErrors = false;
    this.hasWarnings = false;
  }

  addResult(category, status, message, details = null) {
    const result = {
      category,
      status, // 'pass', 'fail', 'warn'
      message,
      details,
      timestamp: new Date().toISOString()
    };

    this.results.push(result);

    if (status === 'fail') {
      this.hasErrors = true;
    } else if (status === 'warn') {
      this.hasWarnings = true;
    }

    // Log result
    const icon = status === 'pass' ? '✓' : status === 'fail' ? '✗' : '⚠';
    const color = status === 'pass' ? colors.green : status === 'fail' ? colors.red : colors.yellow;
    
    console.log(`${color}${icon} ${category}${colors.reset}: ${message}`);
    if (details) {
      console.log(`   ${JSON.stringify(details, null, 2)}`);
    }
  }

  getSummary() {
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const warnings = this.results.filter(r => r.status === 'warn').length;

    return {
      total: this.results.length,
      passed,
      failed,
      warnings,
      hasErrors: this.hasErrors,
      hasWarnings: this.hasWarnings
    };
  }
}

/**
 * Main security validator
 */
class SecurityValidator {
  constructor() {
    this.results = new SecurityValidationResults();
    this.credentialValidator = new CredentialValidator();
    this.securityScanner = new EnvironmentSecurityScanner();
    this.configValidator = new SecurityConfigValidator();
  }

  /**
   * Run all security validations
   */
  async runAllValidations() {
    console.log(`${colors.blue}${colors.bold}🔒 Running Pulse AI Secretary Security Validation${colors.reset}\n`);

    // 1. Validate credentials (Requirement 2.1)
    await this.validateCredentials();

    // 2. Validate OAuth configuration (Requirement 2.1)
    await this.validateOAuthConfiguration();

    // 3. Validate HTTPS and encryption (Requirement 2.2)
    await this.validateEncryption();

    // 4. Validate data retention policies (Requirement 2.3)
    await this.validateDataRetention();

    // 5. Validate production security settings (Requirement 2.4)
    await this.validateProductionSecurity();

    // 6. Scan for security issues
    await this.scanSecurityIssues();

    // 7. Validate n8n security configuration
    await this.validateN8NConfiguration();

    // Print summary
    this.printSummary();

    return this.results;
  }

  /**
   * Validate credentials (Requirement 2.1)
   */
  async validateCredentials() {
    console.log(`\n${colors.blue}📋 Credential Validation${colors.reset}`);

    const validation = this.credentialValidator.validateAllCredentials();

    if (validation.valid) {
      this.results.addResult('Credentials', 'pass', 'All required credentials are valid');
    } else {
      if (validation.missing.length > 0) {
        this.results.addResult('Credentials', 'fail', 
          `Missing required credentials: ${validation.missing.join(', ')}`);
      }

      if (validation.invalid.length > 0) {
        for (const invalid of validation.invalid) {
          this.results.addResult('Credentials', 'fail', 
            `Invalid credential ${invalid.key}: ${invalid.error}`);
        }
      }
    }

    if (validation.warnings.length > 0) {
      for (const warning of validation.warnings) {
        this.results.addResult('Credentials', 'warn', warning);
      }
    }
  }

  /**
   * Validate OAuth configuration (Requirement 2.1)
   */
  async validateOAuthConfiguration() {
    console.log(`\n${colors.blue}🔐 OAuth Configuration Validation${colors.reset}`);

    const oauthValidation = validateOAuthEnvironment();

    if (oauthValidation.valid) {
      this.results.addResult('OAuth', 'pass', 'OAuth credentials configured correctly');
    } else {
      this.results.addResult('OAuth', 'fail', 
        `Missing OAuth credentials: ${oauthValidation.missing.join(', ')}`);
    }

    // Check redirect URI configuration
    const redirectUri = process.env.OAUTH_REDIRECT_URI || 'http://localhost:5678/rest/oauth2-credential/callback';
    if (redirectUri.startsWith('http://') && process.env.NODE_ENV === 'production') {
      this.results.addResult('OAuth', 'fail', 
        'OAuth redirect URI uses HTTP in production - should use HTTPS');
    } else {
      this.results.addResult('OAuth', 'pass', 'OAuth redirect URI configured securely');
    }
  }

  /**
   * Validate HTTPS and encryption (Requirement 2.2)
   */
  async validateEncryption() {
    console.log(`\n${colors.blue}🔒 Encryption and HTTPS Validation${colors.reset}`);

    // Check if secure cookies are enabled
    const secureCookies = process.env.N8N_SECURE_COOKIE === 'true';
    if (process.env.NODE_ENV === 'production' && !secureCookies) {
      this.results.addResult('Encryption', 'fail', 
        'Secure cookies not enabled in production');
    } else {
      this.results.addResult('Encryption', 'pass', 'Secure cookies configured correctly');
    }

    // Check encryption key
    const encryptionKey = process.env.N8N_ENCRYPTION_KEY;
    if (!encryptionKey) {
      this.results.addResult('Encryption', 'fail', 
        'N8N_ENCRYPTION_KEY not configured');
    } else if (encryptionKey.length < 32) {
      this.results.addResult('Encryption', 'fail', 
        'N8N_ENCRYPTION_KEY too short (minimum 32 characters)');
    } else {
      this.results.addResult('Encryption', 'pass', 'Encryption key configured securely');
    }

    // Check SSL/TLS configuration
    const protocol = process.env.N8N_PROTOCOL || 'http';
    if (process.env.NODE_ENV === 'production' && protocol !== 'https') {
      this.results.addResult('Encryption', 'warn', 
        'n8n protocol not set to HTTPS in production');
    } else {
      this.results.addResult('Encryption', 'pass', 'Protocol configured for secure communication');
    }
  }

  /**
   * Validate data retention policies (Requirement 2.3)
   */
  async validateDataRetention() {
    console.log(`\n${colors.blue}🗄️ Data Retention Validation${colors.reset}`);

    // Check if data pruning is enabled
    const dataPrune = process.env.EXECUTIONS_DATA_PRUNE === 'true';
    if (!dataPrune) {
      this.results.addResult('Data Retention', 'warn', 
        'Execution data pruning not enabled - data will accumulate');
    } else {
      this.results.addResult('Data Retention', 'pass', 'Data pruning enabled');
    }

    // Check data retention period
    const maxAge = parseInt(process.env.EXECUTIONS_DATA_MAX_AGE || '168');
    if (maxAge > 720) { // 30 days
      this.results.addResult('Data Retention', 'warn', 
        `Data retention period is very long (${maxAge} hours)`);
    } else {
      this.results.addResult('Data Retention', 'pass', 
        `Data retention period configured (${maxAge} hours)`);
    }

    // Check binary data TTL
    const binaryTTL = parseInt(process.env.N8N_BINARY_DATA_TTL || '24');
    if (binaryTTL > 168) { // 7 days
      this.results.addResult('Data Retention', 'warn', 
        `Binary data TTL is very long (${binaryTTL} hours)`);
    } else {
      this.results.addResult('Data Retention', 'pass', 
        `Binary data TTL configured (${binaryTTL} hours)`);
    }

    // Check if telemetry is disabled
    const diagnostics = process.env.N8N_DIAGNOSTICS_ENABLED !== 'false';
    if (diagnostics) {
      this.results.addResult('Data Retention', 'warn', 
        'n8n diagnostics/telemetry not explicitly disabled');
    } else {
      this.results.addResult('Data Retention', 'pass', 'Telemetry disabled for privacy');
    }
  }

  /**
   * Validate production security settings (Requirement 2.4)
   */
  async validateProductionSecurity() {
    console.log(`\n${colors.blue}🏭 Production Security Validation${colors.reset}`);

    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
      // Check if UI is disabled
      const uiDisabled = process.env.N8N_DISABLE_UI === 'true';
      if (!uiDisabled) {
        this.results.addResult('Production Security', 'fail', 
          'n8n UI not disabled in production');
      } else {
        this.results.addResult('Production Security', 'pass', 'n8n UI disabled in production');
      }

      // Check basic auth
      const basicAuth = process.env.N8N_BASIC_AUTH_ACTIVE === 'true';
      if (!basicAuth) {
        this.results.addResult('Production Security', 'fail', 
          'Basic authentication not enabled');
      } else {
        this.results.addResult('Production Security', 'pass', 'Basic authentication enabled');
      }

      // Check password strength
      const password = process.env.N8N_BASIC_AUTH_PASSWORD;
      if (password && password.length < 12) {
        this.results.addResult('Production Security', 'warn', 
          'Basic auth password should be at least 12 characters');
      } else if (password) {
        this.results.addResult('Production Security', 'pass', 'Basic auth password is strong');
      }

    } else {
      this.results.addResult('Production Security', 'warn', 
        'Not running in production mode - some security checks skipped');
    }

    // Check if metrics are enabled for monitoring
    const metrics = process.env.N8N_METRICS === 'true';
    if (!metrics) {
      this.results.addResult('Production Security', 'warn', 
        'Metrics not enabled - monitoring will be limited');
    } else {
      this.results.addResult('Production Security', 'pass', 'Metrics enabled for monitoring');
    }
  }

  /**
   * Scan for security issues
   */
  async scanSecurityIssues() {
    console.log(`\n${colors.blue}🔍 Security Issue Scan${colors.reset}`);

    const scanResults = this.securityScanner.scanEnvironment();

    if (scanResults.secure) {
      this.results.addResult('Security Scan', 'pass', 'No security issues detected');
    } else {
      for (const issue of scanResults.issues) {
        const status = issue.severity === 'high' ? 'fail' : 'warn';
        this.results.addResult('Security Scan', status, 
          `${issue.type}: ${issue.message}`, { field: issue.field });
      }
    }
  }

  /**
   * Validate n8n security configuration
   */
  async validateN8NConfiguration() {
    console.log(`\n${colors.blue}⚙️ n8n Security Configuration${colors.reset}`);

    const configValidation = this.configValidator.validateConfiguration();

    if (configValidation.valid) {
      this.results.addResult('n8n Config', 'pass', 'n8n security configuration is valid');
    } else {
      for (const error of configValidation.errors) {
        this.results.addResult('n8n Config', 'fail', error);
      }
    }

    for (const warning of configValidation.warnings) {
      this.results.addResult('n8n Config', 'warn', warning);
    }
  }

  /**
   * Print validation summary
   */
  printSummary() {
    const summary = this.results.getSummary();

    console.log('\n' + '='.repeat(60));
    console.log(`${colors.blue}${colors.bold}📊 Security Validation Summary${colors.reset}`);
    console.log(`${colors.green}✓ Passed: ${summary.passed}${colors.reset}`);
    console.log(`${colors.yellow}⚠ Warnings: ${summary.warnings}${colors.reset}`);
    console.log(`${colors.red}✗ Failed: ${summary.failed}${colors.reset}`);

    if (summary.hasErrors) {
      console.log(`\n${colors.red}❌ Security validation failed!${colors.reset}`);
      console.log('Please fix the above security issues before deploying to production.');
      process.exit(1);
    } else {
      console.log(`\n${colors.green}✅ Security validation passed!${colors.reset}`);
      if (summary.hasWarnings) {
        console.log(`${colors.yellow}⚠ Note: ${summary.warnings} warning(s) detected - review recommended${colors.reset}`);
      }
      console.log('🔒 Pulse AI Secretary is configured securely');
      process.exit(0);
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new SecurityValidator();
  validator.runAllValidations().catch((error) => {
    console.error(`${colors.red}💥 Security validation crashed: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}

module.exports = { SecurityValidator, SecurityValidationResults };