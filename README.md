# Pulse AI Secretary

## 🎯 Elevator Pitch

**Pulse is a privacy-first, always-on personal AI secretary that automatically processes Gmail messages, generates intelligent draft responses using Google Gemini, and sends SMS notifications when drafts are ready.**

Transform your email workflow in minutes: Pulse monitors your Gmail inbox, uses AI to craft contextually appropriate draft responses, and notifies you via SMS when drafts are ready for review. All processing happens locally in Docker containers, ensuring your private communications never leave your control.

## 🎬 Demo

> **📹 [Watch Demo Video on Loom](https://loom.com/placeholder)** - See Pulse in action processing emails and generating drafts
>
> **🖼️ [View Screenshots](./docs/screenshots/)** - Visual walkthrough of the setup and workflow

_Demo shows: Gmail email arrives → Gemini generates response → Draft created → SMS notification sent_

## 🚀 Quick Start

Get Pulse running in under 5 minutes:

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/pulse-ai-secretary.git
cd pulse-ai-secretary

# 2. Copy environment template and configure your API keys
cp .env.example .env
# Edit .env with your actual API keys (see setup sections below)

# 3. Validate your environment configuration
chmod +x validate-env.sh
./validate-env.sh

# 4. Start all services with Docker Compose
docker compose up -d

# 5. Verify everything is running
curl http://localhost:3001/healthz
```

**🎯 One-liner for experienced users:**

```bash
git clone <repo> && cd pulse-ai-secretary && cp .env.example .env && ./validate-env.sh && docker compose up -d
```

Expected output after `docker compose up`:

```
✅ PostgreSQL database ready on port 5432
✅ n8n workflow engine ready on port 5678
✅ Health check server ready on port 3001
🎯 Access n8n at: http://localhost:5678
```

## 🧱 Using Bricks

Pulse includes a modular "brick layer" that provides standardized HTTP endpoints for common operations. Each brick is a self-contained workflow that can be called independently by AI agents or external applications.

### Available Bricks

| Brick | Endpoint | Description |
|-------|----------|-------------|
| `create_email_draft` | `POST /webhook-brick/create_email_draft` | Create Gmail draft emails |
| `summarize_emails` | `POST /webhook-brick/summarize_emails` | Generate AI summaries of recent emails |
| `create_calendar_event` | `POST /webhook-brick/create_calendar_event` | Create Google Calendar events |
| `list_todays_events` | `POST /webhook-brick/list_todays_events` | Retrieve today's calendar events |

### Authentication

All brick endpoints require the `X-Pulse-Key` header for authentication:

```bash
curl -X POST http://localhost:5678/webhook-brick/create_email_draft \
  -H "Content-Type: application/json" \
  -H "X-Pulse-Key: your-brick-auth-key" \
  -d '{"to": "user@example.com", "subject": "Hello", "body": "Test message"}'
```

### Example Usage

#### Create Email Draft
```bash
curl -X POST http://localhost:5678/webhook-brick/create_email_draft \
  -H "Content-Type: application/json" \
  -H "X-Pulse-Key: your-brick-auth-key" \
  -d '{
    "to": "colleague@example.com",
    "subject": "Project Update",
    "body": "Hi! Here is the latest update on our project..."
  }'

# Response:
# {
#   "ok": true,
#   "data": {"draftId": "r1234567890"},
#   "brick": "create_email_draft",
#   "timestamp": "2024-01-15T10:30:00.000Z"
# }
```

#### Summarize Recent Emails
```bash
curl -X POST http://localhost:5678/webhook-brick/summarize_emails \
  -H "Content-Type: application/json" \
  -H "X-Pulse-Key: your-brick-auth-key" \
  -d '{"sinceISO": "2024-01-15T00:00:00.000Z"}'

# Response:
# {
#   "ok": true,
#   "data": {
#     "summary": "You received 3 emails: 2 project updates and 1 meeting invite.",
#     "emailCount": 3,
#     "timeRange": {"from": "2024-01-15T00:00:00.000Z", "to": "2024-01-15T10:30:00.000Z"}
#   },
#   "brick": "summarize_emails",
#   "timestamp": "2024-01-15T10:30:00.000Z"
# }
```

#### Create Calendar Event
```bash
curl -X POST http://localhost:5678/webhook-brick/create_calendar_event \
  -H "Content-Type: application/json" \
  -H "X-Pulse-Key: your-brick-auth-key" \
  -d '{
    "title": "Team Meeting",
    "startISO": "2024-01-16T09:00:00.000Z",
    "endISO": "2024-01-16T10:00:00.000Z",
    "guests": ["teammate@example.com"]
  }'

