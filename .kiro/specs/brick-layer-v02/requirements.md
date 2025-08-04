# Requirements Document

## Introduction

The Pulse AI Assistant Brick Layer v0.2 feature transforms the existing single-purpose n8n workflows into a reusable, well-documented library of modular "bricks" for Gmail and Google Calendar operations. This system will provide standardized HTTP endpoints that can be called by AI agents, with robust validation, error handling, and comprehensive testing. The feature builds upon the existing dockerized n8n infrastructure with Gmail OAuth2 and Twilio credentials already configured.

## Requirements

### Requirement 1

**User Story:** As an AI agent developer, I want a standardized brick template system, so that I can understand how to create and document new workflow bricks consistently.

#### Acceptance Criteria

1. WHEN a developer needs to create a new brick THEN the system SHALL provide a brick template at `flows/bricks/README.md` that describes naming rules, input schema, and output schema
2. WHEN reviewing brick documentation THEN each brick SHALL follow lowercase snake_case naming conventions
3. WHEN creating a brick THEN the template SHALL specify required JSON input/output schema format

### Requirement 2

**User Story:** As an AI agent, I want to create email drafts programmatically, so that I can compose emails without manual intervention.

#### Acceptance Criteria

1. WHEN calling the create_email_draft brick THEN the system SHALL accept JSON inputs `{to, subject, body}`
2. WHEN the email draft is successfully created THEN the system SHALL return `{draftId}` in the response
3. WHEN the brick is activated THEN it SHALL be accessible at `POST /webhook-brick/create_email_draft`

### Requirement 3

**User Story:** As an AI agent, I want to summarize recent emails, so that I can provide quick overviews of email activity.

#### Acceptance Criteria

1. WHEN calling the summarize_emails brick THEN the system SHALL accept JSON input `{sinceISO}`
2. WHEN emails are successfully summarized THEN the system SHALL return `{summary}` in the response
3. WHEN the brick is activated THEN it SHALL be accessible at `POST /webhook-brick/summarize_emails`

### Requirement 4

**User Story:** As an AI agent, I want to create calendar events programmatically, so that I can schedule meetings and appointments automatically.

#### Acceptance Criteria

1. WHEN calling the create_calendar_event brick THEN the system SHALL accept JSON inputs `{title, startISO, endISO, guests[]}`
2. WHEN the calendar event is successfully created THEN the system SHALL return `{eventId}` in the response
3. WHEN the brick is activated THEN it SHALL be accessible at `POST /webhook-brick/create_calendar_event`

### Requirement 5

**User Story:** As an AI agent, I want to retrieve today's calendar events, so that I can understand the current day's schedule.

#### Acceptance Criteria

1. WHEN calling the list_todays_events brick THEN the system SHALL accept no input parameters
2. WHEN today's events are successfully retrieved THEN the system SHALL return `[{title,start,end}]` array in the response
3. WHEN the brick is activated THEN it SHALL be accessible at `POST /webhook-brick/list_todays_events`

### Requirement 6

**User Story:** As a system administrator, I want secure authentication for brick endpoints, so that only authorized agents can access the functionality.

#### Acceptance Criteria

1. WHEN accessing any brick endpoint THEN the system SHALL require `X-Pulse-Key` header for authentication
2. WHEN the authentication key is provided THEN the system SHALL validate it against `BRICK_AUTH_KEY` from environment variables
3. WHEN authentication fails THEN the system SHALL return appropriate HTTP error status

### Requirement 7

**User Story:** As an AI agent, I want input validation on all brick calls, so that I receive clear error messages for invalid requests.

#### Acceptance Criteria

1. WHEN sending invalid JSON input to any brick THEN the system SHALL validate input parameters using JSON Schema
2. WHEN input validation fails THEN the system SHALL return HTTP 400 status with JSON error response
3. WHEN validation succeeds THEN the system SHALL process the request normally

### Requirement 8

**User Story:** As an AI agent, I want consistent error handling across all bricks, so that I can reliably parse error responses.

#### Acceptance Criteria

1. WHEN any underlying API error occurs THEN the system SHALL catch the error and return structured JSON response
2. WHEN an error response is returned THEN it SHALL follow the format `{ok: false, error: "description"}`
3. WHEN errors occur THEN the system SHALL never return raw HTML error pages

### Requirement 9

**User Story:** As a developer, I want comprehensive testing for all bricks, so that I can ensure reliability and catch regressions.

#### Acceptance Criteria

1. WHEN running the test suite THEN unit tests SHALL hit each brick's local webhook endpoint
2. WHEN tests execute THEN they SHALL assert HTTP 200 responses and correct JSON structure
3. WHEN tests run in CI THEN they SHALL be executed automatically in GitHub Actions

### Requirement 10

**User Story:** As an API consumer, I want example requests for all bricks, so that I can quickly understand how to integrate with the system.

#### Acceptance Criteria

1. WHEN needing API examples THEN a Postman collection SHALL be available at `docs/Postman_Pulse_Bricks.json`
2. WHEN using the Postman collection THEN it SHALL contain example calls for all four bricks
3. WHEN reviewing documentation THEN the root README.md SHALL include a "Using Bricks" section explaining endpoint usage

### Requirement 11

**User Story:** As a system administrator, I want proper logging and monitoring, so that I can troubleshoot issues without exposing sensitive data.

#### Acceptance Criteria

1. WHEN logging user data THEN the system SHALL censor email addresses as `***@***`
2. WHEN errors occur THEN they SHALL be logged with sufficient detail for debugging
3. WHEN processing requests THEN no PII SHALL be stored in permanent logs

### Requirement 12

**User Story:** As a developer, I want the brick system to integrate with existing infrastructure, so that deployment and maintenance remain consistent.

#### Acceptance Criteria

1. WHEN deploying bricks THEN they SHALL use existing Gmail credentials by reference
2. WHEN new environment variables are needed THEN they SHALL be documented in `.env.example`
3. WHEN the system runs THEN it SHALL integrate with the existing dockerized n8n, Postgres, and Twilio setup