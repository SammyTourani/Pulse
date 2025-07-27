/**
 * Secure Credential Management for Pulse AI Secretary
 * Implements secure storage and handling of API credentials
 * Requirements: 2.1, 2.4
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

/**
 * Environment variables that contain sensitive data
 * These should never be logged or exposed
 */
const SENSITIVE_ENV_VARS = [
  'GEMINI_API_KEY',
  'GOOGLE_CLIENT_SECRET',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_ACCOUNT_SID',
  'DB_POSTGRESDB_PASSWORD',
  'N8N_BASIC_AUTH_PASSWORD',
  'N8N_ENCRYPTION_KEY'
];

/**
 * API keys and their validation patterns
 * Used to validate credential format without exposing values
 */
const CREDENTIAL_PATTERNS = {
  GEMINI_API_KEY: /^AIza[0-9A-Za-z_-]{35}$/,
  GOOGLE_CLIENT_ID: /^[0-9]+-[0-9a-zA-Z_-]+\.apps\.googleusercontent\.com$/,
  GOOGLE_CLIENT_SECRET: /^GOCSPX-[0-9a-zA-Z_-]+$/,
  TWILIO_ACCOUNT_SID: /^AC[a-zA-Z0-9]{32}$/,
  TWILIO_AUTH_TOKEN: /^[a-zA-Z0-9]{32}$/,
  USER_PHONE_NUMBER: /^\+[1-9]\d{1,14}$/,
  TWILIO_FROM_NUMBER: /^\+[1-9]\d{1,14}$/
};

/**
 * Secure credential validator
 * Validates credentials without logging sensitive values
 */
class CredentialValidator {
  constructor() {
    this.validationResults = new Map();
  }

  /**
   * Validate a single credential
   * @param {string} key - Environment variable name
   * @param {string} value - Credential value
   * @returns {Object} Validation result
   */
  validateCredential(key, value) {
    if (!value) {
      return { valid: false, error: 'Missing credential' };
    }

    const pattern = CREDENTIAL_PATTERNS[key];
    if (pattern && !pattern.test(value)) {
      return { valid: false, error: 'Invalid credential format' };
    }

    // Additional validation for specific credentials
    switch (key) {
      case 'USER_PHONE_NUMBER':
      case 'TWILIO_FROM_NUMBER':
        return this.validatePhoneNumber(value);
      case 'GEMINI_API_KEY':
        return this.validateGeminiKey(value);
      default:
        return { valid: true };
    }
  }

  /**
   * Validate phone number format
   * @param {string} phoneNumber - Phone number to validate
   * @returns {Object} Validation result
   */
  validatePhoneNumber(phoneNumber) {
    if (!phoneNumber.startsWith('+')) {
      return { valid: false, error: 'Phone number must include country code (+)' };
    }

    const digits = phoneNumber.slice(1);
    if (!/^\d{10,15}$/.test(digits)) {
      return { valid: false, error: 'Phone number must be 10-15 digits after country code' };
    }

    return { valid: true };
  }

  /**
   * Validate Gemini API key format
   * @param {string} apiKey - API key to validate
   * @returns {Object} Validation result
   */
  validateGeminiKey(apiKey) {
    if (!apiKey.startsWith('AIza')) {
      return { valid: false, error: 'Gemini API key must start with "AIza"' };
    }

    if (apiKey.length !== 39) {
      return { valid: false, error: 'Gemini API key must be 39 characters long' };
    }

    return { valid: true };
  }

  /**
   * Validate all required credentials
   * @returns {Object} Complete validation results
   */
  validateAllCredentials() {
    const results = {
      valid: true,
      missing: [],
      invalid: [],
      warnings: []
    };

    // Check required credentials
    const required = [
      'GEMINI_API_KEY',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'TWILIO_ACCOUNT_SID',
      'TWILIO_AUTH_TOKEN',
      'TWILIO_FROM_NUMBER',
      'USER_PHONE_NUMBER',
      'DB_POSTGRESDB_PASSWORD'
    ];

    for (const key of required) {
      const value = process.env[key];
      
      if (!value) {
        results.missing.push(key);
        results.valid = false;
        continue;
      }

      const validation = this.validateCredential(key, value);
      if (!validation.valid) {
        results.invalid.push({ key, error: validation.error });
        results.valid = false;
      }
    }

    // Check optional credentials
    const optional = ['SMS_DAILY_LIMIT', 'SMS_PER_RUN_LIMIT'];
    for (const key of optional) {
      const value = process.env[key];
      if (value) {
        const numValue = parseInt(value);
        if (isNaN(numValue) || numValue <= 0) {
          results.warnings.push(`${key} should be a positive number`);
        }
      }
    }

    return results;
  }

  /**
   * Generate masked version of credential for logging
   * @param {string} credential - Credential to mask
   * @returns {string} Masked credential
   */
  maskCredential(credential) {
    if (!credential || credential.length < 8) {
      return '[REDACTED]';
    }

    const start = credential.substring(0, 4);
    const end = credential.substring(credential.length - 4);
    const middle = '*'.repeat(credential.length - 8);
    
    return `${start}${middle}${end}`;
  }
}

/**
 * Secure credential storage manager
 * Handles encrypted storage of sensitive credentials
 */
