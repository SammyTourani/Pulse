# CI/CD Pipeline Documentation

## Overview

The Pulse AI Secretary project uses a comprehensive CI/CD pipeline built with GitHub Actions to ensure code quality, validate workflows, and test system components before deployment.

## Pipeline Structure

### 1. Code Quality Checks (`lint-and-format`)

**Purpose**: Ensures code consistency and quality standards

**Steps**:
- ESLint validation for JavaScript/TypeScript files
- Prettier formatting verification
- TypeScript compilation check

**Requirements Addressed**: 6.1, 6.2

### 2. Workflow Validation (`validate-workflow`)

**Purpose**: Validates n8n workflow JSON files for correctness and completeness

**Features**:
- **Enhanced JSON Schema Validation**: Comprehensive validation using custom test suite
- **Node Structure Verification**: Validates required fields, position formats, and connections
- **Critical Node Type Checking**: Ensures main workflow has required Gmail, Gemini, and SMS nodes
- **Import Validation**: Tests workflow import functionality

**Test Coverage**:
- Basic workflow structure (name, nodes, connections)
- Node validation (ID uniqueness, required fields, position format)
- Connection validation (source/target node existence, connection structure)
- Workflow-specific requirements (Gmail trigger, HTTP request, SMS nodes)

**Requirements Addressed**: 6.2

### 3. Mocked End-to-End Testing (`test-mocked-workflow`)

**Purpose**: Tests complete workflow functionality with mocked external services

**Features**:
- **PostgreSQL Service**: Full database service for testing
- **n8n CLI Integration**: Uses n8n command-line tools for workflow testing
- **Comprehensive Mock Data**: Multiple test scenarios (simple, complex, urgent emails)
- **API Endpoint Mocking**: Simulates Gemini API responses
- **Error Handling Testing**: Validates graceful failure scenarios

**Test Scenarios**:
- Simple email processing
- HTML email conversion to plain text
- Large attachment handling
- Urgent email prioritization
- API failure simulation
- Concurrent request handling

**Requirements Addressed**: 6.2, 6.5

### 4. Environment Validation (`validate-environment`)

**Purpose**: Validates environment configuration and startup scripts

**Features**:
- Tests `validate-env.sh` script with missing variables (should fail)
- Tests script with all required variables (should pass)
- Validates all required environment variables are defined

**Requirements Addressed**: 4.4, 6.3

### 5. Health Check Testing (`health-check-test`)

**Purpose**: Comprehensive testing of health check endpoints and system monitoring

**Features**:
- **Compilation Testing**: TypeScript compilation and linting
- **Startup Validation**: Tests startup validation script
- **Comprehensive Test Suite**: Uses dedicated test framework

**Test Coverage**:
- Basic endpoint availability
- Response structure validation
- Performance testing (response time)
- Concurrent request handling
- Invalid endpoint handling
- Graceful degradation (database unavailable)

**Requirements Addressed**: 4.6, 2.2, 2.4

### 6. Deployment Validation (`deployment-validation`)

**Purpose**: Validates deployment readiness and configuration completeness

**Features**:
- **Docker Compose Validation**: Validates container configurations
- **Environment Template Validation**: Ensures all required variables in `.env.example`
- **Documentation Completeness**: Checks README and security documentation
- **Security Configuration Validation**: Validates security files and syntax
- **Production Readiness**: Tests TypeScript compilation and executable scripts

**Validation Checks**:
- Docker Compose configuration syntax
- Environment variable completeness
- Documentation sections (Quick Start, Setup, Environment, Docker)
- Security file existence and syntax
- Script executability
- Production configuration templates

**Requirements Addressed**: 4.1, 4.2, 4.7, 6.3, 6.4, 6.6

### 7. Build Status Check (`build-status`)

**Purpose**: Provides comprehensive summary of all pipeline results

**Features**:
- **Success Summary**: Detailed breakdown of all completed checks
- **Build Report Generation**: Creates markdown report with metrics
- **Next Steps Guidance**: Provides deployment guidance

**Requirements Addressed**: 6.1, 6.5

## Test Files and Infrastructure

### Workflow Validation (`tests/workflow-validation.test.js`)

Comprehensive workflow validation framework with:
- `WorkflowValidator` class for detailed validation
- Enhanced schema validation beyond basic JSON parsing
- Node-specific configuration validation
- Connection integrity checking
- Workflow-specific requirement validation

### Health Check Testing (`tests/health-check.test.js`)

Comprehensive health check testing framework with:
- `HealthCheckTester` class for systematic testing
- Multiple test scenarios and edge cases
- Performance and concurrency testing
- Graceful degradation validation

### Jest Configuration (`jest.config.js`)

Testing framework configuration with:
- Node.js test environment
- Coverage reporting
- TypeScript support
- Test timeout configuration

## Environment Variables

