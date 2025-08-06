# Pulse Gateway Setup Guide

This guide walks you through importing and configuring the Pulse Gateway and Gmail bricks in n8n.

## Prerequisites

- ✅ Environment variables configured (especially `PULSE_HMAC_SECRET`)
- ✅ n8n running with Docker Compose
- ✅ Gmail OAuth credentials set up

## Step 1: Import Workflows

### 1.1 Import Gmail Bricks

Import each Gmail brick workflow into n8n:

1. **Access n8n Interface**
   ```
   http://localhost:5678
   ```

2. **Import gmail.create_email_draft**
   - Click "Add workflow" → "Import from File" 
   - Select `flows/bricks/gmail/gmail.create_email_draft.json`
   - Save the workflow (note the workflow ID)

3. **Import gmail.send_email**
   - Click "Add workflow" → "Import from File"
   - Select `flows/bricks/gmail/gmail.send_email.json`
   - Save the workflow (note the workflow ID)

4. **Import gmail.search_messages**
   - Click "Add workflow" → "Import from File"
   - Select `flows/bricks/gmail/gmail.search_messages.json`
   - Save the workflow (note the workflow ID)

5. **Import summarize_emails**
   - Click "Add workflow" → "Import from File"
   - Select `flows/bricks/summarize_emails_clean.json`
   - Save the workflow (note the workflow ID)

### 1.2 Import Pulse Gateway

1. **Import pulse.gateway**
   - Click "Add workflow" → "Import from File"
   - Select `flows/bricks/pulse.gateway.json`
   - **Do not save yet** - we need to configure the Execute Workflow nodes first

## Step 2: Configure Gateway Routing

The gateway workflow contains TODO placeholders that need to be manually configured:

### 2.1 Configure Execute Workflow Nodes

1. **Execute Create Draft Node**
   - Click on the "Execute Create Draft" node
   - In the "Workflow" dropdown, select the "gmail.create_email_draft" workflow
   - Ensure "Wait for Sub-Workflow" is checked
   - Input field should be: `={{ $json.subInput }}`

2. **Execute Send Email Node**
   - Click on the "Execute Send Email" node  
   - In the "Workflow" dropdown, select the "gmail.send_email" workflow
   - Ensure "Wait for Sub-Workflow" is checked
   - Input field should be: `={{ $json.subInput }}`

3. **Execute Search Messages Node**
   - Click on the "Execute Search Messages" node
   - In the "Workflow" dropdown, select the "gmail.search_messages" workflow
   - Ensure "Wait for Sub-Workflow" is checked
   - Input field should be: `={{ $json.subInput }}`

### 2.2 Save Gateway Workflow

After configuring all Execute Workflow nodes:
- Click "Save" to save the gateway workflow
- Note the gateway workflow ID for agent configuration

## Step 3: Configure Gmail OAuth Credentials

Each Gmail brick needs OAuth2 credentials configured:

### 3.1 Create Gmail OAuth2 Credential

1. **In any Gmail brick workflow**, click on a Gmail node
2. Click "Create New Credential" next to the credentials field
3. Select "Gmail OAuth2 API" credential type
4. Configure the credential:
   ```
   Name: gmail-oauth-pulse
   Client ID: [Your GOOGLE_CLIENT_ID from .env]
   Client Secret: [Your GOOGLE_CLIENT_SECRET from .env]
   ```
5. Click "Connect my account" and complete OAuth flow
6. Save the credential

### 3.2 Update Credential References

For each Gmail brick, update the credential reference:
- In the Gmail node, set credential to use the newly created "gmail-oauth-pulse"
- Save each workflow

## Step 4: Test Gateway Functionality

### 4.1 Test HMAC Signature Verification

Create a test request to verify the gateway is working:

```bash
# Generate test timestamp
TIMESTAMP=$(date +%s)

# Create test payload
PAYLOAD='{"brick":"gmail.search_messages","connectionId":"gmail-oauth-pulse","params":{"query":"test"}}'

# Generate HMAC signature (replace YOUR_SECRET with actual PULSE_HMAC_SECRET)
SIGNATURE=$(echo -n "${TIMESTAMP}${PAYLOAD}" | openssl dgst -sha256 -hmac "YOUR_SECRET" -binary | xxd -p -c 256)

# Test gateway endpoint
curl -X POST http://localhost:5678/webhook/pulse-gateway \
  -H "Content-Type: application/json" \
  -H "X-Pulse-Timestamp: ${TIMESTAMP}" \
  -H "X-Pulse-Signature: sha256=${SIGNATURE}" \
  -d "${PAYLOAD}"
```

### 4.2 Expected Response

Successful response should include:
```json
{
  "ok": true,
  "brick": "gmail.search_messages", 
  "brickVersion": "v1",
  "timestamp": "2025-08-05T...",
  "data": {...}
}
```

## Step 5: Activate Workflows

1. **Activate Gateway Workflow**
   - In the pulse.gateway workflow, toggle the "Active" switch
   - Status should show "Active"

2. **Gmail Bricks** 
   - Gmail bricks should remain "Inactive" (they're called by the gateway)
   - Only activate if testing individually

## Troubleshooting

### Common Issues

1. **"Workflow not found" error**
   - Ensure all brick workflows are imported and saved first
   - Check that the correct workflow names are selected in Execute Workflow nodes

2. **"Invalid HMAC signature" error**
   - Verify `PULSE_HMAC_SECRET` is set correctly in environment
   - Check timestamp is current (within 5 minutes)
   - Ensure signature generation matches gateway expectations

3. **Gmail OAuth errors**
   - Verify OAuth2 credentials are properly configured
   - Complete the OAuth flow in the credential setup
   - Ensure Gmail API is enabled in Google Cloud Console

4. **"Missing credential" errors**
   - Check that each Gmail node references the correct credential
   - Verify the credential is properly connected and authorized

### Debug Commands

```bash
# Check gateway webhook URL
docker compose logs n8n | grep "webhook"

# Monitor gateway execution
docker compose logs -f n8n | grep "pulse.gateway"

# Test environment variables
docker compose exec n8n printenv | grep PULSE_HMAC_SECRET
```

## Next Steps

After successful gateway setup:
1. Proceed to Phase 2: Agent Implementation
2. Test end-to-end agent → gateway → brick flows
3. Add additional service bricks (Calendar, Twilio)

---

✅ **Phase 1 Complete** - Gateway manually configured and ready for agent integration!
