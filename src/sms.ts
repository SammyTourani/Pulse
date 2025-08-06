#!/usr/bin/env node

/**
 * sms-rate-limiter.js - SMS rate limiting utility for Pulse AI Secretary
 * Provides functions for managing SMS rate limits and retry logic
 */

const fs = require('fs');
const path = require('path');

class SMSRateLimiter {
  constructor() {
    this.dailyLimit = parseInt(process.env.SMS_DAILY_LIMIT || '50');
    this.perRunLimit = parseInt(process.env.SMS_PER_RUN_LIMIT || '3');
    this.userPhone = process.env.USER_PHONE_NUMBER;
    this.storageFile = path.join(__dirname, '.sms-counts.json');
  }

  /**
   * Load SMS counts from persistent storage
   */
  loadCounts() {
    try {
      if (fs.existsSync(this.storageFile)) {
        const data = JSON.parse(fs.readFileSync(this.storageFile, 'utf8'));
        return data;
      }
    } catch (error) {
      console.warn('Could not load SMS counts:', error.message);
    }
    return {};
  }

  /**
   * Save SMS counts to persistent storage
   */
  saveCounts(counts) {
    try {
      fs.writeFileSync(this.storageFile, JSON.stringify(counts, null, 2));
    } catch (error) {
      console.error('Could not save SMS counts:', error.message);
    }
  }

  /**
   * Get current daily SMS count
   */
  getDailyCount() {
    const today = new Date().toISOString().split('T')[0];
    const counts = this.loadCounts();
    return counts[today] || 0;
  }

  /**
   * Increment daily SMS count
   */
  incrementDailyCount() {
    const today = new Date().toISOString().split('T')[0];
    const counts = this.loadCounts();
    counts[today] = (counts[today] || 0) + 1;
    
    // Clean up old entries (keep only last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoffDate = sevenDaysAgo.toISOString().split('T')[0];
    
    Object.keys(counts).forEach(date => {
      if (date < cutoffDate) {
        delete counts[date];
      }
    });
    
    this.saveCounts(counts);
    return counts[today];
  }

  /**
   * Check if SMS can be sent based on rate limits
   */
  canSendSMS() {
    // Check if user phone is configured
    if (!this.userPhone) {
      return {
        allowed: false,
        reason: 'USER_PHONE_NUMBER not configured',
        dailyCount: 0,
        dailyLimit: this.dailyLimit
      };
    }

    // Check daily limit
    const dailyCount = this.getDailyCount();
    if (dailyCount >= this.dailyLimit) {
      return {
        allowed: false,
        reason: 'Daily SMS limit reached',
        dailyCount: dailyCount,
        dailyLimit: this.dailyLimit
      };
    }

    return {
      allowed: true,
      dailyCount: dailyCount,
      dailyLimit: this.dailyLimit
    };
  }

  /**
   * Record SMS sending attempt
   */
  recordSMSSent() {
    const newCount = this.incrementDailyCount();
    console.log('SMS sent, daily count updated:', {
      dailyCount: newCount,
      dailyLimit: this.dailyLimit,
      timestamp: new Date().toISOString()
    });
    return newCount;
  }

  /**
   * Get current status
   */
  getStatus() {
    const dailyCount = this.getDailyCount();
    return {
      dailyCount: dailyCount,
      dailyLimit: this.dailyLimit,
      perRunLimit: this.perRunLimit,
      userPhone: this.userPhone ? this.userPhone.replace(/.(?=.{4})/g, '*') : null,
      canSend: dailyCount < this.dailyLimit && !!this.userPhone
    };
  }

  /**
   * Reset daily count (for testing)
   */
  resetDailyCount() {
    const today = new Date().toISOString().split('T')[0];
    const counts = this.loadCounts();
    delete counts[today];
    this.saveCounts(counts);
    console.log('Daily SMS count reset for', today);
  }
}

/**
 * SMS Retry Logic
 */
