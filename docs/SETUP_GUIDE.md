# Pulse AI Secretary - Complete Setup Guide

## Overview

This comprehensive guide walks you through setting up Pulse AI Secretary from scratch, including all API configurations, troubleshooting common issues, and production deployment options.

## Prerequisites

### System Requirements
- **Operating System**: macOS, Linux, or Windows with WSL2
- **Docker**: Version 20.10+ with Docker Compose V2
- **Node.js**: Version 18+ (for development and validation scripts)
- **Memory**: Minimum 4GB RAM (8GB recommended for production)
- **Storage**: 2GB free space for containers and data

### Account Requirements
- **Google Cloud Account**: For Gmail API and Gemini API access
- **Twilio Account**: For SMS notifications (free trial available)
- **Domain Name**: Optional, for production deployment with auto-TLS

## Step 1: Repository Setup

### 1.1 Clone Repository
```bash
# Clone the repository
git clone https://github.com/yourusername/pulse-ai-secretary.git
cd pulse-ai-secretary

# Verify repository structure
ls -la
```

**Expected Output:**
```
drwxr-xr-x  15 user  staff   480 Jan 26 12:00 .
drwxr-xr-x   3 user  staff    96 Jan 26 12:00 ..
-rw-r--r--   1 user  staff   123 Jan 26 12:00 .env.example
-rw-r--r--   1 user  staff  1234 Jan 26 12:00 README.md
drwxr-xr-x   3 user  staff    96 Jan 26 12:00 docs
drwxr-xr-x   3 user  staff    96 Jan 26 12:00 flows
-rw-r--r--   1 user  staff  2345 Jan 26 12:00 docker-compose.yml
...
```

### 1.2 Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Make validation script executable
chmod +x validate-env.sh
```

## Step 2: Google Cloud Setup

### 2.1 Create Google Cloud Project

1. **Navigate to Google Cloud Console**
   - Go to [console.cloud.google.com](https://console.cloud.google.com/)
   - Click "Select a project" → "New Project"

2. **Create Project**
   ```
   Project Name: Pulse AI Secretary
   Organization: (your organization or leave blank)
   Location: (your preferred location)
   ```
   - Click "Create"
   - Wait for project creation (usually 30-60 seconds)

3. **Enable Required APIs**
   ```bash
   # Navigate to APIs & Services → Library
   # Search and enable the following APIs:
   ```
   - **Gmail API**: For email access and draft creation
   - **Generative Language API**: For Gemini AI responses

   **Expected Result**: Both APIs show "Enabled" status

### 2.2 Configure OAuth Consent Screen

1. **Navigate to OAuth Consent Screen**
   - Go to "APIs & Services" → "OAuth consent screen"
   - Choose "External" user type (for testing mode)

2. **Fill Required Information**
   ```
   App name: Pulse AI Secretary
   User support email: your-email@domain.com
   Developer contact information: your-email@domain.com
   ```

3. **Add Test Users** (Important for Testing Mode)
   - In "Test users" section, click "Add Users"
   - Add your Gmail address that will be monitored
   - **Note**: Testing mode is limited to 100 users maximum

### 2.3 Create OAuth2 Credentials

1. **Create Credentials**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client IDs"

2. **Configure OAuth Client**
   ```
   Application type: Web application
   Name: Pulse AI Secretary OAuth
   Authorized redirect URIs: http://localhost:5678/rest/oauth2-credential/callback
   ```

3. **Save Credentials**
   - Download the JSON file or copy Client ID and Client Secret
   - Add to your `.env` file:
   ```bash
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

### 2.4 Get Gemini API Key

