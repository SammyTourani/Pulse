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

## 📋 Environment Variables

| Variable                  | Description                      | Required | Default |
| ------------------------- | -------------------------------- | -------- | ------- |
| `N8N_BASIC_AUTH_USER`     | n8n web interface username       | ✅       | -       |
| `N8N_BASIC_AUTH_PASSWORD` | n8n web interface password       | ✅       | -       |
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

### API Limits

- **Gemini Free Tier**: 1M tokens/day
- **Gmail API**: 1B quota units/day
- **Twilio Trial**: Limited SMS credits

### Performance Targets

- Gemini response time: <3s (95th percentile)
- Email processing: <30s end-to-end
- SMS delivery: <10s

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

### Common Issues

**n8n won't start**

```bash
# Check environment variables (exits with clear error messages)
./validate-env.sh

# Check database connection
docker compose logs postgres

# Verify all required variables are set
grep -v '^#' .env | grep -v '^$' | wc -l
# Should show 12+ non-empty variables
```

**Missing environment variables**
The `validate-env.sh` script will show exactly which variables are missing:

```
❌ Missing required environment variable: GEMINI_API_KEY
❌ Missing required environment variable: GOOGLE_CLIENT_ID
✅ All required environment variables are set
```

**Gmail OAuth errors**

- Verify redirect URI in Google Console
- Check OAuth2 scopes in n8n credentials
- Ensure testing mode allows your email

**SMS not sending**

- Verify Twilio credentials and phone number format
- Check daily/per-run SMS limits
- Review Twilio account status

### Logs

```bash
# View all service logs
docker compose logs -f

# View specific service
docker compose logs -f n8n
docker compose logs -f postgres
```

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
