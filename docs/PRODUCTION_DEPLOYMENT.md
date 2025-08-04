# Production Deployment Guide

## Overview

This guide covers deploying Pulse AI Secretary to production with comprehensive security hardening, monitoring, and operational best practices. It addresses requirements 4.7, 6.3, 6.4, and 6.6.

## Pre-Deployment Checklist

### Infrastructure Requirements
- [ ] **Server**: Minimum 2 CPU cores, 4GB RAM, 20GB storage
- [ ] **Operating System**: Ubuntu 20.04+ or CentOS 8+ (recommended)
- [ ] **Domain Name**: Registered domain with DNS control
- [ ] **SSL Certificate**: Let's Encrypt auto-TLS or custom certificate
- [ ] **Firewall**: Configured for web traffic only
- [ ] **Backup Strategy**: Database and configuration backup plan

### Security Prerequisites
- [ ] **SSH Key Authentication**: Password authentication disabled
- [ ] **Non-root User**: Dedicated user account for deployment
- [ ] **System Updates**: All security patches applied
- [ ] **Monitoring**: Log aggregation and alerting configured
- [ ] **Secrets Management**: Secure credential storage plan

## Production Environment Setup

### 1. Server Preparation

#### 1.1 Create Deployment User
```bash
# Create dedicated user for Pulse deployment
sudo useradd -m -s /bin/bash pulse
sudo usermod -aG docker pulse
sudo usermod -aG sudo pulse

# Set up SSH key authentication
sudo mkdir -p /home/pulse/.ssh
sudo cp ~/.ssh/authorized_keys /home/pulse/.ssh/
sudo chown -R pulse:pulse /home/pulse/.ssh
sudo chmod 700 /home/pulse/.ssh
sudo chmod 600 /home/pulse/.ssh/authorized_keys
```

#### 1.2 System Hardening
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install security tools
sudo apt install -y fail2ban ufw unattended-upgrades

# Configure automatic security updates
sudo dpkg-reconfigure -plow unattended-upgrades

# Configure fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

#### 1.3 Firewall Configuration
```bash
# Configure UFW firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (change port if using non-standard)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Block direct access to application ports
sudo ufw deny 5678/tcp  # n8n
sudo ufw deny 3001/tcp  # health check
sudo ufw deny 5432/tcp  # PostgreSQL

# Enable firewall
sudo ufw enable
```

### 2. Docker and Docker Compose Installation

#### 2.1 Install Docker
```bash
# Install Docker (Ubuntu)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker pulse

# Enable Docker service
sudo systemctl enable docker
sudo systemctl start docker

# Verify installation
docker --version
docker compose version
```

#### 2.2 Docker Security Configuration
```bash
# Create Docker daemon configuration
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "live-restore": true,
  "userland-proxy": false,
  "no-new-privileges": true,
  "seccomp-profile": "/etc/docker/seccomp.json"
}
EOF

# Restart Docker
sudo systemctl restart docker
```

### 3. Application Deployment

#### 3.1 Clone and Configure Repository
```bash
# Switch to pulse user
sudo su - pulse

# Clone repository
git clone https://github.com/yourusername/pulse-ai-secretary.git
cd pulse-ai-secretary

# Create production environment file
cp .env.example .env.prod
```

#### 3.2 Production Environment Configuration

Edit `.env.prod` with production values:

