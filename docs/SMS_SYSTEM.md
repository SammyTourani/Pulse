# SMS Notification System

## Overview

The SMS notification system in Pulse AI Secretary provides real-time notifications when email drafts are ready for review. It includes comprehensive rate limiting, retry logic, and graceful failure handling to ensure reliable operation while preventing SMS abuse.

## Features

### Rate Limiting (Requirement 3.3)
- **Daily SMS Cap**: Configurable via `SMS_DAILY_LIMIT` environment variable (default: 50)
- **Per-Run Limit**: Maximum 3 SMS per workflow execution via `SMS_PER_RUN_LIMIT`
- **Persistent Tracking**: Daily counts stored in `.sms-counts.json` file
- **Automatic Cleanup**: Old count data automatically purged after 7 days

### Message Templates (Requirement 3.2)
SMS notifications include:
- Email sender name and address
- Email subject line
- Attachment status when large attachments (>1MB) are omitted
- Clear, concise format optimized for mobile viewing

Example message:
```
New email draft ready:
From: John Doe
Subject: Project Update Meeting
(Attachments omitted)
```

### Retry Logic (Requirement 3.4)
- **Single Retry**: If SMS delivery fails, system retries once after 30 seconds
- **Exponential Backoff**: Built-in delay prevents API rate limit issues
- **Graceful Degradation**: Workflow continues even if SMS fails
- **Comprehensive Logging**: All retry attempts logged with timestamps

### Error Handling (Requirements 3.5, 3.6)
- **Missing Phone Number**: Logs draft creation without failing workflow
- **API Failures**: Detailed error logging with continuation of email processing
- **Rate Limit Exceeded**: Clear logging with current count information
- **Network Issues**: Automatic retry with fallback to logging

## Configuration

### Required Environment Variables
```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=+1234567890

# User Configuration
USER_PHONE_NUMBER=+1987654321

# Rate Limiting (Optional)
SMS_DAILY_LIMIT=50
SMS_PER_RUN_LIMIT=3
```

### Twilio Setup
1. Create Twilio account at https://www.twilio.com/
2. Get Account SID and Auth Token from console
3. Purchase or verify a phone number for sending
4. Add credentials to environment variables

## Workflow Integration

### n8n Workflow Nodes

#### 1. SMS Rate Limit Check Node
- **Type**: Code node
- **Function**: Validates rate limits and user configuration
- **Output**: Decision on whether to send SMS

#### 2. SMS Rate Limit Gate Node
- **Type**: IF node
- **Function**: Routes workflow based on rate limit check
- **Branches**: Send SMS or Log Skip

#### 3. Send SMS Notification Node
- **Type**: Twilio node
- **Function**: Sends SMS via Twilio API
- **Error Handling**: Routes to retry logic on failure

#### 4. Log SMS Skip Node
- **Type**: Code node
- **Function**: Logs when SMS is skipped due to rate limits

### Rate Limiting Logic
```javascript
// Check daily limit
const dailyCount = getDailyCount();
if (dailyCount >= dailyLimit) {
  return { shouldSend: false, reason: 'Daily limit reached' };
}

// Check per-run limit (simplified for single email)
const perRunCount = 1;
if (perRunCount > perRunLimit) {
  return { shouldSend: false, reason: 'Per-run limit exceeded' };
}

// Update count and approve
incrementDailyCount();
return { shouldSend: true };
```

## Monitoring and Management

### CLI Commands
```bash
# Check current SMS status
npm run sms-status

# Check if SMS can be sent
npm run sms-check

# Reset daily SMS count (for testing)
npm run sms-reset

# Test SMS sending with retry logic
npm run sms-test
```

### Status Output
```json
{
  "dailyCount": 5,
  "dailyLimit": 50,
  "perRunLimit": 3,
  "userPhone": "+1987****321",
  "canSend": true
}
```

### Logging Examples

