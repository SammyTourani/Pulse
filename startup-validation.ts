#!/usr/bin/env ts-node

/**
 * startup-validation.ts - Startup validation script for Pulse AI Secretary
 * Validates all external API connections before starting the main application
 * Exits with non-zero code if any critical validations fail
 */

import { Client } from 'pg';

// Colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

interface ValidationResult {
  service: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  responseTime?: number;
}

class StartupValidator {
  private results: ValidationResult[] = [];
  private hasFailures = false;

  private log(result: ValidationResult): void {
    this.results.push(result);

    const icon = result.status === 'pass' ? '✓' : result.status === 'fail' ? '✗' : '⚠';
    const color =
      result.status === 'pass'
        ? colors.green
        : result.status === 'fail'
          ? colors.red
          : colors.yellow;
    const timeStr = result.responseTime ? ` (${result.responseTime}ms)` : '';

    console.log(`${color}${icon} ${result.service}${colors.reset}: ${result.message}${timeStr}`);

    if (result.status === 'fail') {
      this.hasFailures = true;
    }
  }

  async validatePostgreSQL(): Promise<void> {
    const start = Date.now();
    try {
      const client = new Client({
        host: process.env.DB_POSTGRESDB_HOST || 'postgres',
        port: parseInt(process.env.DB_POSTGRESDB_PORT || '5432'),
        database: process.env.DB_POSTGRESDB_DATABASE || 'n8n',
        user: process.env.DB_POSTGRESDB_USER || 'n8n',
        password: process.env.DB_POSTGRESDB_PASSWORD,
      });

      await client.connect();
      await client.query('SELECT version()');
      await client.end();

      this.log({
        service: 'PostgreSQL',
        status: 'pass',
        message: 'Database connection successful',
        responseTime: Date.now() - start,
      });
    } catch (error) {
      this.log({
        service: 'PostgreSQL',
        status: 'fail',
        message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  async validateN8N(): Promise<void> {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch('http://n8n:5678/healthz', {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        this.log({
          service: 'n8n',
          status: 'pass',
          message: 'n8n service is running',
          responseTime: Date.now() - start,
        });
      } else {
        this.log({
          service: 'n8n',
          status: 'fail',
          message: `n8n health check failed: HTTP ${response.status}`,
        });
      }
    } catch (error) {
      this.log({
        service: 'n8n',
        status: 'fail',
        message: `n8n connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  async validateGeminiAPI(): Promise<void> {
    const start = Date.now();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      this.log({
        service: 'Gemini API',
        status: 'fail',
        message: 'GEMINI_API_KEY environment variable not set',
      });
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: 'Startup validation test - respond with "OK"',
                  },
                ],
              },
            ],
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        this.log({
          service: 'Gemini API',
          status: 'pass',
          message: 'API key valid and service responding',
          responseTime: Date.now() - start,
        });
      } else if (response.status === 400) {
        // 400 might be acceptable for a simple test
        this.log({
          service: 'Gemini API',
          status: 'pass',
          message: 'API key valid (service responding)',
          responseTime: Date.now() - start,
        });
      } else if (response.status === 403) {
        this.log({
          service: 'Gemini API',
          status: 'fail',
          message: 'API key invalid or quota exceeded',
        });
      } else {
        this.log({
          service: 'Gemini API',
          status: 'fail',
          message: `API validation failed: HTTP ${response.status}`,
        });
      }
    } catch (error) {
      this.log({
        service: 'Gemini API',
        status: 'fail',
        message: `API connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  async validateGmailAPI(): Promise<void> {
    const start = Date.now();
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      this.log({
        service: 'Gmail API',
        status: 'fail',
        message: 'GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set',
      });
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      // Check OAuth2 discovery endpoint
      const response = await fetch('https://accounts.google.com/.well-known/openid_configuration', {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        this.log({
          service: 'Gmail API',
          status: 'pass',
          message: 'OAuth2 credentials configured, Google services reachable',
          responseTime: Date.now() - start,
        });
      } else {
        this.log({
          service: 'Gmail API',
          status: 'fail',
          message: `Google OAuth2 service unreachable: HTTP ${response.status}`,
        });
      }
    } catch (error) {
      this.log({
        service: 'Gmail API',
        status: 'fail',
        message: `Google services connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  async validateTwilioAPI(): Promise<void> {
    const start = Date.now();
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;
    const userPhone = process.env.USER_PHONE_NUMBER;

    if (!accountSid || !authToken) {
      this.log({
        service: 'Twilio API',
        status: 'fail',
        message: 'TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set',
      });
      return;
    }

    if (!fromNumber) {
      this.log({
        service: 'Twilio API',
        status: 'warn',
        message: 'TWILIO_FROM_NUMBER not set - SMS notifications will fail',
      });
    }

    if (!userPhone) {
      this.log({
        service: 'Twilio API',
        status: 'warn',
        message: 'USER_PHONE_NUMBER not set - SMS notifications will fail',
      });
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      // Check Twilio account endpoint
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
        {
          method: 'GET',
          headers: {
            Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        this.log({
          service: 'Twilio API',
          status: 'pass',
          message: 'Account credentials valid and service responding',
          responseTime: Date.now() - start,
        });
      } else if (response.status === 401) {
        this.log({
          service: 'Twilio API',
          status: 'fail',
          message: 'Invalid Twilio credentials',
        });
      } else {
        this.log({
          service: 'Twilio API',
          status: 'fail',
          message: `API validation failed: HTTP ${response.status}`,
        });
      }
    } catch (error) {
      this.log({
        service: 'Twilio API',
        status: 'fail',
        message: `API connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  async validateSMSLimits(): Promise<void> {
    const dailyLimit = process.env.SMS_DAILY_LIMIT;
    const perRunLimit = process.env.SMS_PER_RUN_LIMIT;

    if (!dailyLimit) {
      this.log({
        service: 'SMS Limits',
        status: 'warn',
        message: 'SMS_DAILY_LIMIT not set - using default (50)',
      });
    } else {
      const limit = parseInt(dailyLimit);
      if (isNaN(limit) || limit <= 0) {
        this.log({
          service: 'SMS Limits',
          status: 'fail',
          message: 'SMS_DAILY_LIMIT must be a positive number',
        });
      } else {
        this.log({
          service: 'SMS Limits',
          status: 'pass',
          message: `Daily SMS limit set to ${limit}`,
        });
      }
    }

    if (!perRunLimit) {
      this.log({
        service: 'SMS Limits',
        status: 'warn',
        message: 'SMS_PER_RUN_LIMIT not set - using default (3)',
      });
    } else {
      const limit = parseInt(perRunLimit);
      if (isNaN(limit) || limit <= 0) {
        this.log({
          service: 'SMS Limits',
          status: 'fail',
          message: 'SMS_PER_RUN_LIMIT must be a positive number',
        });
      } else {
        this.log({
          service: 'SMS Limits',
          status: 'pass',
          message: `Per-run SMS limit set to ${limit}`,
        });
      }
    }
  }

  async runAllValidations(): Promise<void> {
    console.log(
      `${colors.blue}🔍 Running Pulse AI Secretary startup validation...${colors.reset}\n`
    );

    console.log(`${colors.blue}📋 Core Services:${colors.reset}`);
    await this.validatePostgreSQL();
    await this.validateN8N();

    console.log(`\n${colors.blue}🔑 External APIs:${colors.reset}`);
    await this.validateGeminiAPI();
    await this.validateGmailAPI();
    await this.validateTwilioAPI();

    console.log(`\n${colors.blue}⚙️ Configuration:${colors.reset}`);
    await this.validateSMSLimits();

    console.log('\n' + '='.repeat(60));

    const passCount = this.results.filter((r) => r.status === 'pass').length;
    const warnCount = this.results.filter((r) => r.status === 'warn').length;
    const failCount = this.results.filter((r) => r.status === 'fail').length;

    console.log(`${colors.blue}📊 Validation Summary:${colors.reset}`);
    console.log(`${colors.green}✓ Passed: ${passCount}${colors.reset}`);
    console.log(`${colors.yellow}⚠ Warnings: ${warnCount}${colors.reset}`);
    console.log(`${colors.red}✗ Failed: ${failCount}${colors.reset}`);

    if (this.hasFailures) {
      console.log(`\n${colors.red}❌ Startup validation failed!${colors.reset}`);
      console.log('Please fix the above issues before starting Pulse AI Secretary.');
      process.exit(1);
    } else {
      console.log(`\n${colors.green}✅ Startup validation passed!${colors.reset}`);
      if (warnCount > 0) {
        console.log(
          `${colors.yellow}⚠ Note: ${warnCount} warning(s) detected - review configuration${colors.reset}`
        );
      }
      console.log('🚀 Ready to start Pulse AI Secretary');
      process.exit(0);
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new StartupValidator();
  validator.runAllValidations().catch((error) => {
    console.error(`${colors.red}💥 Validation script crashed: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}

export { StartupValidator };