# Response:
# {
#   "ok": true,
#   "data": {
#     "eventId": "abc123def456",
#     "htmlLink": "https://calendar.google.com/calendar/event?eid=abc123def456"
#   },
#   "brick": "create_calendar_event",
#   "timestamp": "2024-01-15T10:30:00.000Z"
# }
```

#### List Today's Events
```bash
curl -X POST http://localhost:5678/webhook-brick/list_todays_events \
  -H "Content-Type: application/json" \
  -H "X-Pulse-Key: your-brick-auth-key" \
  -d '{}'

# Response:
# {
#   "ok": true,
#   "data": {
#     "events": [
#       {
#         "title": "Team Standup",
#         "start": "2024-01-15T09:00:00.000Z",
#         "end": "2024-01-15T09:30:00.000Z",
#         "location": "Conference Room A"
#       }
#     ]
#   },
#   "brick": "list_todays_events",
#   "timestamp": "2024-01-15T10:30:00.000Z"
# }
```

### Testing with Mock Mode

For development and testing, enable `MOCK_MODE=true` in your environment. This returns canned responses without calling external APIs:

```bash
# Enable mock mode in .env
MOCK_MODE=true

# Test with mock responses
curl -X POST http://localhost:5678/webhook-brick/create_email_draft \
  -H "Content-Type: application/json" \
  -H "X-Pulse-Key: your-brick-auth-key" \
  -d '{"to": "test@example.com", "subject": "Test", "body": "Test body"}'

# Returns: {"ok": true, "data": {"draftId": "mock-draft-123"}, ...}
```

### Rate Limiting

Bricks include built-in rate limiting to prevent API abuse:

- **Daily Limit**: Configurable via `BRICK_RATE_LIMIT_REQUESTS` (default: 100 requests/day per API key)
- **Rate Exceeded Response**: HTTP 429 with `{"ok": false, "error": "Rate limit exceeded", "code": "RATE_LIMITED"}`

### API Collection

Import the Postman collection at `docs/Postman_Pulse_Bricks.json` for interactive testing and examples of all brick endpoints.

### Required Environment Variables for Bricks

```bash
# Brick authentication and configuration
BRICK_AUTH_KEY=your-secure-brick-auth-key-here
BRICK_RATE_LIMIT_REQUESTS=100
MOCK_MODE=false

# AI and external service configuration
GEMINI_DEFAULT_MODEL=gemini-1.5-flash-latest
GENERIC_TIMEZONE=UTC
GOOGLE_CALENDAR_ID=primary
```

## 📋 Environment Variables

| Variable                  | Description                      | Required | Default |
| ------------------------- | -------------------------------- | -------- | ------- |
| `N8N_BASIC_AUTH_USER`     | n8n web interface username       | ✅       | -       |
| `N8N_BASIC_AUTH_PASSWORD` | n8n web interface password       | ✅       | -       |
| `PULSE_HMAC_SECRET`       | HMAC secret for gateway auth     | ✅       | -       |
| `GEMINI_API_KEY`          | Google Gemini API key            | ✅       | -       |
| `GOOGLE_CLIENT_ID`        | Gmail OAuth2 client ID           | ✅       | -       |
| `GOOGLE_CLIENT_SECRET`    | Gmail OAuth2 client secret       | ✅       | -       |
| `TWILIO_ACCOUNT_SID`      | Twilio account SID               | ✅       | -       |
| `TWILIO_AUTH_TOKEN`       | Twilio auth token                | ✅       | -       |
| `TWILIO_FROM_NUMBER`      | Twilio phone number              | ✅       | -       |
| `USER_PHONE_NUMBER`       | Your phone for SMS notifications | ✅       | -       |
| `SMS_DAILY_LIMIT`         | Daily SMS sending limit          | ❌       | 50      |
| `SMS_PER_RUN_LIMIT`       | Max SMS per workflow run         | ❌       | 3       |
| `DB_POSTGRESDB_PASSWORD`  | PostgreSQL password              | ✅       | -       |

## 🔐 Gmail OAuth Setup

**⚠️ IMPORTANT - Testing Mode Limitation**: Gmail OAuth applications in testing mode are limited to 100 users maximum. This is sufficient for personal use and small team deployments. For production use with more users, you'll need to complete Google's verification process, which can take several weeks.

**For Development/Personal Use** (recommended for MVP):

1. **Create Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Note: Project name will be visible to users during OAuth consent

2. **Enable Gmail API**
   - Navigate to "APIs & Services" → "Library"
   - Search for "Gmail API" and click "Enable"
   - Wait for activation (usually takes 1-2 minutes)

3. **Configure OAuth Consent Screen**
   - Go to "APIs & Services" → "OAuth consent screen"
   - Choose "External" user type (for testing mode)
   - Fill in required fields: App name, User support email, Developer contact
   - Add your email to "Test users" list (required for testing mode)

4. **Create OAuth2 Credentials**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client IDs"
   - Application type: "Web application"
   - Name: "Pulse AI Secretary"
   - Authorized redirect URIs: `http://localhost:5678/rest/oauth2-credential/callback`

