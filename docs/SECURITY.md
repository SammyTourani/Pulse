# Security and Privacy Documentation

## Overview

Pulse AI Secretary implements comprehensive security and privacy safeguards to protect user data and ensure secure operation. This document outlines the security architecture, privacy controls, and compliance measures implemented to meet requirements 2.1-2.4.

## Security Architecture

### 1. OAuth2 Authentication (Requirement 2.1)

#### Gmail API Access
- **Minimal Permissions**: Uses only required OAuth2 scopes:
  - `gmail.readonly` - Read access to messages
  - `gmail.compose` - Create draft responses
  - `gmail.modify` - Mark messages as read
- **No Password Storage**: Uses OAuth2 tokens, never stores Gmail passwords
- **Token Refresh**: Automatic token refresh with secure storage
- **PKCE Support**: Enhanced security with Proof Key for Code Exchange

#### Configuration
```javascript
const GMAIL_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.modify'
];
```

#### Security Features
- State parameter validation to prevent CSRF attacks
- Secure redirect URI validation
- Token expiration monitoring
- Automatic scope validation

### 2. HTTPS and Encryption (Requirement 2.2)

#### Transport Security
- **HTTPS Enforcement**: All external API communications use HTTPS
- **TLS 1.2+**: Minimum TLS version for all connections
- **Certificate Validation**: Strict certificate validation for all requests
- **Secure Headers**: Security headers for all HTTP responses

#### Data Encryption
- **At Rest**: Database encryption with AES-256
- **In Transit**: TLS encryption for all network communications
- **Credential Storage**: Encrypted credential storage in n8n
- **Session Security**: Secure session cookies with HTTPS-only flag

#### Security Headers
```javascript
const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
};
```

### 3. Data Privacy and Retention (Requirement 2.3)

#### Data Minimization
- **Collect Only Necessary Data**: Only processes required email content
- **No Metadata Storage**: Strips unnecessary metadata from emails
- **Temporary Processing**: Email content processed temporarily, not stored long-term
- **Local Processing**: All processing happens locally, no external data persistence

#### Data Retention Policies
```javascript
const DATA_RETENTION_POLICIES = {
  emailContent: { retention: '7d', purgeAfter: '30d', encrypted: true },
  executionLogs: { retention: '30d', purgeAfter: '90d', encrypted: false },
  apiResponses: { retention: '24h', purgeAfter: '7d', encrypted: true },
  draftContent: { retention: '7d', purgeAfter: '30d', encrypted: true },
  smsData: { retention: '24h', purgeAfter: '7d', encrypted: true }
};
```

#### Privacy Controls
- **Telemetry Disabled**: No usage data sent to external services
- **Anonymization**: Personal data anonymized in logs
- **Data Export**: User data export capability (GDPR compliance)
- **Right to Deletion**: Complete data deletion on request

### 4. Production Security Settings (Requirement 2.4)

#### n8n Security Hardening
- **UI Disabled**: Credential editing disabled in production
- **Secure Cookies**: HTTPS-only session cookies
- **Basic Authentication**: Strong password requirements
- **Encryption Key**: AES-256 encryption for stored credentials
- **Resource Limits**: Memory and CPU limits to prevent abuse

#### Environment Configuration
```bash
# Production Security Settings
N8N_SECURE_COOKIE=true
N8N_DISABLE_UI=true
N8N_ENCRYPTION_KEY=your-secure-32-character-key
N8N_SESSION_COOKIE_SECURE=true
N8N_SESSION_COOKIE_SAME_SITE=strict
N8N_DIAGNOSTICS_ENABLED=false
```

#### Container Security
- **Non-root User**: All containers run as non-root (UID 1000)
- **Read-only Filesystem**: Root filesystem mounted read-only
- **Dropped Capabilities**: All Linux capabilities dropped
- **No New Privileges**: Security flag prevents privilege escalation
- **Resource Limits**: CPU and memory limits enforced

## Security Validation

### Automated Security Checks

The system includes comprehensive security validation:

```bash
# Run security validation
node security/validate-security.js
```

#### Validation Categories
1. **Credential Validation**: Checks all API keys and credentials
2. **OAuth Configuration**: Validates OAuth2 setup and scopes
3. **Encryption Settings**: Verifies HTTPS and encryption configuration
4. **Data Retention**: Checks data retention and privacy settings
5. **Production Security**: Validates production security hardening
6. **Security Scan**: Scans for common security issues

### Security Monitoring

#### Audit Logging
- **Security Events**: All security-related events logged
- **Access Logging**: API access and authentication events
- **Error Logging**: Security errors and failed attempts
- **Data Sanitization**: Sensitive data filtered from logs

#### Monitoring Endpoints
- **Health Checks**: `/healthz` endpoint with security status
- **Metrics**: Prometheus metrics for security monitoring
- **Audit Trail**: Complete audit trail for compliance

## Credential Management

### Secure Storage
- **Environment Variables**: Credentials stored as environment variables
- **Encrypted Storage**: n8n encrypts credentials in database
- **No Plaintext**: Credentials never stored in plaintext
- **Access Control**: Restricted access to credential storage

### Credential Validation
```javascript
const CREDENTIAL_PATTERNS = {
  GEMINI_API_KEY: /^AIza[0-9A-Za-z_-]{35}$/,
  GOOGLE_CLIENT_ID: /^[0-9]+-[0-9a-zA-Z_-]+\.apps\.googleusercontent\.com$/,
  TWILIO_ACCOUNT_SID: /^AC[a-zA-Z0-9]{32}$/,
  USER_PHONE_NUMBER: /^\+[1-9]\d{1,14}$/
};
```

