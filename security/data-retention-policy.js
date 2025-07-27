/**
 * Data Retention and Privacy Policy Implementation
 * Manages data lifecycle and privacy compliance
 * Requirements: 2.3, 2.4
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Data retention policies for different data types
 * Defines how long different types of data should be kept
 */
const DATA_RETENTION_POLICIES = {
  // Email processing data
  emailContent: {
    retention: '7d', // Keep email content for 7 days
    purgeAfter: '30d', // Hard delete after 30 days
    encrypted: true,
    backupAllowed: false
  },
  
  // Workflow execution logs
  executionLogs: {
    retention: '30d', // Keep execution logs for 30 days
    purgeAfter: '90d', // Hard delete after 90 days
    encrypted: false, // Logs are already sanitized
    backupAllowed: true
  },
  
  // API response data
  apiResponses: {
    retention: '24h', // Keep API responses for 24 hours
    purgeAfter: '7d', // Hard delete after 7 days
    encrypted: true,
    backupAllowed: false
  },
  
  // Draft email content
  draftContent: {
    retention: '7d', // Keep drafts for 7 days
    purgeAfter: '30d', // Hard delete after 30 days
    encrypted: true,
    backupAllowed: false
  },
  
  // SMS notification data
  smsData: {
    retention: '24h', // Keep SMS data for 24 hours
    purgeAfter: '7d', // Hard delete after 7 days
    encrypted: true,
    backupAllowed: false
  },
  
  // Error logs and debugging data
  errorLogs: {
    retention: '90d', // Keep error logs for 90 days
    purgeAfter: '365d', // Hard delete after 1 year
    encrypted: false, // Error logs are sanitized
    backupAllowed: true
  },
  
  // Security audit logs
  securityLogs: {
    retention: '365d', // Keep security logs for 1 year
    purgeAfter: '2555d', // Hard delete after 7 years (compliance)
    encrypted: true,
    backupAllowed: true
  }
};

/**
 * Privacy settings for data handling
 * Defines how personal data should be processed
 */
const PRIVACY_SETTINGS = {
  // Data minimization - only collect necessary data
  dataMinimization: {
    enabled: true,
    collectOnlyNecessary: true,
    stripMetadata: true,
    anonymizeAfter: '30d'
  },
  
  // Data anonymization settings
  anonymization: {
    enabled: true,
    methods: ['hash', 'mask', 'remove'],
    personalDataFields: [
      'email_address',
      'phone_number',
      'full_name',
      'ip_address',
      'user_agent'
    ]
  },
  
  // Data export and portability
  dataPortability: {
    enabled: true,
    formats: ['json', 'csv'],
    includeMetadata: false,
    encryptExports: true
  },
  
  // Right to deletion (GDPR compliance)
  rightToDeletion: {
    enabled: true,
    immediateDelete: true,
    confirmationRequired: true,
    auditTrail: true
  }
};

/**
 * Data retention manager
 * Handles automatic data cleanup and retention policies
 */
class DataRetentionManager {
  constructor() {
    this.policies = DATA_RETENTION_POLICIES;
    this.privacySettings = PRIVACY_SETTINGS;
    this.cleanupSchedule = new Map();
  }

  /**
   * Parse retention period string to milliseconds
   * @param {string} period - Period string (e.g., '7d', '24h', '30d')
   * @returns {number} Milliseconds
   */
  parseRetentionPeriod(period) {
    const units = {
      'h': 60 * 60 * 1000,        // hours
      'd': 24 * 60 * 60 * 1000,   // days
      'w': 7 * 24 * 60 * 60 * 1000, // weeks
      'm': 30 * 24 * 60 * 60 * 1000, // months (approximate)
      'y': 365 * 24 * 60 * 60 * 1000 // years (approximate)
    };

    const match = period.match(/^(\d+)([hdwmy])$/);
    if (!match) {
      throw new Error(`Invalid retention period format: ${period}`);
    }

    const [, amount, unit] = match;
    return parseInt(amount) * units[unit];
  }