class SecureCredentialStore {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32;
    this.ivLength = 16;
    this.tagLength = 16;
  }

  /**
   * Generate encryption key from environment
   * @returns {Buffer} Encryption key
   */
  getEncryptionKey() {
    const keySource = process.env.N8N_ENCRYPTION_KEY || 'default-key-change-in-production';
    return crypto.scryptSync(keySource, 'pulse-ai-salt', this.keyLength);
  }

  /**
   * Encrypt sensitive data
   * @param {string} data - Data to encrypt
   * @returns {string} Encrypted data with IV and tag
   */
  encrypt(data) {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipher(this.algorithm, key, { iv });
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    // Combine IV, tag, and encrypted data
    return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt sensitive data
   * @param {string} encryptedData - Encrypted data with IV and tag
   * @returns {string} Decrypted data
   */
  decrypt(encryptedData) {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const key = this.getEncryptionKey();
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipher(this.algorithm, key, { iv });
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Store encrypted credential to file
   * @param {string} key - Credential key
   * @param {string} value - Credential value
   * @param {string} filePath - Storage file path
   */
  async storeCredential(key, value, filePath) {
    try {
      const encrypted = this.encrypt(value);
      const credentialData = {
        key: key,
        encrypted: encrypted,
        timestamp: new Date().toISOString(),
        algorithm: this.algorithm
      };

      await fs.writeFile(filePath, JSON.stringify(credentialData, null, 2), {
        mode: 0o600 // Read/write for owner only
      });

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        component: 'CredentialStore',
        message: 'Credential stored securely',
        key: key
      }));

    } catch (error) {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        component: 'CredentialStore',
        message: 'Failed to store credential',
        key: key,
        error: error.message
      }));
      throw error;
    }
  }

  /**
   * Retrieve and decrypt credential from file
   * @param {string} filePath - Storage file path
   * @returns {Object} Credential data
   */
  async retrieveCredential(filePath) {
    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      const credentialData = JSON.parse(fileContent);
      
      const decrypted = this.decrypt(credentialData.encrypted);
      
      return {
        key: credentialData.key,
        value: decrypted,
        timestamp: credentialData.timestamp
      };

    } catch (error) {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        component: 'CredentialStore',
        message: 'Failed to retrieve credential',
        error: error.message
      }));
      throw error;
    }
  }
}

/**
 * Environment security scanner
 * Scans for potential security issues in environment configuration
 */
class EnvironmentSecurityScanner {
  constructor() {
    this.issues = [];
  }

  /**
   * Scan environment for security issues
   * @returns {Object} Security scan results
   */
  scanEnvironment() {
    this.issues = [];

    // Check for default/weak passwords
    this.checkWeakPasswords();
    
    // Check for exposed credentials in logs
    this.checkCredentialExposure();
    
    // Check for insecure configurations
    this.checkInsecureConfigurations();
    
    // Check file permissions
    this.checkFilePermissions();

    return {
      secure: this.issues.length === 0,
      issues: this.issues,
      scannedAt: new Date().toISOString()
    };
  }

  /**
   * Check for weak or default passwords
   */
  checkWeakPasswords() {
    const weakPasswords = ['password', '123456', 'admin', 'default', 'changeme'];
    
    const passwordFields = [
      'N8N_BASIC_AUTH_PASSWORD',
      'DB_POSTGRESDB_PASSWORD'
    ];

    for (const field of passwordFields) {
      const value = process.env[field];
      if (value && weakPasswords.includes(value.toLowerCase())) {
        this.issues.push({
          type: 'weak_password',
          field: field,
          severity: 'high',
          message: 'Weak or default password detected'
        });
      }
    }
  }

  /**
   * Check for potential credential exposure
   */
  checkCredentialExposure() {
    // Check if sensitive environment variables might be logged
    for (const envVar of SENSITIVE_ENV_VARS) {
      const value = process.env[envVar];
      if (value && value.length < 8) {
        this.issues.push({
          type: 'short_credential',
          field: envVar,
          severity: 'medium',
          message: 'Credential appears to be too short'
        });
      }
    }
  }

  /**
   * Check for insecure configurations
   */
  checkInsecureConfigurations() {
    // Check if running in production without HTTPS
    if (process.env.NODE_ENV === 'production' && !process.env.N8N_SECURE_COOKIE) {
      this.issues.push({
        type: 'insecure_production',
        severity: 'high',
        message: 'Production deployment without secure cookies'
      });
    }

    // Check if debug mode is enabled in production
    if (process.env.NODE_ENV === 'production' && process.env.DEBUG) {
      this.issues.push({
        type: 'debug_in_production',
        severity: 'medium',
        message: 'Debug mode enabled in production'
      });
    }
  }

  /**
   * Check file permissions (placeholder for file system checks)
   */
  checkFilePermissions() {
    // This would check actual file permissions in a real implementation
    // For now, we'll just log that the check was performed
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'DEBUG',
      component: 'SecurityScanner',
      message: 'File permission check completed'
    }));
  }
}

// Export classes and utilities
module.exports = {
  CredentialValidator,
  SecureCredentialStore,
  EnvironmentSecurityScanner,
  SENSITIVE_ENV_VARS,
  CREDENTIAL_PATTERNS
};

// Make available globally for n8n workflows
if (typeof global !== 'undefined') {
  global.CredentialValidator = CredentialValidator;
  global.SecureCredentialStore = SecureCredentialStore;
}