5. **Copy Credentials to .env**
   - Download JSON or copy Client ID and Client Secret
   - Add to your `.env` file as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

**Testing Mode Notes:**

- Maximum 100 users can authenticate
- No Google review required
- Perfect for personal/small team use
- OAuth consent screen shows "unverified app" warning (normal for testing mode)

## 🏗️ Architecture

```
Gmail → n8n Workflow → Gemini API → Gmail Draft → Twilio SMS
   ↓
PostgreSQL (workflow state & logs)
```

## 🔧 Development

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for health checks and validation)

### Local Development

```bash
# Install development dependencies
npm install

# Run linting and formatting
npm run lint
npm run format

# Type checking
npm run type-check

# Run tests
npm test
```

### Health Monitoring

- Health check endpoint: `http://localhost:3001/healthz`
- n8n metrics: `http://localhost:5678/metrics` (when enabled)
- Service logs: `docker compose logs -f`

## 🚀 Production Deployment

### Security Hardening

- n8n runs as non-root user (UID 1000)
- Remote credential editing disabled in production
- Auto-TLS available via Caddy + Let's Encrypt

### Cloud Deployment with Auto-TLS

**Option 1: Caddy Reverse Proxy (Recommended)**

1. **Install Caddy on your server**

   ```bash
   # Ubuntu/Debian
   sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
   sudo apt update && sudo apt install caddy

   # CentOS/RHEL/Fedora
   dnf install 'dnf-command(copr)'
   dnf copr enable @caddy/caddy
   dnf install caddy
   ```

2. **Create Caddyfile configuration**

   ```bash
   sudo nano /etc/caddy/Caddyfile
   ```

   Add the following configuration:

   ```caddy
   # Replace with your actual domain
   pulse.yourdomain.com {
       # Automatic HTTPS with Let's Encrypt
       tls your-email@yourdomain.com

       # Reverse proxy to n8n
       reverse_proxy localhost:5678 {
           # Health check
           health_uri /healthz
           health_interval 30s
           health_timeout 10s
       }

       # Security headers
       header {
           # HSTS
           Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
           # Prevent clickjacking
           X-Frame-Options "DENY"
           # XSS protection
           X-Content-Type-Options "nosniff"
           # Referrer policy
           Referrer-Policy "strict-origin-when-cross-origin"
       }

       # Rate limiting (optional)
       rate_limit {
           zone static_rl {
               key {remote_host}
               events 100
               window 1m
           }
       }
   }

   # Health check endpoint (optional separate subdomain)
   health.yourdomain.com {
       tls your-email@yourdomain.com
       reverse_proxy localhost:3001
   }
   ```

3. **Update your .env for production**

   ```bash
   # Enable secure cookies for HTTPS
   N8N_SECURE_COOKIE=true

   # Disable UI credential editing for security
   N8N_DISABLE_UI=true

   # Optional: Disable production main process warnings
   N8N_DISABLE_PRODUCTION_MAIN_PROCESS=false
   ```