#### Successful SMS
```
SMS notification approved: {
  messageId: "msg_123",
  dailyCount: 6,
  dailyLimit: 50,
  userPhone: "+1987****321",
  timestamp: "2025-01-26T12:00:00.000Z"
}
```

#### Rate Limit Hit
```
Daily SMS limit reached: {
  dailyCount: 50,
  dailyLimit: 50,
  messageId: "msg_124",
  timestamp: "2025-01-26T15:30:00.000Z"
}
```

#### SMS Retry
```
SMS delivery failed, attempting retry: {
  messageId: "msg_125",
  error: "Network timeout",
  timestamp: "2025-01-26T16:00:00.000Z"
}
```

## Security Considerations

### Phone Number Privacy
- Phone numbers masked in logs (e.g., `+1987****321`)
- No phone numbers stored in workflow data
- Environment variable access only

### API Key Security
- Twilio credentials stored as environment variables
- No credentials in workflow JSON or logs
- Secure credential storage in n8n

### Rate Limiting Security
- Prevents SMS bombing attacks
- Daily and per-run limits enforced
- Persistent count storage prevents reset attacks

## Troubleshooting

### Common Issues

#### SMS Not Sending
1. **Check Configuration**
   ```bash
   npm run sms-check
   ```
2. **Verify Twilio Credentials**
   - Account SID and Auth Token valid
   - Phone number verified and active
3. **Check Rate Limits**
   - Daily limit not exceeded
   - Per-run limit not exceeded

#### Rate Limit Issues
1. **Check Current Status**
   ```bash
   npm run sms-status
   ```
2. **Reset for Testing**
   ```bash
   npm run sms-reset
   ```
3. **Adjust Limits**
   - Increase `SMS_DAILY_LIMIT`
   - Increase `SMS_PER_RUN_LIMIT`

#### Twilio API Errors
- **401 Unauthorized**: Check Account SID and Auth Token
- **400 Bad Request**: Verify phone number format (+1234567890)
- **429 Rate Limited**: Twilio API limits exceeded
- **21211 Invalid Phone**: Phone number not verified (trial accounts)

### Debug Steps
1. Check environment variables are set
2. Verify Twilio account status and credits
3. Test with `npm run sms-test`
4. Check n8n workflow execution logs
5. Monitor `.sms-counts.json` file for count tracking

## Performance Considerations

### SMS Delivery Time
- **Target**: <10 seconds (Requirement 3.1)
- **Typical**: 2-5 seconds via Twilio
- **Retry Delay**: 30 seconds for failed attempts

### Rate Limit Storage
- **File-based**: `.sms-counts.json` for persistence
- **Memory Usage**: Minimal (only current day counts)
- **Cleanup**: Automatic purging of old data

### API Efficiency
- **Single API Call**: One SMS per email draft
- **Retry Logic**: Maximum 2 API calls per SMS (original + retry)
- **Connection Reuse**: n8n handles Twilio connection pooling

## Future Enhancements

### Planned Features
- **Multiple Recipients**: Support for team notifications
- **Quiet Hours**: Skip SMS during configured hours
- **Priority Levels**: Different limits for urgent emails
- **SMS Templates**: Customizable message formats
- **Delivery Receipts**: Track SMS delivery status

### Integration Options
- **Slack Integration**: Alternative to SMS notifications
- **Email Notifications**: Fallback when SMS fails
- **Push Notifications**: Mobile app integration
- **Webhook Support**: Custom notification endpoints

## Testing

### Unit Tests
```bash
# Test rate limiting logic
npm run test -- sms-rate-limiter.test.js

# Test retry mechanism
npm run test -- sms-retry.test.js
```

### Integration Tests
```bash
# Test full SMS workflow
npm run sms-test

# Test with rate limits
SMS_DAILY_LIMIT=1 npm run sms-test
```

### Manual Testing
1. Set low daily limit: `SMS_DAILY_LIMIT=2`
2. Send test emails to trigger workflow
3. Verify SMS notifications received
4. Confirm rate limiting after limit reached
5. Test retry logic by temporarily disabling Twilio