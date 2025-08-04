# Implementation Plan

- [x] 1. Set up brick infrastructure and shared sub-workflows
  - Create brick template documentation and folder structure
  - Implement three shared sub-workflows for authentication, validation, and response formatting
  - Add new environment variables to configuration
  - _Requirements: 1.1, 12.2_

- [x] 1.1 Create brick template documentation
  - Write `flows/bricks/README.md` with naming conventions, input/output schema format, and development guidelines
  - Document the standardized brick workflow structure and required sub-workflow calls
  - Document MOCK_MODE behavior and testing approach
  - _Requirements: 1.1_

- [x] 1.2 Create brick_auth_guard sub-workflow
  - Create `flows/bricks/brick_auth_guard.json` as callable sub-workflow
  - Check X-Pulse-Key header against BRICK_AUTH_KEY environment variable
  - Return 401 JSON response with `{ok: false, error: "Unauthorized", code: "AUTH_FAILED"}` if invalid
  - Implement daily rate limiting per API key using n8n workflow static data
  - Return 429 JSON response with `{ok: false, error: "Rate limit exceeded", code: "RATE_LIMITED"}` when daily cap exceeded
  - _Requirements: 6.1, 6.2, 7.1, 8.2_

- [x] 1.3 Create brick_validate sub-workflow
  - Create `flows/bricks/brick_validate.json` as callable sub-workflow
  - Implement plain JavaScript field validation (types, required fields, ISO date formats)
  - Accept brick name and input data as parameters
  - Return 400 JSON response with detailed validation errors on failure
  - Support different validation schemas per brick type
  - _Requirements: 7.1, 7.2, 8.2_

- [x] 1.4 Create brick_respond sub-workflow
  - Create `flows/bricks/brick_respond.json` as callable sub-workflow
  - Implement standardized response envelope: `{ok, data|error, brick, timestamp, requestId}`
  - Generate unique requestId for each response
  - Handle both success and error response formatting
  - Implement privacy-compliant logging with email masking as `***@***`
  - _Requirements: 8.2, 11.1, 11.2_

- [x] 1.5 Update environment configuration
  - Add `BRICK_AUTH_KEY`, `MOCK_MODE`, `BRICK_RATE_LIMIT_REQUESTS` to `.env.example`
  - Add `GEMINI_DEFAULT_MODEL=gemini-1.5-flash-latest`, `GENERIC_TIMEZONE=UTC`, `GOOGLE_CALENDAR_ID=primary`
  - Update docker-compose.yml to pass all brick configuration environment variables
  - _Requirements: 6.2, 12.2_

- [x] 2. Implement create_email_draft brick
  - Create workflow with webhook trigger and sub-workflow calls
  - Implement MOCK_MODE support for testing
  - Extract and adapt Gmail draft creation logic from existing workflow
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 2.1 Create create_email_draft workflow structure
  - Create new n8n workflow file `flows/bricks/create_email_draft.json`
  - Add webhook trigger node configured for POST `/webhook-brick/create_email_draft`
  - Add "Call Workflow" trigger for internal use (non-HTTP calls)
  - Call brick_auth_guard, brick_validate, and brick_respond sub-workflows in sequence
  - _Requirements: 2.3, 6.1, 6.2_

- [x] 2.2 Implement create_email_draft validation and mock mode
  - Configure brick_validate call with schema for required fields: to, subject, body
  - Implement MOCK_MODE check - return canned response `{draftId: "mock-draft-123"}` when enabled
  - Add email address format validation and input sanitization
  - _Requirements: 2.1, 7.1, 7.2_

- [x] 2.3 Implement create_email_draft business logic
  - Extract and adapt Gmail draft creation logic from existing workflow
  - Use existing Gmail OAuth2 credentials by reference
  - Handle Gmail API errors and return appropriate 5xx responses
  - Return structured response with draftId via brick_respond sub-workflow
  - _Requirements: 2.2, 12.1_

- [x] 3. Implement summarize_emails brick
  - Create workflow with sub-workflow calls and MOCK_MODE support
  - Extract email fetching and summarization logic from existing workflow
  - Integrate with Gemini API using GEMINI_DEFAULT_MODEL
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3.1 Create summarize_emails workflow structure
  - Create new n8n workflow file `flows/bricks/summarize_emails.json`
  - Add webhook trigger node configured for POST `/webhook-brick/summarize_emails`
  - Add "Call Workflow" trigger for internal use (non-HTTP calls)
  - Call brick_auth_guard, brick_validate, and brick_respond sub-workflows in sequence
  - _Requirements: 3.3, 6.1, 6.2_