4. **Start services**

   ```bash
   # Start Pulse services
   docker compose up -d

   # Start and enable Caddy
   sudo systemctl enable caddy
   sudo systemctl start caddy

   # Check Caddy status
   sudo systemctl status caddy
   ```

5. **Verify deployment**

   ```bash
   # Check HTTPS certificate
   curl -I https://pulse.yourdomain.com

   # Verify health check
   curl https://health.yourdomain.com/healthz
   ```

**Option 2: Docker Compose with Caddy Container**

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  # Extend existing services
  postgres:
    extends:
      file: docker-compose.yml
      service: postgres

  n8n:
    extends:
      file: docker-compose.yml
      service: n8n
    environment:
      # Production security settings
      N8N_SECURE_COOKIE: true
      N8N_DISABLE_UI: true
    # Remove port mapping (Caddy will handle)
    ports: []

  healthcheck:
    extends:
      file: docker-compose.yml
      service: healthcheck
    ports: []

  # Add Caddy for auto-TLS
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    environment:
      - DOMAIN=${DOMAIN:-pulse.yourdomain.com}
      - EMAIL=${ADMIN_EMAIL:-admin@yourdomain.com}
    depends_on:
      - n8n
      - healthcheck
    networks:
      - pulse-network

volumes:
  caddy_data:
  caddy_config:
```

**Production Deployment Commands**

```bash
# 1. Clone and configure
git clone <repository-url>
cd pulse-ai-secretary
cp .env.example .env

# 2. Edit .env with production values
nano .env
# Set DOMAIN=pulse.yourdomain.com
# Set ADMIN_EMAIL=admin@yourdomain.com
# Uncomment production security settings

# 3. Copy and customize Caddy configuration
cp Caddyfile.example Caddyfile
nano Caddyfile
# Replace yourdomain.com with your actual domain

# 4. Deploy with production configuration
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 5. Verify deployment
curl -I https://pulse.yourdomain.com
curl https://pulse.yourdomain.com/healthz
```

**Firewall Configuration**

```bash
# Allow HTTP and HTTPS traffic
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Block direct access to application ports
sudo ufw deny 5678/tcp
sudo ufw deny 3001/tcp

# Enable firewall
sudo ufw enable
```

**SSL Certificate Monitoring**

```bash
# Check certificate expiration
echo | openssl s_client -servername pulse.yourdomain.com -connect pulse.yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates

# Caddy automatically renews certificates, but you can force renewal:
sudo caddy reload --config /etc/caddy/Caddyfile
```

## 📊 Monitoring & Limits

### API Limits and Quotas

#### Google Gemini API (Free Tier)
- **Daily Token Limit**: 1,000,000 tokens/day
- **Rate Limit**: 15 requests per minute
- **Response Target**: <3s (95th percentile)
- **Monitoring**: Token usage tracked and logged

#### Gmail API
- **Daily Quota**: 1,000,000,000 quota units/day
- **Per User Rate**: 250 quota units/user/second
- **Typical Usage**: ~15 quota units per email processed
- **OAuth Limitation**: 100 users max in testing mode

#### Twilio SMS
- **Trial Account**: ~500 free SMS messages
- **Rate Limit**: 1 message per second
- **Daily Cap**: Configurable via `SMS_DAILY_LIMIT` (default: 50)
- **Per-Run Limit**: Maximum 3 SMS per workflow execution

### Performance Targets

- **Email Detection**: <30 seconds from Gmail arrival
- **Gemini Processing**: <3 seconds (95th percentile)
- **Draft Creation**: <5 seconds
- **SMS Delivery**: <10 seconds
- **End-to-End**: <45 seconds total processing time

### Monitoring Commands

```bash
# Check system health
curl http://localhost:3001/healthz

# Monitor API quotas
docker compose logs n8n | grep -E "(gemini_tokens|sms_count|gmail_quota)"

# Check performance metrics
docker compose logs n8n | grep "response_time" | tail -10