### Required for CI/CD

```bash
# Database (provided by GitHub Actions services)
DB_POSTGRESDB_HOST=localhost
DB_POSTGRESDB_PORT=5432
DB_POSTGRESDB_DATABASE=n8n_test
DB_POSTGRESDB_USER=n8n
DB_POSTGRESDB_PASSWORD=n8n

# n8n Configuration (test values)
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=test_user
N8N_BASIC_AUTH_PASSWORD=test_password_123

# API Keys (mock values for testing)
GEMINI_API_KEY=test_key_mock_12345
GOOGLE_CLIENT_ID=test_client_id_mock
GOOGLE_CLIENT_SECRET=test_client_secret_mock
TWILIO_ACCOUNT_SID=ACtest_sid_mock
TWILIO_AUTH_TOKEN=test_token_mock
TWILIO_FROM_NUMBER=+15551234567
USER_PHONE_NUMBER=+15559876543

# Rate Limiting
SMS_DAILY_LIMIT=50
SMS_PER_RUN_LIMIT=3

# Health Check
HEALTHZ_PORT=3001
```

## Pipeline Triggers

### Automatic Triggers
- **Push to main/develop**: Full pipeline execution
- **Pull Request to main**: Full pipeline execution for validation

### Manual Triggers
- Can be triggered manually from GitHub Actions interface
- Useful for testing pipeline changes

## Failure Handling

### Error Scenarios
- **Linting Failures**: Pipeline stops, requires code fixes
- **Workflow Validation Failures**: Pipeline stops, requires workflow fixes
- **Test Failures**: Pipeline stops, requires implementation fixes
- **Environment Issues**: Pipeline stops, requires configuration fixes

### Recovery Steps
1. Check job logs for specific error messages
2. Fix identified issues locally
3. Test fixes using npm scripts:
   ```bash
   npm run lint
   npm run test:workflow
   npm run test:health
   npm run validate-env
   ```
4. Commit and push fixes to trigger pipeline re-run

## Local Development

### Running Tests Locally

```bash
# Install dependencies
npm ci

# Run all linting and formatting checks
npm run lint
npm run format:check
npm run type-check

# Run workflow validation
npm run test:workflow

# Run health check tests (requires PostgreSQL)
npm run test:health

# Run environment validation
npm run validate-env

# Run all tests
npm test
```

### Prerequisites for Local Testing
- Node.js 18+
- PostgreSQL (for health check tests)
- All environment variables set (see `.env.example`)

## Monitoring and Metrics

### Pipeline Metrics
- **Success Rate**: Tracked through GitHub Actions
- **Build Duration**: Monitored for performance regression
- **Test Coverage**: Generated by Jest and reported in pipeline

### Key Performance Indicators
- Pipeline completion time < 10 minutes
- Test success rate > 95%
- Zero security vulnerabilities in dependencies

## Security Considerations

### Secrets Management
- No real API keys used in CI/CD
- Mock values for all external service credentials
- Environment variables properly scoped to jobs

### Security Validations
- Syntax checking of security configuration files
- Validation of security documentation
- Environment variable security (no secrets in logs)

## Future Enhancements

### Planned Improvements
- Integration testing with real external services (staging environment)
- Performance benchmarking and regression testing
- Automated security scanning with tools like Snyk
- Deployment automation to staging/production environments
- Slack/email notifications for pipeline failures

### Monitoring Enhancements
- Pipeline performance metrics dashboard
- Test result trending analysis
- Automated dependency updates with testing

## Troubleshooting

### Common Issues

1. **PostgreSQL Connection Failures**
   - Check service configuration in workflow
   - Verify environment variables
   - Ensure proper wait time for service startup

2. **n8n CLI Installation Issues**
   - Check Node.js version compatibility
   - Verify npm cache is working
   - Consider using specific n8n version

3. **Health Check Test Timeouts**
   - Increase wait times in test configuration
   - Check server startup logs
   - Verify port availability

4. **Workflow Validation Failures**
   - Check JSON syntax in workflow files
   - Verify all required node types are present
   - Validate node connections and structure

### Debug Commands

```bash
# Check workflow JSON syntax
node -c flows/gmail_gemini_sms_workflow.json

# Test health check compilation
npx tsc --noEmit healthz.ts

# Validate environment script
chmod +x validate-env.sh && ./validate-env.sh

# Test n8n CLI installation
npx n8n --version
```

## Contributing

### Pipeline Changes
1. Test changes locally first
2. Update documentation if adding new jobs or tests
3. Ensure backward compatibility
4. Add appropriate error handling

### Adding New Tests
1. Follow existing test patterns
2. Include both positive and negative test cases
3. Add proper error messages and logging
4. Update pipeline documentation

This CI/CD pipeline ensures high code quality, comprehensive testing, and deployment readiness for the Pulse AI Secretary project.