1. **Navigate to AI Studio**
   - Go to [ai.google.dev](https://ai.google.dev/)
   - Click "Get API key" → "Create API key"

2. **Create API Key**
   - Select your project: "Pulse AI Secretary"
   - Click "Create API key"
   - Copy the generated key

3. **Add to Environment**
   ```bash
   # Add to .env file
   GEMINI_API_KEY=AIzaSy...your-api-key
   ```

**Testing Mode Limitations:**
- Maximum 100 users can authenticate
- OAuth consent screen shows "unverified app" warning (normal)
- No Google review required for personal/small team use
- Perfect for MVP and development

## Step 3: Twilio SMS Setup

### 3.1 Create Twilio Account

1. **Sign Up**
   - Go to [twilio.com/try-twilio](https://www.twilio.com/try-twilio)
   - Complete registration with phone verification

2. **Get Account Credentials**
   - From Twilio Console dashboard, copy:
   ```
   Account SID: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   Auth Token: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

### 3.2 Get Phone Number

1. **Purchase/Get Trial Number**
   - Go to "Phone Numbers" → "Manage" → "Buy a number"
   - For trial: Get a free trial number
   - For production: Purchase a number ($1/month)

2. **Configure Number**
   - Copy the phone number (format: +1234567890)
   - Add to `.env`:
   ```bash
   TWILIO_FROM_NUMBER=+1234567890
   ```

### 3.3 Add Credentials to Environment

```bash
# Add to .env file
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_FROM_NUMBER=+1234567890
USER_PHONE_NUMBER=+1987654321  # Your phone number
```

**Trial Account Limitations:**
- Limited SMS credits (usually $15-20 free)
- Can only send to verified phone numbers
- Messages include "Sent from your Twilio trial account"
- Upgrade to paid account removes these limitations

## Step 4: Environment Validation

### 4.1 Complete Environment Configuration

Edit your `.env` file with all required values:

```bash
# n8n Configuration
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=your-secure-password-123

# Database
DB_POSTGRESDB_PASSWORD=your-db-password

# Google Services
GEMINI_API_KEY=AIzaSy...your-api-key
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_FROM_NUMBER=+1234567890
USER_PHONE_NUMBER=+1987654321

# Rate Limiting
SMS_DAILY_LIMIT=50
SMS_PER_RUN_LIMIT=3
```

### 4.2 Validate Configuration

```bash
# Run validation script
./validate-env.sh
```

**Expected Output (Success):**
```
✅ Validating environment configuration...
✅ N8N_BASIC_AUTH_USER is set
✅ N8N_BASIC_AUTH_PASSWORD is set
✅ DB_POSTGRESDB_PASSWORD is set
✅ GEMINI_API_KEY is set
✅ GOOGLE_CLIENT_ID is set
✅ GOOGLE_CLIENT_SECRET is set
✅ TWILIO_ACCOUNT_SID is set
✅ TWILIO_AUTH_TOKEN is set
✅ TWILIO_FROM_NUMBER is set
✅ USER_PHONE_NUMBER is set
✅ All required environment variables are set
```

**Expected Output (Failure):**
```
❌ Validating environment configuration...
❌ Missing required environment variable: GEMINI_API_KEY
❌ Missing required environment variable: GOOGLE_CLIENT_ID
❌ Environment validation failed. Please check your .env file.
```

## Step 5: Docker Deployment

### 5.1 Start Services

```bash
# Start all services in detached mode
docker compose up -d
```

**Expected Output:**
```
[+] Running 4/4
 ✔ Network pulse-ai-secretary_pulse-network  Created    0.1s
 ✔ Container pulse-ai-secretary-postgres-1   Started    2.3s
 ✔ Container pulse-ai-secretary-healthcheck-1 Started   1.8s
 ✔ Container pulse-ai-secretary-n8n-1        Started    3.1s
```

### 5.2 Verify Services

```bash
# Check service status
docker compose ps
```

**Expected Output:**
```
NAME                              IMAGE     COMMAND                  SERVICE      CREATED         STATUS                   PORTS
pulse-ai-secretary-healthcheck-1  node:18   "npm start"              healthcheck  2 minutes ago   Up 2 minutes             0.0.0.0:3001->3001/tcp
pulse-ai-secretary-n8n-1          n8nio/n8n "tini -- /docker-ent…"   n8n          2 minutes ago   Up 2 minutes (healthy)   0.0.0.0:5678->5678/tcp
pulse-ai-secretary-postgres-1     postgres  "docker-entrypoint.s…"   postgres     2 minutes ago   Up 2 minutes             5432/tcp
```

### 5.3 Health Check Verification

```bash
# Test health check endpoint
curl http://localhost:3001/healthz
```

**Expected Output:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-26T17:00:00.000Z",
  "services": {
    "n8n": {
      "status": "up",
      "response_time_ms": 45
    },
    "postgresql": {
      "status": "up",
      "response_time_ms": 12
    },
    "external_apis": {
      "gemini": {
        "status": "up",
        "response_time_ms": 234
      },
      "gmail": {
        "status": "up",
        "response_time_ms": 156
      },
      "twilio": {
        "status": "up",
        "response_time_ms": 89
      }
    }
  }
}
```

## Step 6: n8n Workflow Configuration

### 6.1 Access n8n Interface

1. **Open n8n Web Interface**
   - Navigate to: http://localhost:5678
   - Login with credentials from `.env`:
     - Username: `admin` (or your N8N_BASIC_AUTH_USER)
     - Password: Your N8N_BASIC_AUTH_PASSWORD

2. **Initial Setup**
   - n8n will prompt for initial configuration
   - Choose "Skip" for user management (we use basic auth)

### 6.2 Import Workflow

1. **Import Workflow JSON**
   ```bash
   # Use the import script
   node import-workflow.js
   ```

   **Expected Output:**
   ```
   ✅ Workflow imported successfully
   ✅ Workflow ID: 1
   ✅ Workflow Name: Gmail Gemini SMS Enhanced
   ```

2. **Verify Import**
   - In n8n interface, you should see "Gmail Gemini SMS Enhanced" workflow
   - Workflow should have all nodes: Gmail Trigger, HTTP Request, Set, Gmail, Twilio

### 6.3 Configure Credentials

1. **Gmail OAuth2 Credential**
   - Click on Gmail Trigger node
   - Click "Create New Credential"
   - Choose "Gmail OAuth2 API"
   - Fill in:
     ```
     Client ID: your-google-client-id
     Client Secret: your-google-client-secret
     ```
   - Click "Connect my account"
   - Complete OAuth flow in popup window

2. **Twilio Credential**
   - Click on Twilio SMS node
   - Click "Create New Credential"
   - Choose "Twilio API"
   - Fill in:
     ```
     Account SID: your-twilio-account-sid
     Auth Token: your-twilio-auth-token
     ```

### 6.4 Activate Workflow

1. **Enable Workflow**
   - Click the toggle switch to activate the workflow
   - Status should change to "Active"

2. **Test Workflow**
   - Send a test email to your monitored Gmail account
   - Check n8n execution logs for processing
   - Verify SMS notification is received

## Step 7: Testing and Verification

### 7.1 End-to-End Test

1. **Send Test Email**
   - From another email account, send an email to your monitored Gmail
   - Subject: "Test Email for Pulse AI"
   - Body: "This is a test email to verify Pulse AI Secretary is working correctly."

2. **Monitor Processing**
   ```bash
   # Watch n8n logs
   docker compose logs -f n8n
   ```

3. **Expected Flow**
   - Gmail trigger detects new email (within 30 seconds)
   - Gemini API processes email content
   - Draft response created in Gmail
   - SMS notification sent to your phone

### 7.2 Verify Results

1. **Check Gmail Drafts**
   - Open Gmail in web browser
   - Navigate to "Drafts" folder
   - Verify draft response was created

2. **Check SMS Notification**
   - Verify SMS received on your phone
   - Message should include sender and subject information

3. **Check Logs**
   ```bash
   # Check for successful execution
   docker compose logs n8n | grep "Workflow execution completed"
   ```

## Troubleshooting Common Issues

### Issue 1: Environment Variables Not Set

**Symptoms:**
```
❌ Missing required environment variable: GEMINI_API_KEY
```

**Solution:**
1. Check `.env` file exists and has correct values
2. Ensure no spaces around `=` in environment variables
3. Restart Docker containers after changes:
   ```bash
   docker compose down
   docker compose up -d
   ```

### Issue 2: OAuth Authentication Failed

**Symptoms:**
- "Invalid client" error during OAuth flow
- "Redirect URI mismatch" error

**Solution:**
1. Verify redirect URI in Google Console:
   ```
   http://localhost:5678/rest/oauth2-credential/callback
   ```
2. Ensure your email is added to test users in OAuth consent screen
3. Clear browser cookies and try again

### Issue 3: n8n Won't Start

**Symptoms:**
```
pulse-ai-secretary-n8n-1 exited with code 1
```

**Solution:**
1. Check database connection:
   ```bash
   docker compose logs postgres
   ```
2. Verify environment variables:
   ```bash
   ./validate-env.sh
   ```
3. Check n8n logs for specific error:
   ```bash
   docker compose logs n8n
   ```

### Issue 4: SMS Not Sending

**Symptoms:**
- No SMS received after email processing
- Twilio errors in logs

**Solution:**
1. Verify Twilio credentials:
   ```bash
   # Test Twilio API directly
   curl -X POST https://api.twilio.com/2010-04-01/Accounts/YOUR_SID/Messages.json \
     --data-urlencode "From=+1234567890" \
     --data-urlencode "Body=Test message" \
     --data-urlencode "To=+1987654321" \
     -u YOUR_SID:YOUR_AUTH_TOKEN
   ```
2. Check phone number format (must include country code: +1234567890)
3. For trial accounts, verify destination number is verified in Twilio console

### Issue 5: Gemini API Errors

**Symptoms:**
- "API key not valid" errors
- "Quota exceeded" errors

**Solution:**
1. Verify API key is correct and active
2. Check Gemini API is enabled in Google Cloud Console
3. Monitor daily token usage:
   ```bash
   # Check logs for token usage
   docker compose logs n8n | grep "token"
   ```

### Issue 6: Health Check Failures

**Symptoms:**
```json
{
  "status": "unhealthy",
  "services": {
    "n8n": { "status": "down" }
  }
}
```

**Solution:**
1. Check service status:
   ```bash
   docker compose ps
   ```
2. Restart unhealthy services:
   ```bash
   docker compose restart n8n
   ```
3. Check service logs:
   ```bash
   docker compose logs healthcheck
   ```

## Performance Optimization

### Resource Allocation

For production deployment, adjust resource limits in `docker-compose.prod.yml`:

```yaml
services:
  n8n:
    deploy:
      resources:
        limits:
          memory: 2G      # Increase for high volume
          cpus: '1.0'     # Increase for better performance
        reservations:
          memory: 1G
          cpus: '0.5'
```

### Database Optimization

```bash
# Add to .env for better PostgreSQL performance
DB_POSTGRESDB_SHARED_BUFFERS=256MB
DB_POSTGRESDB_EFFECTIVE_CACHE_SIZE=1GB
DB_POSTGRESDB_MAINTENANCE_WORK_MEM=64MB
```

### Monitoring Setup

Enable monitoring stack:

```bash
# Start with monitoring profile
docker compose --profile monitoring up -d
```

This adds Prometheus and Loki for metrics and log aggregation.

## Security Hardening

### Production Security Checklist

- [ ] Change default passwords in `.env`
- [ ] Enable HTTPS with auto-TLS (see production deployment)
- [ ] Set `N8N_DISABLE_UI=true` in production
- [ ] Use strong encryption key: `openssl rand -hex 32`
- [ ] Enable firewall rules
- [ ] Regular security updates
- [ ] Monitor access logs
- [ ] Backup encryption keys securely

### Network Security

```bash
# Configure firewall (Ubuntu/Debian)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 5678/tcp  # Block direct n8n access
sudo ufw deny 3001/tcp  # Block direct health check access
sudo ufw enable
```

## Next Steps

After successful setup:

1. **Monitor Performance**: Use health check endpoint and logs
2. **Scale if Needed**: Adjust resource limits based on usage
3. **Backup Configuration**: Backup `.env` and workflow JSON files
4. **Production Deployment**: Follow production deployment guide
5. **Custom Workflows**: Modify workflow for your specific needs

## Support and Resources

- **Documentation**: Check `docs/` directory for detailed guides
- **Logs**: Use `docker compose logs` for troubleshooting
- **Health Checks**: Monitor `/healthz` endpoint
- **Community**: GitHub Issues for bug reports and feature requests

This completes the comprehensive setup guide for Pulse AI Secretary. The system should now be fully operational and processing emails automatically.