# View error rates
docker compose logs n8n | grep -E "(ERROR|WARN)" | tail -20
```

## 🛡️ Error Handling & Reliability

Pulse includes comprehensive error handling and logging to ensure reliable operation:

### Error Handling Features

- **Try-Catch Blocks**: Every workflow node has comprehensive error handling
- **Exponential Backoff**: API rate limiting with intelligent retry logic
- **Circuit Breakers**: Automatic service protection during outages
- **Database Retry**: Robust PostgreSQL connection handling
- **Secure Logging**: Sensitive data filtering and structured JSON logs

### Retry Mechanisms

- **Gemini API**: Exponential backoff for rate limits (HTTP 429) and quota exceeded (HTTP 403)
- **Database Operations**: Connection retry with circuit breaker pattern
- **SMS Delivery**: Automatic retry with fallback handling
- **Token Tracking**: Daily usage monitoring with limit enforcement

### Logging & Security

- **Structured Logging**: JSON format with timestamps and context
- **Data Sanitization**: Automatic filtering of API keys, tokens, and personal data
- **Component Loggers**: Separate loggers for email processing, API calls, SMS handling
- **Log Levels**: ERROR, WARN, INFO, DEBUG with configurable filtering

### Monitoring Integration

```bash
# Health check with error rates
curl http://localhost:3001/healthz

# View error logs
docker compose logs n8n | grep '"level":"ERROR"'

# Monitor API response times
docker compose logs n8n | grep '"component":"GeminiAPI"'
```

### Configuration

```bash
# Error handling environment variables
LOG_LEVEL=INFO                    # Logging verbosity
MAX_RETRIES=3                     # Maximum retry attempts
CIRCUIT_BREAKER_THRESHOLD=5       # Failures before circuit opens
GEMINI_DAILY_TOKEN_LIMIT=1000000  # Daily token usage limit
```

For detailed error handling documentation, see [docs/ERROR_HANDLING.md](docs/ERROR_HANDLING.md).

## 🔒 Security and Privacy

Pulse implements comprehensive security and privacy safeguards:

### Security Features

- **OAuth2 Authentication**: Minimal Gmail permissions with secure token handling
- **HTTPS Encryption**: All API communications use TLS 1.2+ encryption
- **Credential Security**: Encrypted credential storage with AES-256
- **Container Hardening**: Non-root users, read-only filesystems, dropped capabilities
- **Data Retention**: Automatic data cleanup with configurable retention periods

### Privacy Controls

- **Data Minimization**: Only processes necessary email content
- **Local Processing**: All data processing happens locally in Docker containers
- **No Telemetry**: Disabled data collection and external reporting
- **Anonymized Logging**: Personal data filtered from all logs
- **GDPR Compliance**: Data export and deletion capabilities

### Security Validation

```bash
# Run comprehensive security validation
node security/validate-security.js

# Check credential configuration
npm run security:validate

# Scan for security issues
npm run security:scan
```

### Production Security

```bash
# Production environment variables
NODE_ENV=production
N8N_SECURE_COOKIE=true
N8N_DISABLE_UI=true
N8N_ENCRYPTION_KEY=your-secure-32-character-key
N8N_DIAGNOSTICS_ENABLED=false
```

For complete security documentation, see [docs/SECURITY.md](docs/SECURITY.md).

## 🛠️ Troubleshooting

### Quick Diagnostics

```bash
# Run comprehensive health check
curl -s http://localhost:3001/healthz | jq '.'

# Validate environment configuration
./validate-env.sh

# Check all service status
docker compose ps

# View recent errors
docker compose logs --tail=50 n8n | grep -E "(ERROR|WARN)"
```

### Common Issues

#### Environment and Startup Issues

**n8n won't start**
```bash
# 1. Check environment variables
./validate-env.sh

# 2. Check database connection
docker compose logs postgres

# 3. Verify Docker resources
docker system df
docker system prune  # If low on space

# 4. Check port conflicts
netstat -tulpn | grep -E "(5678|3001|5432)"
```

**Missing environment variables**
```bash
# The validation script shows exactly what's missing:
❌ Missing required environment variable: GEMINI_API_KEY
❌ Missing required environment variable: GOOGLE_CLIENT_ID

# Fix by editing .env file with correct values
```

#### API and Authentication Issues

**Gmail OAuth errors**
```bash
# Common solutions:
# 1. Verify redirect URI in Google Console:
#    http://localhost:5678/rest/oauth2-credential/callback

# 2. Check OAuth consent screen test users
# 3. Clear browser cookies and retry OAuth flow