  /**
   * Check if data should be retained
   * @param {string} dataType - Type of data
   * @param {Date} createdAt - When data was created
   * @returns {Object} Retention decision
   */
  shouldRetainData(dataType, createdAt) {
    const policy = this.policies[dataType];
    if (!policy) {
      return { retain: false, reason: 'No policy defined' };
    }

    const now = new Date();
    const age = now - createdAt;
    const retentionPeriod = this.parseRetentionPeriod(policy.retention);
    const purgePeriod = this.parseRetentionPeriod(policy.purgeAfter);

    if (age > purgePeriod) {
      return { retain: false, action: 'purge', reason: 'Past purge period' };
    }

    if (age > retentionPeriod) {
      return { retain: false, action: 'archive', reason: 'Past retention period' };
    }

    return { retain: true, reason: 'Within retention period' };
  }

  /**
   * Schedule data cleanup for a specific data type
   * @param {string} dataType - Type of data to clean up
   * @param {Function} cleanupFunction - Function to perform cleanup
   */
  scheduleCleanup(dataType, cleanupFunction) {
    const policy = this.policies[dataType];
    if (!policy) {
      console.warn(`No retention policy for data type: ${dataType}`);
      return;
    }

    const retentionMs = this.parseRetentionPeriod(policy.retention);
    
    // Schedule cleanup to run every hour
    const intervalId = setInterval(async () => {
      try {
        await this.performCleanup(dataType, cleanupFunction);
      } catch (error) {
        console.error(`Cleanup failed for ${dataType}:`, error);
      }
    }, 60 * 60 * 1000); // Every hour

    this.cleanupSchedule.set(dataType, intervalId);
    
    console.log(`Scheduled cleanup for ${dataType} every hour`);
  }

  /**
   * Perform cleanup for a specific data type
   * @param {string} dataType - Type of data to clean up
   * @param {Function} cleanupFunction - Function to perform cleanup
   */
  async performCleanup(dataType, cleanupFunction) {
    const policy = this.policies[dataType];
    const retentionMs = this.parseRetentionPeriod(policy.retention);
    const purgeMs = this.parseRetentionPeriod(policy.purgeAfter);
    
    const now = new Date();
    const retentionCutoff = new Date(now - retentionMs);
    const purgeCutoff = new Date(now - purgeMs);

    console.log(`Starting cleanup for ${dataType}`, {
      retentionCutoff: retentionCutoff.toISOString(),
      purgeCutoff: purgeCutoff.toISOString()
    });

    try {
      const result = await cleanupFunction({
        dataType,
        retentionCutoff,
        purgeCutoff,
        policy
      });

      console.log(`Cleanup completed for ${dataType}`, result);
      
      // Log cleanup activity for audit
      this.logCleanupActivity(dataType, result);
      
    } catch (error) {
      console.error(`Cleanup failed for ${dataType}:`, error);
      throw error;
    }
  }

  /**
   * Log cleanup activity for audit purposes
   * @param {string} dataType - Type of data cleaned up
   * @param {Object} result - Cleanup results
   */
  logCleanupActivity(dataType, result) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      component: 'DataRetention',
      event: 'cleanup_performed',
      dataType: dataType,
      result: result
    };

    console.log(JSON.stringify(auditEntry));
  }

  /**
   * Stop all scheduled cleanups
   */
  stopAllCleanups() {
    for (const [dataType, intervalId] of this.cleanupSchedule) {
      clearInterval(intervalId);
      console.log(`Stopped cleanup schedule for ${dataType}`);
    }
    this.cleanupSchedule.clear();
  }
}

/**
 * Privacy compliance manager
 * Handles privacy-related operations and compliance
 */
class PrivacyComplianceManager {
  constructor() {
    this.settings = PRIVACY_SETTINGS;
  }

  /**
   * Anonymize personal data in a dataset
   * @param {Object} data - Data to anonymize
   * @param {Array} personalFields - Fields containing personal data
   * @returns {Object} Anonymized data
   */
  anonymizeData(data, personalFields = null) {
    if (!this.settings.anonymization.enabled) {
      return data;
    }

    const fieldsToAnonymize = personalFields || this.settings.anonymization.personalDataFields;
    const anonymized = JSON.parse(JSON.stringify(data)); // Deep copy

    for (const field of fieldsToAnonymize) {
      if (this.hasNestedField(anonymized, field)) {
        this.setNestedField(anonymized, field, this.anonymizeValue(
          this.getNestedField(anonymized, field)
        ));
      }
    }

    return anonymized;
  }