- [x] 3.2 Implement summarize_emails validation and mock mode
  - Configure brick_validate call with schema for sinceISO parameter (ISO 8601 date validation)
  - Implement MOCK_MODE check - return canned response with mock summary and email count
  - Add timezone handling using GENERIC_TIMEZONE environment variable
  - _Requirements: 3.1, 7.1, 7.2_

- [x] 3.3 Implement email summarization with Gemini API
  - Use Gmail API to fetch emails since specified ISO timestamp with privacy-compliant logging
  - Integrate with Gemini API using GEMINI_DEFAULT_MODEL environment variable
  - Generate concise email summaries with email count and time range
  - Return structured response via brick_respond sub-workflow
  - _Requirements: 3.2, 8.1, 8.2, 11.1_

- [x] 4. Implement create_calendar_event brick
  - Create workflow with sub-workflow calls and MOCK_MODE support
  - Set up Google Calendar API integration with default calendar
  - Implement timezone-aware event creation
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 4.1 Create create_calendar_event workflow structure
  - Create new n8n workflow file `flows/bricks/create_calendar_event.json`
  - Add webhook trigger node configured for POST `/webhook-brick/create_calendar_event`
  - Add "Call Workflow" trigger for internal use (non-HTTP calls)
  - Call brick_auth_guard, brick_validate, and brick_respond sub-workflows in sequence
  - _Requirements: 4.3, 6.1, 6.2_

- [x] 4.2 Implement create_calendar_event validation and mock mode
  - Configure brick_validate call with schema for title, startISO, endISO, guests[] parameters
  - Implement MOCK_MODE check - return canned response with mock eventId and htmlLink
  - Add ISO 8601 timestamp validation and timezone handling using GENERIC_TIMEZONE
  - _Requirements: 4.1, 7.1, 7.2_

- [x] 4.3 Implement calendar event creation logic
  - Use Google Calendar API with GOOGLE_CALENDAR_ID environment variable (default: primary)
  - Handle guest invitations with privacy-compliant logging (mask email addresses)
  - Create events with timezone-aware start/end times
  - Return structured response with eventId and htmlLink via brick_respond sub-workflow
  - _Requirements: 4.2, 11.1, 12.1_

- [x] 5. Implement list_todays_events brick
  - Create workflow with sub-workflow calls and MOCK_MODE support
  - Fetch today's calendar events with timezone awareness
  - Format events into standardized response structure
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 5.1 Create list_todays_events workflow structure
  - Create new n8n workflow file `flows/bricks/list_todays_events.json`
  - Add webhook trigger node configured for POST `/webhook-brick/list_todays_events`
  - Add "Call Workflow" trigger for internal use (non-HTTP calls)
  - Call brick_auth_guard and brick_respond sub-workflows (no input validation needed)
  - _Requirements: 5.3, 6.1, 6.2_

- [x] 5.2 Implement list_todays_events mock mode and logic
  - Implement MOCK_MODE check - return canned response with sample events array
  - Use Google Calendar API with GOOGLE_CALENDAR_ID to fetch today's events
  - Handle timezone conversion using GENERIC_TIMEZONE for "today" calculation
  - Filter and format event data with privacy-compliant logging
  - _Requirements: 5.1, 11.1, 12.1_

- [x] 5.3 Format calendar events response
  - Structure events array with title, start, end, location, attendees (masked emails)
  - Ensure consistent ISO timestamp formatting in GENERIC_TIMEZONE
  - Return empty array when no events found
  - Return structured response via brick_respond sub-workflow
  - _Requirements: 5.2, 11.1_

- [ ] 6. Implement error handling and external API retry logic
  - Add standardized error handling to all brick workflows
  - Implement retry logic for external API failures
  - Ensure proper HTTP status codes (200, 400, 401, 429, 5xx)
  - _Requirements: 8.1, 8.2, 8.3_

- [x] 6.1 Implement standardized error handling in brick workflows
  - Add error handling nodes to each brick workflow for external API failures
  - Ensure all errors return structured JSON responses via brick_respond sub-workflow
  - Map external API errors to appropriate HTTP status codes (5xx for external failures)
  - Prevent raw HTML error pages from being returned
  - _Requirements: 8.1, 8.2, 8.3_

- [x] 6.2 Implement retry logic for external APIs
  - Add exponential backoff retry for Gmail API calls in email-related bricks
  - Implement retry logic for Google Calendar API calls in calendar bricks
  - Add Gemini API retry with rate limiting consideration in summarize_emails
  - Use existing error-handling-utils.js patterns where possible
  - _Requirements: 8.1, 8.2_

- [x] 7. Create mockable test suite for all bricks
  - Write contract tests that run in MOCK_MODE for CI reliability
  - Create separate smoke tests for real API integration testing
  - Implement test data setup and cleanup procedures
  - _Requirements: 9.1, 9.2, 9.3_