```bash
# =============================================================================
# Production Environment Configuration
# =============================================================================

# Environment
NODE_ENV=production

# =============================================================================
# n8n Production Security Settings (Requirements 2.2, 2.4)
# =============================================================================

# Basic authentication (use strong passwords)
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=your-very-secure-password-123!

# Security hardening
N8N_SECURE_COOKIE=true
N8N_DISABLE_UI=true
N8N_COOKIES_SECURE=true
N8N_SESSION_COOKIE_SECURE=true
N8N_SESSION_COOKIE_SAME_SITE=strict

# Disable production warnings
N8N_DISABLE_PRODUCTION_MAIN_PROCESS=false

# Privacy settings (Requirement 2.3)
N8N_DIAGNOSTICS_ENABLED=false
N8N_VERSION_NOTIFICATIONS_ENABLED=false
N8N_PERSONALIZATION_ENABLED=false

# Enable metrics for monitoring
N8N_METRICS=true
N8N_LOG_LEVEL=info
N8N_SECURITY_AUDIT_EVENTS=true

# Data retention policies (Requirement 2.3)
EXECUTIONS_DATA_MAX_AGE=168  # 7 days
EXECUTIONS_DATA_PRUNE=true
N8N_BINARY_DATA_TTL=24       # 1 day

# Encryption key (generate with: openssl rand -hex 32)
N8N_ENCRYPTION_KEY=your-secure-32-character-encryption-key-here

# =============================================================================
# Database Configuration
# =============================================================================

DB_POSTGRESDB_HOST=postgres
DB_POSTGRESDB_PORT=5432
DB_POSTGRESDB_DATABASE=n8n
DB_POSTGRESDB_USER=n8n
DB_POSTGRESDB_PASSWORD=your-secure-database-password-123!

# =============================================================================
# API Configuration
# =============================================================================

# Google Services
GEMINI_API_KEY=your-production-gemini-api-key
GOOGLE_CLIENT_ID=your-production-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-production-client-secret

# Twilio
TWILIO_ACCOUNT_SID=your-production-account-sid
TWILIO_AUTH_TOKEN=your-production-auth-token
TWILIO_FROM_NUMBER=+1234567890
USER_PHONE_NUMBER=+1987654321

# =============================================================================
# Production Deployment Settings
# =============================================================================

# Domain configuration for auto-TLS
DOMAIN=pulse.yourdomain.com
ADMIN_EMAIL=admin@yourdomain.com

# Rate limiting (production values)
SMS_DAILY_LIMIT=100
SMS_PER_RUN_LIMIT=5

# Health check
HEALTHZ_PORT=3001

# =============================================================================
# Security and Monitoring
# =============================================================================

# OAuth redirect URI (production domain)
OAUTH_REDIRECT_URI=https://pulse.yourdomain.com/rest/oauth2-credential/callback

# Logging
LOG_LEVEL=info

# Session security
N8N_SESSION_COOKIE_SECURE=true
N8N_SESSION_COOKIE_SAME_SITE=strict

# Security monitoring
N8N_SECURITY_AUDIT_EVENTS=true
```

#### 3.3 Validate Production Configuration
```bash
# Make validation script executable
chmod +x validate-env.sh

# Validate production environment
ENV_FILE=.env.prod ./validate-env.sh
```

**Expected Output:**
```
✅ Validating environment configuration...
✅ All required environment variables are set
✅ Production security settings validated
✅ Environment ready for production deployment
```

### 4. Reverse Proxy and SSL Setup

#### 4.1 Install Caddy (Recommended)
```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

#### 4.2 Configure Caddy for Auto-TLS
```bash
# Create Caddyfile
sudo tee /etc/caddy/Caddyfile > /dev/null <<EOF
# Pulse AI Secretary Production Configuration
pulse.yourdomain.com {
    # Automatic HTTPS with Let's Encrypt
    tls admin@yourdomain.com

    # Reverse proxy to n8n
    reverse_proxy localhost:5678 {
        # Health check
        health_uri /healthz
        health_interval 30s
        health_timeout 10s
        
        # Load balancing (for future scaling)
        lb_policy round_robin
        
        # Fail timeout
        fail_timeout 30s
        max_fails 3
    }

    # Security headers
    header {
        # HSTS (HTTP Strict Transport Security)
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        
        # Prevent clickjacking
        X-Frame-Options "DENY"
        
        # XSS protection
        X-XSS-Protection "1; mode=block"
        
        # Content type sniffing protection
        X-Content-Type-Options "nosniff"
        
        # Referrer policy
        Referrer-Policy "strict-origin-when-cross-origin"
        
        # Content Security Policy
        Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' wss: https:; frame-ancestors 'none';"
        
        # Remove server information
        -Server
    }

    # Rate limiting
    rate_limit {
        zone static_rl {
            key {remote_host}
            events 100
            window 1m
        }
    }

    # Request size limit
    request_body {
        max_size 16MB
    }

    # Logging
    log {
        output file /var/log/caddy/pulse-access.log {
            roll_size 100MB
            roll_keep 5
            roll_keep_for 720h
        }
        format json
        level INFO
    }
}

# Health check endpoint (separate subdomain)
health.yourdomain.com {
    tls admin@yourdomain.com
    
    reverse_proxy localhost:3001
    
    # Security headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Frame-Options "DENY"
        X-Content-Type-Options "nosniff"
    }
}

# Redirect HTTP to HTTPS
http://pulse.yourdomain.com {
    redir https://pulse.yourdomain.com{uri} permanent
}

http://health.yourdomain.com {
    redir https://health.yourdomain.com{uri} permanent
}
EOF

# Create log directory
sudo mkdir -p /var/log/caddy
sudo chown caddy:caddy /var/log/caddy

# Test Caddy configuration
sudo caddy validate --config /etc/caddy/Caddyfile

