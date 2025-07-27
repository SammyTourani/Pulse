# Requirements Document

## Introduction

Pulse is a privacy-first, always-on personal AI secretary that automatically processes incoming Gmail messages, generates intelligent draft responses using Google Gemini, and sends SMS notifications when drafts are ready. The system operates as a thin-slice MVP using Docker Compose with n8n for workflow automation, focusing on seamless email-to-draft-to-notification flow while maintaining user privacy and control.

## Requirements

### Requirement 1

**User Story:** As a busy professional, I want Pulse to automatically detect new Gmail messages and generate intelligent draft responses, so that I can quickly review and send contextually appropriate replies without manually drafting each response.

#### Acceptance Criteria

1. WHEN a new email arrives in Gmail THEN the system SHALL trigger the processing workflow within 30 seconds
2. WHEN processing an email THEN the system SHALL extract the email content and send it to Google Gemini API for response generation
3. **WHEN Gemini generates a response THEN the system SHALL return results within 3 seconds (95th percentile) and respect the free-tier daily token limit of 1 million tokens**
4. WHEN Gemini generates a response THEN the system SHALL create a draft reply in Gmail with the generated content
5. **WHEN processing HTML emails THEN the system SHALL convert to plain text for Gemini processing**
6. **WHEN emails contain large attachments (>1MB) THEN the system SHALL skip attachment processing and include "Attachments omitted" note in SMS**
7. IF the email processing fails THEN the system SHALL log the error and continue monitoring for new emails
8. WHEN a draft is created THEN the system SHALL preserve the original email thread context and reply-to information

### Requirement 2

**User Story:** As a user who values privacy, I want all my email processing to happen through secure, self-hosted infrastructure with encrypted API communications, so that my personal communications remain private and under my control.

#### Acceptance Criteria

1. WHEN the system processes emails THEN it SHALL use OAuth2 authentication for Gmail access without storing passwords
2. WHEN communicating with external APIs THEN the system SHALL use HTTPS encryption for all requests
3. WHEN storing temporary data THEN the system SHALL use local PostgreSQL database with no external data persistence
4. IF API keys are required THEN they SHALL be stored as environment variables and never logged or exposed
5. WHEN the system starts THEN it SHALL validate all required credentials before beginning email monitoring

### Requirement 3

**User Story:** As a user who needs immediate awareness of system activity, I want to receive SMS notifications when draft responses are ready, so that I can quickly review and send important replies without constantly checking my email.

#### Acceptance Criteria

1. WHEN a draft response is successfully created THEN the system SHALL send an SMS notification within 10 seconds
2. WHEN sending SMS notifications THEN the message SHALL include the email subject line and sender information
3. **WHEN sending SMS notifications THEN the system SHALL respect daily SMS cap (env var SMS_DAILY_LIMIT) and maximum 3 SMS per workflow run**
4. IF SMS delivery fails THEN the system SHALL retry once after 30 seconds
5. WHEN multiple drafts are created simultaneously THEN the system SHALL send individual SMS notifications for each
6. IF the user's phone number is not configured THEN the system SHALL log the draft creation without failing

### Requirement 4

**User Story:** As a developer setting up Pulse, I want a simple Docker Compose deployment with clear environment configuration, so that I can get the system running quickly without complex setup procedures.

#### Acceptance Criteria

1. WHEN running `docker compose up` THEN the system SHALL start all required services (PostgreSQL, n8n) successfully
2. **WHEN n8n starts THEN it SHALL run as non-root user (UID 1000) for security**
3. WHEN the system starts THEN it SHALL automatically create necessary database tables and n8n workflow configurations
4. IF environment variables are missing THEN the system SHALL display clear error messages indicating which variables are required
5. WHEN accessing the n8n interface THEN it SHALL be available on localhost:5678 with basic authentication
6. **WHEN the system is running THEN it SHALL provide /healthz endpoint returning HTTP 200 for n8n and PostgreSQL status**
7. **WHEN deployed to cloud THEN the system SHALL support auto-TLS via Caddy and Let's Encrypt for secure access**

### Requirement 5

**User Story:** As a user managing the system, I want comprehensive logging and error handling, so that I can troubleshoot issues and monitor system performance effectively.

#### Acceptance Criteria

1. WHEN any workflow step executes THEN the system SHALL log the action with timestamp and status
2. IF any API call fails THEN the system SHALL log the error details and continue processing other emails
3. WHEN the system encounters rate limits THEN it SHALL implement exponential backoff and retry logic
4. IF database connections fail THEN the system SHALL attempt reconnection with appropriate delays
5. WHEN system resources are low THEN it SHALL log warnings and gracefully handle resource constraints

### Requirement 6

**User Story:** As a developer maintaining Pulse, I want automated CI/CD pipeline and clear documentation, so that I can confidently deploy updates and onboard new contributors.

#### Acceptance Criteria

1. WHEN code is pushed to the repository THEN GitHub Actions SHALL run automated tests and validation
2. **WHEN CI runs THEN it SHALL perform linting, formatting, workflow JSON schema validation, and mocked end-to-end tests via n8n-cli**
3. WHEN setting up the project THEN the README SHALL provide complete setup instructions with expected outputs
4. **WHEN setting up Gmail OAuth THEN the README SHALL document the 100-user testing-mode limit for development**
5. IF the build fails THEN the CI pipeline SHALL provide clear error messages and prevent deployment
6. WHEN new developers join THEN they SHALL be able to run the system locally using only the README instructions
7. WHEN configuration changes are needed THEN the .env.example file SHALL reflect all required variables with descriptions