class SMSRetryHandler {
  constructor(twilioClient) {
    this.twilioClient = twilioClient;
    this.maxRetries = 1; // Requirement 3.4: retry once
    this.retryDelay = 30000; // 30 seconds
  }

  /**
   * Send SMS with retry logic
   */
  async sendSMSWithRetry(message, toPhone, fromPhone) {
    let lastError = null;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`SMS attempt ${attempt + 1}/${this.maxRetries + 1}:`, {
          to: toPhone.replace(/.(?=.{4})/g, '*'),
          messageLength: message.length,
          timestamp: new Date().toISOString()
        });

        // Simulate Twilio API call (replace with actual Twilio client)
        const result = await this.simulateTwilioSend(message, toPhone, fromPhone);
        
        console.log('SMS sent successfully:', {
          sid: result.sid,
          status: result.status,
          attempt: attempt + 1,
          timestamp: new Date().toISOString()
        });
        
        return {
          success: true,
          sid: result.sid,
          status: result.status,
          attempt: attempt + 1
        };
        
      } catch (error) {
        lastError = error;
        console.error(`SMS attempt ${attempt + 1} failed:`, {
          error: error.message,
          attempt: attempt + 1,
          timestamp: new Date().toISOString()
        });
        
        // If this is not the last attempt, wait before retrying
        if (attempt < this.maxRetries) {
          console.log(`Waiting ${this.retryDelay}ms before retry...`);
          await this.delay(this.retryDelay);
        }
      }
    }
    
    // All attempts failed
    console.error('SMS sending failed after all retries:', {
      attempts: this.maxRetries + 1,
      finalError: lastError?.message,
      timestamp: new Date().toISOString()
    });
    
    return {
      success: false,
      error: lastError?.message || 'Unknown error',
      attempts: this.maxRetries + 1
    };
  }

  /**
   * Simulate Twilio API call (replace with actual implementation)
   */
  async simulateTwilioSend(message, toPhone, fromPhone) {
    // Simulate network delay
    await this.delay(Math.random() * 1000 + 500);
    
    // Simulate occasional failures for testing
    if (Math.random() < 0.1) { // 10% failure rate for testing
      throw new Error('Simulated Twilio API error');
    }
    
    return {
      sid: 'SM' + Math.random().toString(36).substr(2, 32),
      status: 'sent',
      to: toPhone,
      from: fromPhone,
      body: message
    };
  }

  /**
   * Delay utility
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI interface
if (require.main === module) {
  const rateLimiter = new SMSRateLimiter();
  const command = process.argv[2];
  
  switch (command) {
    case 'status':
      console.log('SMS Rate Limiter Status:');
      console.log(JSON.stringify(rateLimiter.getStatus(), null, 2));
      break;
      
    case 'check':
      const canSend = rateLimiter.canSendSMS();
      console.log('Can send SMS:', canSend.allowed);
      if (!canSend.allowed) {
        console.log('Reason:', canSend.reason);
      }
      console.log('Daily count:', canSend.dailyCount, '/', canSend.dailyLimit);
      break;
      
    case 'reset':
      rateLimiter.resetDailyCount();
      break;
      
    case 'test':
      const retryHandler = new SMSRetryHandler();
      retryHandler.sendSMSWithRetry(
        'Test message from Pulse AI Secretary',
        process.env.USER_PHONE_NUMBER || '+1234567890',
        process.env.TWILIO_FROM_NUMBER || '+0987654321'
      ).then(result => {
        console.log('Test result:', result);
      });
      break;
      
    default:
      console.log('Usage: node sms-rate-limiter.js <command>');
      console.log('Commands:');
      console.log('  status  - Show current rate limiter status');
      console.log('  check   - Check if SMS can be sent');
      console.log('  reset   - Reset daily SMS count');
      console.log('  test    - Test SMS sending with retry logic');
  }
}

module.exports = { SMSRateLimiter, SMSRetryHandler };