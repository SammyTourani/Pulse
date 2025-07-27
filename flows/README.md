# n8n Workflow Documentation

## Gmail to Gemini to SMS Workflow

This directory contains the core n8n workflow for Pulse AI Secretary's email processing pipeline.

### Workflow Overview

The `gmail_gemini_sms_workflow.json` file defines a 5-node workflow that:

1. **Gmail Trigger** - Monitors Gmail inbox for new unread messages
2. **Process Email Content** - Extracts and processes email content with HTML-to-text conversion
3. **Gemini API Request** - Sends email content to Google Gemini for response generation
4. **Extract Gemini Response** - Processes Gemini's response and prepares draft content
5. **Create Gmail Draft** - Creates a draft reply in Gmail with proper threading

### Node Details

#### 1. Gmail Trigger Node
- **Type**: `n8n-nodes-base.gmailTrigger`
- **Function**: Polls Gmail every minute for new unread messages
- **Configuration**:
  - Excludes spam/trash
  - Only processes unread messages
  - Uses resolved format for full message data
- **Credentials**: Requires Gmail OAuth2 setup

#### 2. Process Email Content Node
- **Type**: `n8n-nodes-base.code`
- **Function**: Processes raw email data for Gemini API
- **Features**:
  - HTML-to-text conversion (requirement 1.5)
  - Large attachment detection (>1MB, requirement 1.6)
  - Email truncation for token limits (requirement 1.3)
  - Structured prompt creation for Gemini
- **Output**: Processed email data and Gemini prompt

#### 3. Gemini API Request Node
- **Type**: `n8n-nodes-base.httpRequest`
- **Function**: Calls Google Gemini API for response generation
- **Configuration**:
  - 3-second timeout (requirement 1.3)
  - Retry logic with max 2 attempts
  - Safety settings for content filtering
  - Token limit: 1024 max output tokens
- **Authentication**: Uses `GEMINI_API_KEY` environment variable

#### 4. Extract Gemini Response Node
- **Type**: `n8n-nodes-base.code`
- **Function**: Processes Gemini API response
- **Features**:
  - Extracts generated text from API response
  - Adds attachment omission note when needed
  - Prepares SMS notification content
  - Error handling for malformed responses
- **Output**: Draft content and SMS message

#### 5. Create Gmail Draft Node
- **Type**: `n8n-nodes-base.gmail`
- **Function**: Creates draft reply in Gmail
- **Configuration**:
  - Preserves thread context (requirement 1.8)
  - Sets proper reply-to headers
  - Uses "Re:" subject prefix
- **Credentials**: Uses same Gmail OAuth2 as trigger

### Workflow Features

#### HTML-to-Text Conversion (Requirement 1.5)
The workflow includes comprehensive HTML-to-text conversion:
- Removes style and script blocks
- Strips HTML tags
- Converts HTML entities
- Normalizes whitespace

#### Large Attachment Handling (Requirement 1.6)
- Detects attachments >1MB
- Skips attachment processing
- Adds note to generated response
- Includes attachment status in SMS notification

#### Token Limit Management (Requirement 1.3)
- Truncates email content to 2000 characters
- Limits Gemini output to 1024 tokens
- 3-second timeout for API requests
- Respects free-tier daily limit of 1M tokens

#### Thread Preservation (Requirement 1.8)
- Maintains original thread ID
- Sets proper reply-to headers
- Uses original message ID for context

### Environment Variables Required

```bash
# Gmail OAuth2 (configured in n8n interface)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret

# Gemini API
GEMINI_API_KEY=your_gemini_api_key

# n8n Authentication
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=your_password
```

### Deployment

#### 1. Import Workflow
```bash
npm run import-workflow
```

#### 2. Configure Credentials
1. Access n8n at http://localhost:5678
2. Go to Settings > Credentials
3. Add Gmail OAuth2 credential:
   - Name: "Gmail OAuth"
   - Client ID: From Google Cloud Console
   - Client Secret: From Google Cloud Console
   - Complete OAuth flow

#### 3. Activate Workflow
1. Open the imported workflow
2. Click "Active" toggle
3. Verify all nodes are properly configured

#### 4. Test Workflow
1. Send a test email to your Gmail
2. Check n8n execution logs
3. Verify draft is created in Gmail
4. Monitor for any errors

### Monitoring and Logging

The workflow includes comprehensive logging:
- Email processing details
- Gemini API response metrics
- Large attachment detection
- Error handling and recovery

### Error Handling

Each node includes error handling:
- **Gmail Trigger**: Continues on individual email failures
- **Gemini API**: Fallback message on API failures
- **Draft Creation**: Logs errors but doesn't stop workflow
- **General**: All errors logged with timestamps

### Performance Considerations

- **Polling Frequency**: Every minute (configurable)
- **Timeout**: 3 seconds for Gemini API
- **Token Limits**: 1024 output tokens per request
- **Rate Limits**: Respects Gemini free-tier limits
- **Memory**: Minimal - no persistent data storage

### Security Features

- **OAuth2**: Secure Gmail authentication
- **HTTPS**: All external API calls encrypted
- **No Persistence**: Email content not stored
- **Environment Variables**: Sensitive data in env vars
- **Content Filtering**: Gemini safety settings enabled

### Troubleshooting

#### Common Issues

1. **Gmail OAuth Expired**
   - Re-authenticate in n8n credentials
   - Check Google Cloud Console quotas

2. **Gemini API Errors**
   - Verify API key is valid
   - Check daily token usage
   - Monitor rate limits

3. **Draft Creation Fails**
   - Verify Gmail permissions
   - Check thread ID validity
   - Ensure proper email format

#### Debug Steps

1. Check n8n execution logs
2. Verify environment variables
3. Test individual nodes
4. Monitor external API responses
5. Check Gmail API quotas

### Future Enhancements

This workflow is designed for the MVP. Future versions may include:
- SMS notification integration (Task 5)
- Enhanced error handling (Task 6)
- Security improvements (Task 7)
- Performance monitoring
- Semantic email analysis with pgvector