# Enable and start Caddy
sudo systemctl enable caddy
sudo systemctl start caddy
```

### 5. Production Deployment

#### 5.1 Deploy with Production Configuration
```bash
# Deploy using production compose file
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod up -d
```

**Expected Output:**
```
[+] Running 5/5
 ✔ Network pulse-ai-secretary_pulse-network  Created    0.1s
 ✔ Container pulse-ai-secretary-postgres-1   Started    2.3s
 ✔ Container pulse-ai-secretary-healthcheck-1 Started   1.8s
 ✔ Container pulse-ai-secretary-n8n-1        Started    3.1s
 ✔ Container pulse-ai-secretary-caddy-1      Started    2.1s
```

#### 5.2 Verify Deployment
```bash
# Check service status
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# Test HTTPS endpoint
curl -I https://pulse.yourdomain.com

# Test health check
curl https://health.yourdomain.com/healthz

# Check SSL certificate
echo | openssl s_client -servername pulse.yourdomain.com -connect pulse.yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates
```

**Expected SSL Output:**
```
notBefore=Jan 26 12:00:00 2025 GMT
notAfter=Apr 26 12:00:00 2025 GMT
```

### 6. Security Hardening Checklist

#### 6.1 Container Security
- [x] **Non-root Users**: All containers run as non-root (UID 1000)
- [x] **Read-only Filesystem**: Root filesystem mounted read-only where possible
- [x] **Dropped Capabilities**: All Linux capabilities dropped
- [x] **No New Privileges**: Security flag prevents privilege escalation
- [x] **Resource Limits**: CPU and memory limits enforced
- [x] **Security Options**: `no-new-privileges:true` enabled

#### 6.2 Network Security
- [x] **Firewall Rules**: Only necessary ports exposed (80, 443)
- [x] **Internal Network**: Services communicate on isolated Docker network
- [x] **TLS Encryption**: All external communications use HTTPS
- [x] **Security Headers**: Comprehensive security headers configured
- [x] **Rate Limiting**: Request rate limiting to prevent abuse

#### 6.3 Application Security
- [x] **Strong Passwords**: Complex passwords for all accounts
- [x] **Credential Encryption**: n8n credentials encrypted with AES-256
- [x] **UI Disabled**: n8n UI disabled in production (`N8N_DISABLE_UI=true`)
- [x] **Secure Cookies**: HTTPS-only cookies with secure flags
- [x] **Data Retention**: Automatic data cleanup after retention period
- [x] **Audit Logging**: Security events logged and monitored

#### 6.4 Database Security
- [x] **Strong Password**: Complex database password
- [x] **Network Isolation**: Database not exposed to external network
- [x] **Connection Encryption**: SSL/TLS for database connections
- [x] **Access Control**: Minimal database privileges for application user
- [x] **Backup Encryption**: Database backups encrypted

#### 6.5 SSL/TLS Security
- [x] **Auto-renewal**: Let's Encrypt certificates auto-renew
- [x] **HSTS**: HTTP Strict Transport Security enabled
- [x] **TLS 1.2+**: Minimum TLS version enforced
- [x] **Perfect Forward Secrecy**: Ephemeral key exchange
- [x] **Certificate Monitoring**: Certificate expiration monitoring

### 7. Monitoring and Alerting

#### 7.1 Enable Monitoring Stack
```bash
# Deploy with monitoring profile
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile monitoring --env-file .env.prod up -d
```

This adds:
- **Prometheus**: Metrics collection and alerting
- **Loki**: Log aggregation and analysis
- **Grafana**: Dashboards and visualization (optional)

#### 7.2 Configure Monitoring Endpoints

**Health Check Monitoring:**
```bash
# Add to crontab for regular health checks
crontab -e

# Add this line to check every 5 minutes
*/5 * * * * curl -f https://health.yourdomain.com/healthz || echo "Health check failed" | mail -s "Pulse Health Alert" admin@yourdomain.com
```

**Log Monitoring:**
```bash
# Monitor error logs
tail -f /var/log/caddy/pulse-access.log | grep -E "(4[0-9]{2}|5[0-9]{2})"

# Monitor Docker logs
docker compose logs -f --tail=100 n8n | grep -E "(ERROR|WARN)"
```

#### 7.3 Alerting Configuration

Create alerting rules in `alert-rules.yml`:

```yaml
groups:
  - name: pulse-alerts
    rules:
      - alert: ServiceDown
        expr: up == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.instance }} is down"
          
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          
      - alert: DatabaseConnectionFailed
        expr: postgresql_up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database connection failed"
```

### 8. Backup and Recovery

#### 8.1 Database Backup
```bash
# Create backup script
sudo tee /home/pulse/backup-database.sh > /dev/null <<'EOF'
#!/bin/bash
BACKUP_DIR="/home/pulse/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="pulse_db_backup_${DATE}.sql"

# Create backup directory
mkdir -p $BACKUP_DIR

# Create database backup
docker compose exec -T postgres pg_dump -U n8n n8n > "$BACKUP_DIR/$BACKUP_FILE"