### Best Practices
- **Strong Passwords**: Minimum 12 characters for all passwords
- **Key Rotation**: Regular rotation of API keys and passwords
- **Least Privilege**: Minimal required permissions for all credentials
- **Secure Generation**: Cryptographically secure key generation

## Database Security

### PostgreSQL Hardening
- **Authentication**: SCRAM-SHA-256 password encryption
- **SSL/TLS**: Encrypted connections required
- **Row-Level Security**: Fine-grained access control
- **Audit Logging**: Complete database activity logging
- **Connection Limits**: Maximum connection limits enforced

### Security Initialization
```sql
-- Enable security features
ALTER SYSTEM SET password_encryption = 'scram-sha-256';
ALTER SYSTEM SET ssl = on;
ALTER SYSTEM SET row_security = on;

-- Create audit logging
CREATE TABLE security_audit_log (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    event_type VARCHAR(50) NOT NULL,
    details JSONB
);
```

### Access Control
- **Application User**: Minimal privileges for n8n application
- **Monitor User**: Read-only access for monitoring
- **Admin User**: Full access for maintenance only
- **Public Schema**: Restricted public access

## Network Security

### Container Networking
- **Isolated Network**: Custom Docker network for service isolation
- **No External Ports**: Only necessary ports exposed
- **Internal Communication**: Services communicate internally only
- **Firewall Rules**: Host firewall configured for security

### Reverse Proxy Security
- **Caddy Integration**: Automatic HTTPS with Let's Encrypt
- **Rate Limiting**: Request rate limiting to prevent abuse
- **Security Headers**: Comprehensive security headers
- **Access Logging**: Complete access logging for monitoring

## Compliance and Privacy

### GDPR Compliance
- **Data Minimization**: Only necessary data collected
- **Purpose Limitation**: Data used only for stated purpose
- **Storage Limitation**: Automatic data deletion after retention period
- **Data Portability**: User data export functionality
- **Right to Deletion**: Complete data deletion capability

### Privacy by Design
- **Default Privacy**: Privacy-friendly defaults
- **Transparency**: Clear data handling documentation
- **User Control**: User control over data processing
- **Accountability**: Complete audit trail and logging

## Security Incident Response

### Incident Detection
- **Automated Monitoring**: Continuous security monitoring
- **Alert System**: Immediate alerts for security events
- **Log Analysis**: Automated log analysis for threats
- **Health Checks**: Regular security health checks

### Response Procedures
1. **Immediate Containment**: Isolate affected systems
2. **Assessment**: Determine scope and impact
3. **Notification**: Notify relevant stakeholders
4. **Recovery**: Restore secure operations
5. **Post-Incident**: Review and improve security measures

## Security Testing

### Automated Testing
```bash
# Run security validation
npm run security:validate

# Test credential validation
npm run security:test-credentials

# Scan for vulnerabilities
npm run security:scan
```

### Manual Testing
- **Penetration Testing**: Regular security assessments
- **Code Review**: Security-focused code reviews
- **Configuration Review**: Security configuration audits
- **Access Testing**: Authentication and authorization testing

## Security Updates

### Update Process
1. **Security Monitoring**: Monitor for security updates
2. **Impact Assessment**: Assess security update impact
3. **Testing**: Test updates in staging environment
4. **Deployment**: Deploy updates with minimal downtime
5. **Verification**: Verify security improvements

### Dependency Management
- **Vulnerability Scanning**: Regular dependency vulnerability scans
- **Update Automation**: Automated security updates where possible
- **Version Pinning**: Specific versions for reproducible builds
- **Security Advisories**: Monitor security advisories for dependencies

## Configuration Examples

### Development Environment
```bash
# Development security settings
NODE_ENV=development
N8N_SECURE_COOKIE=false
N8N_DISABLE_UI=false
LOG_LEVEL=debug
```

### Production Environment
```bash
# Production security settings
NODE_ENV=production
N8N_SECURE_COOKIE=true
N8N_DISABLE_UI=true
N8N_ENCRYPTION_KEY=your-secure-key
N8N_SESSION_COOKIE_SECURE=true
LOG_LEVEL=info
```

### Docker Security
```yaml
# Security-hardened container configuration
security_opt:
  - no-new-privileges:true
cap_drop:
  - ALL
read_only: true
user: "1000:1000"
```

## Troubleshooting Security Issues

### Common Issues

#### OAuth Authentication Failures
```bash
# Check OAuth configuration
node security/validate-security.js

# Verify redirect URI
echo $OAUTH_REDIRECT_URI

# Test OAuth flow
curl -I https://accounts.google.com/.well-known/openid_configuration
```

#### Certificate Issues
```bash
# Check certificate validity
openssl s_client -connect your-domain.com:443 -servername your-domain.com

# Verify certificate chain
curl -I https://your-domain.com
```

#### Database Connection Issues
```bash
# Test database connection
psql -h postgres -U n8n -d n8n -c "SELECT version();"

# Check SSL configuration
psql "sslmode=require host=postgres user=n8n dbname=n8n" -c "SHOW ssl;"
```

### Security Logs
```bash
# View security audit logs
docker compose logs n8n | grep "SecurityAudit"

# Check authentication events
docker compose logs n8n | grep "authentication"

# Monitor failed attempts
docker compose logs n8n | grep "failed"
```

This comprehensive security implementation ensures that Pulse AI Secretary operates with industry-standard security practices while maintaining user privacy and data protection.