  /**
   * Anonymize a single value
   * @param {any} value - Value to anonymize
   * @returns {any} Anonymized value
   */
  anonymizeValue(value) {
    if (typeof value !== 'string') {
      return '[ANONYMIZED]';
    }

    // Email anonymization
    if (value.includes('@')) {
      const [local, domain] = value.split('@');
      return `${local.substring(0, 2)}***@${domain}`;
    }

    // Phone number anonymization
    if (value.match(/^\+?[\d\s\-\(\)]{10,}$/)) {
      return value.substring(0, 4) + '***' + value.substring(value.length - 4);
    }

    // General string anonymization
    if (value.length > 6) {
      return value.substring(0, 3) + '***' + value.substring(value.length - 3);
    }

    return '***';
  }

  /**
   * Check if object has nested field
   * @param {Object} obj - Object to check
   * @param {string} field - Field path (e.g., 'user.email')
   * @returns {boolean} True if field exists
   */
  hasNestedField(obj, field) {
    return field.split('.').reduce((current, key) => {
      return current && current.hasOwnProperty(key) ? current[key] : undefined;
    }, obj) !== undefined;
  }

  /**
   * Get nested field value
   * @param {Object} obj - Object to get from
   * @param {string} field - Field path
   * @returns {any} Field value
   */
  getNestedField(obj, field) {
    return field.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Set nested field value
   * @param {Object} obj - Object to set in
   * @param {string} field - Field path
   * @param {any} value - Value to set
   */
  setNestedField(obj, field, value) {
    const keys = field.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  /**
   * Export user data for portability
   * @param {string} userId - User identifier
   * @param {Function} dataCollector - Function to collect user data
   * @param {string} format - Export format ('json' or 'csv')
   * @returns {Object} Exported data
   */
  async exportUserData(userId, dataCollector, format = 'json') {
    if (!this.settings.dataPortability.enabled) {
      throw new Error('Data portability is disabled');
    }

    try {
      const userData = await dataCollector(userId);
      
      // Remove metadata if not included
      if (!this.settings.dataPortability.includeMetadata) {
        delete userData.metadata;
        delete userData.systemInfo;
      }

      const exportData = {
        exportedAt: new Date().toISOString(),
        userId: userId,
        format: format,
        data: userData
      };

      // Log export activity
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        component: 'PrivacyCompliance',
        event: 'data_exported',
        userId: userId,
        format: format
      }));

      return exportData;

    } catch (error) {
      console.error('Data export failed:', error);
      throw error;
    }
  }

  /**
   * Delete all user data (right to deletion)
   * @param {string} userId - User identifier
   * @param {Function} dataDeleter - Function to delete user data
   * @param {boolean} confirmed - Whether deletion is confirmed
   * @returns {Object} Deletion result
   */
  async deleteUserData(userId, dataDeleter, confirmed = false) {
    if (!this.settings.rightToDeletion.enabled) {
      throw new Error('Right to deletion is disabled');
    }

    if (this.settings.rightToDeletion.confirmationRequired && !confirmed) {
      throw new Error('Deletion confirmation required');
    }

    try {
      const deletionResult = await dataDeleter(userId);
      
      // Create audit trail
      if (this.settings.rightToDeletion.auditTrail) {
        const auditEntry = {
          timestamp: new Date().toISOString(),
          level: 'INFO',
          component: 'PrivacyCompliance',
          event: 'data_deleted',
          userId: userId,
          confirmed: confirmed,
          result: deletionResult
        };

        console.log(JSON.stringify(auditEntry));
      }

      return {
        success: true,
        deletedAt: new Date().toISOString(),
        userId: userId,
        result: deletionResult
      };

    } catch (error) {
      console.error('Data deletion failed:', error);
      throw error;
    }
  }
}

// Export classes and configurations
module.exports = {
  DATA_RETENTION_POLICIES,
  PRIVACY_SETTINGS,
  DataRetentionManager,
  PrivacyComplianceManager
};

// Make available globally for n8n workflows
if (typeof global !== 'undefined') {
  global.DataRetentionManager = DataRetentionManager;
  global.PrivacyComplianceManager = PrivacyComplianceManager;
}