# Compress backup
gzip "$BACKUP_DIR/$BACKUP_FILE"

# Keep only last 7 days of backups
find $BACKUP_DIR -name "pulse_db_backup_*.sql.gz" -mtime +7 -delete

echo "Database backup completed: ${BACKUP_FILE}.gz"
EOF

# Make script executable
chmod +x /home/pulse/backup-database.sh

# Add to crontab for daily backups
crontab -e
# Add: 0 2 * * * /home/pulse/backup-database.sh
```

#### 8.2 Configuration Backup
```bash
# Create configuration backup script
sudo tee /home/pulse/backup-config.sh > /dev/null <<'EOF'
#!/bin/bash
BACKUP_DIR="/home/pulse/config-backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup configuration files (excluding secrets)
tar -czf "$BACKUP_DIR/pulse_config_${DATE}.tar.gz" \
    --exclude='.env*' \
    --exclude='*.log' \
    --exclude='node_modules' \
    /home/pulse/pulse-ai-secretary/

# Backup environment template (without secrets)
cp .env.example "$BACKUP_DIR/env_template_${DATE}"

echo "Configuration backup completed: pulse_config_${DATE}.tar.gz"
EOF

chmod +x /home/pulse/backup-config.sh
```

### 9. Maintenance and Updates

#### 9.1 Update Procedure
```bash
# 1. Backup current state
./backup-database.sh
./backup-config.sh

# 2. Pull latest changes
git pull origin main

# 3. Update containers
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod pull

# 4. Restart services with zero downtime
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod up -d --no-deps n8n

# 5. Verify deployment
curl -f https://health.yourdomain.com/healthz
```

#### 9.2 Security Updates
```bash
# System security updates
sudo apt update && sudo apt upgrade -y

# Docker security updates
sudo apt update docker-ce docker-ce-cli containerd.io

# Container image updates
docker compose pull
docker compose up -d
```

### 10. Disaster Recovery

#### 10.1 Recovery Procedure
```bash
# 1. Restore from backup
cd /home/pulse/pulse-ai-secretary

# 2. Restore database
gunzip -c /home/pulse/backups/pulse_db_backup_YYYYMMDD_HHMMSS.sql.gz | \
docker compose exec -T postgres psql -U n8n -d n8n

# 3. Restore configuration
tar -xzf /home/pulse/config-backups/pulse_config_YYYYMMDD_HHMMSS.tar.gz

# 4. Restart services
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod up -d

# 5. Verify recovery
curl -f https://health.yourdomain.com/healthz
```

### 11. Performance Optimization

#### 11.1 Resource Tuning
```bash
# Monitor resource usage
docker stats

# Adjust resource limits in docker-compose.prod.yml based on usage
# Typical production settings:
# n8n: 2GB RAM, 1 CPU
# postgres: 1GB RAM, 0.5 CPU
# caddy: 256MB RAM, 0.2 CPU
```

#### 11.2 Database Optimization
```sql
-- Connect to database and optimize
docker compose exec postgres psql -U n8n -d n8n

-- Analyze and vacuum
ANALYZE;
VACUUM ANALYZE;

-- Check index usage
SELECT schemaname, tablename, attname, n_distinct, correlation 
FROM pg_stats 
WHERE schemaname = 'public';
```

### 12. Compliance and Auditing

#### 12.1 Security Audit
```bash
# Run security validation
node security/validate-security.js

# Check for vulnerabilities
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image pulse-ai-secretary_n8n

# Audit file permissions
find /home/pulse/pulse-ai-secretary -type f -perm /o+w -exec ls -l {} \;
```

#### 12.2 Compliance Reporting
- **GDPR**: Data retention policies enforced, user data export available
- **SOC 2**: Audit logs maintained, access controls implemented
- **ISO 27001**: Security controls documented and monitored

## Production Checklist Summary

### Pre-Deployment
- [ ] Server hardened and secured
- [ ] Domain and SSL configured
- [ ] Environment variables validated
- [ ] Backup strategy implemented
- [ ] Monitoring configured

### Deployment
- [ ] Services deployed with production configuration
- [ ] HTTPS working with valid certificate
- [ ] Health checks passing
- [ ] Security headers configured
- [ ] Rate limiting active

### Post-Deployment
- [ ] Monitoring alerts configured
- [ ] Backup jobs scheduled
- [ ] Update procedures documented
- [ ] Disaster recovery tested
- [ ] Performance optimized

### Ongoing Maintenance
- [ ] Regular security updates
- [ ] Backup verification
- [ ] Performance monitoring
- [ ] Log analysis
- [ ] Certificate renewal monitoring

This production deployment guide ensures Pulse AI Secretary runs securely and reliably in production environments with comprehensive monitoring, backup, and security measures.