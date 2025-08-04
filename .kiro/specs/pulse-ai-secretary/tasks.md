# Implementation Plan

- [x] 1. Set up project foundation and documentation
  - Create comprehensive README.md with elevator pitch, quick-start commands, and Loom/GIF placeholder
  - Document Gmail OAuth 100-user testing-mode limit and setup instructions
  - Create .env.example template with SMS_DAILY_LIMIT and all required API keys
  - _Requirements: 4.3, 6.3, 6.4, 6.6_

- [x] 2. Configure Docker Compose infrastructure
  - Write PostgreSQL service configuration (without pgvector) and persistent volume
  - Configure n8n service to run as user 1000 (non-root) with PostgreSQL backend
  - Set up Docker network configuration and health check configurations
  - Add auto-TLS documentation for Caddy + Let's Encrypt cloud deployment
  - _Requirements: 4.1, 4.2, 4.6, 4.7_

- [x] 3. Create environment validation and health checks
  - Write validate-env.sh script that exits non-zero on missing environment variables
  - Create healthz.ts Express handler returning HTTP 200 with JSON status for n8n and PostgreSQL
  - Enable n8n /metrics endpoint for monitoring integration
  - Implement startup validation for all external API connections
  - _Requirements: 4.4, 4.6, 2.2, 2.4_

- [x] 4. Create core n8n workflow for email processing
  - Design Gmail trigger node for monitoring new inbox messages with HTML-to-text conversion
  - Implement HTTP request node for Gemini API with <3s timeout and token limit tracking
  - Create Set node for extracting Gemini response and handling large attachment skipping
  - Configure Gmail node for creating draft responses with proper threading
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8_

- [x] 5. Implement SMS notification system with guardrails
  - Configure Twilio SMS node with daily cap (SMS_DAILY_LIMIT) and max 3 SMS per run
  - Create message template including "Attachments omitted" note when applicable
  - Implement SMS delivery retry logic and graceful failure handling
  - Add SMS rate limiting validation and logging
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 6. Add comprehensive error handling and logging
  - Implement try-catch blocks with detailed error logging for each workflow node
  - Create exponential backoff for Gemini API rate limiting and token limit handling
  - Add database connection retry mechanisms and workflow-level error handling
  - Configure logging filters to prevent sensitive data exposure
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 7. Implement security and privacy safeguards
  - Configure OAuth2 scopes for minimal Gmail permissions and disable remote credential editing
  - Implement secure credential storage using n8n's encrypted system
  - Add request/response logging filters and data retention policies
  - Configure n8n security settings for production deployment
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 8. Set up enhanced CI/CD pipeline
  - Create GitHub Actions workflow with linting, formatting, and workflow JSON schema validation
  - Implement mocked end-to-end tests using n8n-cli for workflow validation
  - Add build status checks and comprehensive deployment validation
  - Create automated testing for health check endpoints
  - _Requirements: 6.1, 6.2, 6.5_

- [x] 9. Create workflow JSON export and deployment system
  - Export complete n8n workflow configuration as validated JSON file
  - Create import script for automated workflow deployment with validation
  - Add workflow versioning, backup procedures, and schema validation
  - Implement deployment health checks and rollback procedures
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.8, 3.1, 3.2_

- [x] 10. Create operational documentation and monitoring
  - Write step-by-step setup guide with expected command outputs and troubleshooting
  - Document Gemini free-tier limits, SMS rate limits, and monitoring procedures
  - Add production deployment guide with security hardening checklist
  - Create monitoring dashboard configuration for health and performance metrics
  - _Requirements: 6.3, 6.4, 6.6, 6.7_