# 4. Test OAuth endpoint
curl -I https://accounts.google.com/.well-known/openid_configuration
```

**Gemini API errors**
```bash
# Check API key validity
curl -H "x-goog-api-key: $GEMINI_API_KEY" \
  https://generativelanguage.googleapis.com/v1beta/models

# Monitor token usage
docker compose logs n8n | grep "gemini_tokens_used"

# Check for rate limiting
docker compose logs n8n | grep -E "(429|rate_limit)"
```

**SMS not sending**
```bash
# 1. Verify Twilio credentials
curl -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID.json

# 2. Check SMS rate limits
cat .sms-counts.json | jq '.'

# 3. Verify phone number format (+1234567890)
echo $USER_PHONE_NUMBER

# 4. Check Twilio account status (trial vs paid)
```

#### Performance Issues

**Slow response times**
```bash
# Check system resources
docker stats --no-stream

# Monitor API response times
docker compose logs n8n | grep "response_time" | tail -10

# Check database performance
docker compose exec postgres psql -U n8n -d n8n -c "
  SELECT query, mean_time, calls 
  FROM pg_stat_statements 
  ORDER BY mean_time DESC LIMIT 5;"
```

**High memory usage**
```bash
# Check container memory usage
docker stats --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}"

# Restart services if needed
docker compose restart n8n

# Check for memory leaks
docker compose logs n8n | grep -i "memory\|heap"
```

#### Workflow Issues

**Workflow not triggering**
```bash
# Check Gmail trigger status
docker compose logs n8n | grep -i "gmail.*trigger"

# Verify OAuth token is valid
docker compose logs n8n | grep -i "oauth.*refresh"

# Test manual workflow execution in n8n UI
```

**Draft not created**
```bash
# Check Gmail API permissions
docker compose logs n8n | grep -i "gmail.*draft"

# Verify email thread handling
docker compose logs n8n | grep -i "thread"
```

### Diagnostic Commands

```bash
# Complete system status
echo "=== Service Status ==="
docker compose ps

echo "=== Health Check ==="
curl -s http://localhost:3001/healthz | jq '.'

echo "=== Resource Usage ==="
docker stats --no-stream

echo "=== Recent Errors ==="
docker compose logs --tail=20 n8n | grep -E "(ERROR|WARN)"

echo "=== API Quotas ==="
echo "SMS Count: $(cat .sms-counts.json 2>/dev/null | jq -r '.dailyCount // 0')"
echo "Gemini Tokens: $(docker compose logs --since=24h n8n | grep 'gemini_tokens_used' | tail -1 | grep -o '[0-9]*' | tail -1)"
```

### Log Analysis

```bash
# View all service logs
docker compose logs -f

# Filter by service
docker compose logs -f n8n
docker compose logs -f postgres
docker compose logs -f healthcheck

# Filter by log level
docker compose logs n8n | grep -E "(ERROR|WARN|INFO)"

# Search for specific issues
docker compose logs n8n | grep -i "timeout"
docker compose logs n8n | grep -i "rate.limit"
docker compose logs n8n | grep -i "quota"
```

### Recovery Procedures

```bash
# Restart all services
docker compose restart

# Restart specific service
docker compose restart n8n

# Full reset (preserves data)
docker compose down
docker compose up -d

# Emergency reset (loses data)
docker compose down -v
docker compose up -d
```

For detailed troubleshooting guides, see:
- [Setup Guide](docs/SETUP_GUIDE.md) - Complete setup instructions
- [Gateway Setup](docs/GATEWAY_SETUP.md) - Manual workflow import and configuration
- [Production Deployment](docs/PRODUCTION_DEPLOYMENT.md) - Production troubleshooting
- [Monitoring Guide](docs/MONITORING_LIMITS.md) - Performance and monitoring

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Run tests: `npm test`
4. Commit changes: `git commit -m 'Add amazing feature'`
5. Push to branch: `git push origin feature/amazing-feature`
6. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [n8n Documentation](https://docs.n8n.io/)
- [Google Gemini API](https://ai.google.dev/)
- [Gmail API Reference](https://developers.google.com/gmail/api)
- [Twilio SMS API](https://www.twilio.com/docs/sms)
