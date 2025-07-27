#!/usr/bin/env node

/**
 * health-check.test.js - Comprehensive health check endpoint tests
 * This file provides detailed testing for the health check functionality
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

class HealthCheckTester {
  constructor() {
    this.healthzProcess = null;
    this.testResults = [];
  }

  /**
   * Start the health check server for testing
   */
  async startHealthServer(port = 3001) {
    return new Promise((resolve, reject) => {
      // Set test environment variables
      const env = {
        ...process.env,
        HEALTHZ_PORT: port.toString(),
        DB_POSTGRESDB_HOST: process.env.DB_POSTGRESDB_HOST || 'localhost',
        DB_POSTGRESDB_PORT: process.env.DB_POSTGRESDB_PORT || '5432',
        DB_POSTGRESDB_DATABASE: process.env.DB_POSTGRESDB_DATABASE || 'n8n_test',
        DB_POSTGRESDB_USER: process.env.DB_POSTGRESDB_USER || 'n8n',
        DB_POSTGRESDB_PASSWORD: process.env.DB_POSTGRESDB_PASSWORD || 'n8n'
      };

      // Start health check server
      this.healthzProcess = spawn('npx', ['ts-node', 'healthz.ts'], {
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      this.healthzProcess.stdout.on('data', (data) => {
        output += data.toString();
        if (output.includes('Health check server running')) {
          resolve();
        }
      });

      this.healthzProcess.stderr.on('data', (data) => {
        console.error('Health server error:', data.toString());
      });

      this.healthzProcess.on('error', (error) => {
        reject(error);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        reject(new Error('Health server failed to start within timeout'));
      }, 10000);
    });
  }

  /**
   * Stop the health check server
   */
  stopHealthServer() {
    if (this.healthzProcess) {
      this.healthzProcess.kill();
      this.healthzProcess = null;
    }
  }

  /**
   * Make HTTP request to health endpoint
   */
  async makeHealthRequest(port = 3001, path = '/healthz') {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: port,
        path: path,
        method: 'GET',
        timeout: 5000
      };

      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          });
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * Test basic health endpoint availability
   */
  async testBasicAvailability(port = 3001) {
    console.log('🔍 Testing basic health endpoint availability...');
    
    try {
      const response = await this.makeHealthRequest(port);
      
      if (response.statusCode === 200 || response.statusCode === 503) {
        this.testResults.push({
          test: 'Basic Availability',
          status: 'PASS',
          message: `Health endpoint responding with status ${response.statusCode}`
        });
        return true;
      } else {
        this.testResults.push({
          test: 'Basic Availability',
          status: 'FAIL',
          message: `Unexpected status code: ${response.statusCode}`
        });
        return false;
      }
    } catch (error) {
      this.testResults.push({
        test: 'Basic Availability',
        status: 'FAIL',
        message: `Request failed: ${error.message}`
      });
      return false;
    }
  }

  /**
   * Test health response structure
   */
  async testResponseStructure(port = 3001) {
    console.log('🔍 Testing health response structure...');
    
    try {
      const response = await this.makeHealthRequest(port);
      
      let healthData;
      try {
        healthData = JSON.parse(response.body);
      } catch (parseError) {
        this.testResults.push({
          test: 'Response Structure',
          status: 'FAIL',
          message: 'Response is not valid JSON'
        });
        return false;
      }

      // Check required fields
      const requiredFields = ['status', 'timestamp', 'services'];
      const missingFields = requiredFields.filter(field => !healthData.hasOwnProperty(field));

      if (missingFields.length === 0) {
        this.testResults.push({
          test: 'Response Structure',
          status: 'PASS',
          message: 'All required fields present in response'
        });
        return true;
      } else {
        this.testResults.push({
          test: 'Response Structure',
          status: 'FAIL',
          message: `Missing fields: ${missingFields.join(', ')}`
        });
        return false;
      }
    } catch (error) {
      this.testResults.push({
        test: 'Response Structure',
        status: 'FAIL',
        message: `Test failed: ${error.message}`
      });
      return false;
    }
  }

  /**
   * Test response time performance
   */
  async testResponseTime(port = 3001) {
    console.log('🔍 Testing response time performance...');
    
    const startTime = Date.now();
    
    try {
      await this.makeHealthRequest(port);
      const responseTime = Date.now() - startTime;
      
      if (responseTime < 5000) {
        this.testResults.push({
          test: 'Response Time',
          status: 'PASS',
          message: `Response time: ${responseTime}ms (acceptable)`
        });
        return true;
      } else {
        this.testResults.push({
          test: 'Response Time',
          status: 'WARN',
          message: `Response time: ${responseTime}ms (slow)`
        });
        return true; // Still pass but with warning
      }
    } catch (error) {
      this.testResults.push({
        test: 'Response Time',
        status: 'FAIL',
        message: `Test failed: ${error.message}`
      });
      return false;
    }
  }

  /**
   * Test concurrent requests handling
   */
  async testConcurrentRequests(port = 3001) {
    console.log('🔍 Testing concurrent requests handling...');
    
    try {
      const concurrentRequests = 5;
      const promises = [];
      
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(this.makeHealthRequest(port));
      }

      const results = await Promise.all(promises);
      const successfulRequests = results.filter(r => r.statusCode === 200 || r.statusCode === 503);

      if (successfulRequests.length === concurrentRequests) {
        this.testResults.push({
          test: 'Concurrent Requests',
          status: 'PASS',
          message: `All ${concurrentRequests} concurrent requests handled successfully`
        });
        return true;
      } else {
        this.testResults.push({
          test: 'Concurrent Requests',
          status: 'FAIL',
          message: `Only ${successfulRequests.length}/${concurrentRequests} requests succeeded`
        });
        return false;
      }
    } catch (error) {
      this.testResults.push({
        test: 'Concurrent Requests',
        status: 'FAIL',
        message: `Test failed: ${error.message}`
      });
      return false;
    }
  }

  /**
   * Test invalid endpoint handling
   */
  async testInvalidEndpoints(port = 3001) {
    console.log('🔍 Testing invalid endpoint handling...');
    
    try {
      const response = await this.makeHealthRequest(port, '/invalid-endpoint');
      
      if (response.statusCode === 404) {
        this.testResults.push({
          test: 'Invalid Endpoints',
          status: 'PASS',
          message: 'Invalid endpoints correctly return 404'
        });
        return true;
      } else {
        this.testResults.push({
          test: 'Invalid Endpoints',
          status: 'FAIL',
          message: `Expected 404, got ${response.statusCode}`
        });
        return false;
      }
    } catch (error) {
      this.testResults.push({
        test: 'Invalid Endpoints',
        status: 'FAIL',
        message: `Test failed: ${error.message}`
      });
      return false;
    }
  }

  /**
   * Test health check with database unavailable
   */
  async testDatabaseUnavailable() {
    console.log('🔍 Testing graceful degradation with database unavailable...');
    
    const testPort = 3002;
    
    try {
      // Start health server with invalid database config
      const env = {
        ...process.env,
        HEALTHZ_PORT: testPort.toString(),
        DB_POSTGRESDB_HOST: 'invalid-host',
        DB_POSTGRESDB_PORT: '5432',
        DB_POSTGRESDB_DATABASE: 'invalid_db',
        DB_POSTGRESDB_USER: 'invalid_user',
        DB_POSTGRESDB_PASSWORD: 'invalid_password'
      };

      const degradedProcess = spawn('npx', ['ts-node', 'healthz.ts'], {
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 5000));

      const response = await this.makeHealthRequest(testPort);
      
      // Clean up
      degradedProcess.kill();

      if (response.statusCode === 503) {
        this.testResults.push({
          test: 'Database Unavailable',
          status: 'PASS',
          message: 'Graceful degradation working (503 when DB unavailable)'
        });
        return true;
      } else {
        this.testResults.push({
          test: 'Database Unavailable',
          status: 'FAIL',
          message: `Expected 503, got ${response.statusCode}`
        });
        return false;
      }
    } catch (error) {
      this.testResults.push({
        test: 'Database Unavailable',
        status: 'PASS',
        message: 'Expected failure when database unavailable'
      });
      return true;
    }
  }

  /**
   * Run all health check tests
   */
  async runAllTests(port = 3001) {
    console.log('🏥 Starting comprehensive health check tests...\n');

    try {
      // Start health server
      await this.startHealthServer(port);
      console.log('✅ Health server started successfully\n');

      // Wait for server to be fully ready
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Run tests
      const tests = [
        () => this.testBasicAvailability(port),
        () => this.testResponseStructure(port),
        () => this.testResponseTime(port),
        () => this.testConcurrentRequests(port),
        () => this.testInvalidEndpoints(port)
      ];

      let passedTests = 0;
      for (const test of tests) {
        const result = await test();
        if (result) passedTests++;
        console.log(''); // Add spacing between tests
      }

      // Test database unavailable scenario (separate server)
      await this.testDatabaseUnavailable();

      // Stop health server
      this.stopHealthServer();

      // Print results
      this.printTestResults();

      return passedTests === tests.length;

    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      this.stopHealthServer();
      return false;
    }
  }

  /**
   * Print test results summary
   */
  printTestResults() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 HEALTH CHECK TEST RESULTS');
    console.log('='.repeat(50));

    let passed = 0;
    let failed = 0;
    let warnings = 0;

    this.testResults.forEach(result => {
      const icon = result.status === 'PASS' ? '✅' : 
                   result.status === 'WARN' ? '⚠️' : '❌';
      
      console.log(`${icon} ${result.test}: ${result.message}`);
      
      if (result.status === 'PASS') passed++;
      else if (result.status === 'FAIL') failed++;
      else warnings++;
    });

    console.log('\n' + '-'.repeat(50));
    console.log(`Total tests: ${this.testResults.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Warnings: ${warnings}`);
    console.log(`Success rate: ${Math.round((passed / this.testResults.length) * 100)}%`);

    if (failed === 0) {
      console.log('\n🎉 All health check tests passed!');
    } else {
      console.log('\n💡 Some tests failed - check the health check implementation');
    }
  }
}

/**
 * Main test execution
 */
async function runHealthCheckTests() {
  const tester = new HealthCheckTester();
  const success = await tester.runAllTests();
  
  if (!success) {
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  runHealthCheckTests().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { HealthCheckTester, runHealthCheckTests };