- [x] 7.1 Create contract tests for all bricks in mock mode
  - Write Jest tests in `tests/bricks/contract.test.js` that call webhook endpoints with MOCK_MODE=true
  - Test authentication (401), validation (400), rate limiting (429), and success (200) responses
  - Verify response structure matches expected format for all bricks
  - Test that mock responses are returned when MOCK_MODE is enabled
  - _Requirements: 9.1, 9.2_

- [x] 7.2 Create smoke test script for real API integration
  - Create `scripts/smoke-test-bricks.js` for manual/staging testing with real APIs
  - Test create_email_draft with actual Gmail API integration
  - Test summarize_emails with real email fetching and Gemini API
  - Test both calendar bricks with actual Google Calendar API
  - Include cleanup procedures to remove test data
  - _Requirements: 9.1, 9.2_

- [x] 7.3 Add npm scripts for different test modes
  - Add `npm run test:bricks` for contract tests (MOCK_MODE=true)
  - Add `npm run smoke:local` for local smoke testing with real APIs
  - Add `npm run smoke:staging` for staging environment smoke tests
  - _Requirements: 9.3_

- [x] 8. Generate documentation and API collection
  - Create Postman collection with example requests for all bricks
  - Update root README.md with concise "Using Bricks" section
  - Document environment variables and provide curl examples
  - _Requirements: 10.1, 10.2, 10.3_

- [x] 8.1 Create Postman collection
  - Generate `docs/Postman_Pulse_Bricks.json` with example requests for all four bricks
  - Include X-Pulse-Key authentication headers and sample request/response bodies
  - Add environment variables for BRICK_AUTH_KEY and base URL
  - Include examples for both success and error responses (400, 401, 429)
  - _Requirements: 10.1, 10.2_

- [x] 8.2 Update README.md with "Using Bricks" section
  - Add concise section explaining POST /webhook-brick/<name> endpoints
  - Document X-Pulse-Key authentication requirement
  - Include one curl example per brick with sample input/output
  - Document MOCK_MODE for testing and rate limiting behavior
  - List all required environment variables for brick functionality
  - _Requirements: 10.3_

- [x] 9. Set up CI/CD pipeline for brick contract testing
  - Update GitHub Actions workflow to run contract tests in MOCK_MODE
  - Configure test environment for reliable CI execution
  - Add separate manual smoke test workflow
  - _Requirements: 9.3_

- [x] 9.1 Update GitHub Actions workflow for contract tests
  - Modify `.github/workflows/ci.yml` to run `npm run test:bricks` with MOCK_MODE=true
  - Add environment variables: MOCK_MODE=true, BRICK_AUTH_KEY=test-key-123
  - Ensure tests run against mock responses only (no external API calls)
  - Configure test failure notifications and build status
  - _Requirements: 9.3_

- [x] 9.2 Add manual smoke test GitHub Action
  - Create `.github/workflows/smoke-test.yml` for manual trigger
  - Configure with real API credentials for staging/production testing
  - Run `npm run smoke:staging` with actual external API integration
  - Include test cleanup and result reporting
  - _Requirements: 9.3_

- [x] 10. Deploy and activate all brick workflows
  - Import all brick workflows and sub-workflows into n8n instance
  - Activate workflows and verify webhook endpoints are accessible
  - Test both mock mode and real API functionality
  - _Requirements: 2.3, 3.3, 4.3, 5.3_

- [x] 10.1 Import and activate all workflows
  - Import shared sub-workflows first: brick_auth_guard, brick_validate, brick_respond
  - Import all four brick workflows: create_email_draft, summarize_emails, create_calendar_event, list_todays_events
  - Activate each workflow and verify webhook endpoints are registered at POST /webhook-brick/<name>
  - Verify "Call Workflow" triggers are available for internal use
  - _Requirements: 2.3, 3.3, 4.3, 5.3_

- [x] 10.2 Verify mock mode functionality
  - Test each brick endpoint with MOCK_MODE=true to verify canned responses
  - Verify authentication (401), validation (400), and rate limiting (429) work correctly
  - Confirm all responses follow standardized format with ok, data/error, brick, timestamp, requestId
  - _Requirements: 8.1, 8.2, 8.3_

- [x] 10.3 Run smoke tests for real API integration
  - Execute `npm run smoke:local` to test real Gmail, Calendar, and Gemini API integration
  - Verify external API error handling and retry logic work correctly
  - Test rate limiting with multiple requests to confirm daily cap enforcement
  - Verify privacy-compliant logging with email masking in all log outputs
  - _Requirements: 8.1, 8.2, 11.1, 11.2_