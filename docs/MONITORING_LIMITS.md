# Monitoring, Limits, and Performance Guide

## Overview

This document provides comprehensive information about API limits, performance targets, monitoring procedures, and operational guidelines for Pulse AI Secretary. It addresses requirements 6.7 and provides operational guidance for maintaining system health.

## API Limits and Quotas

### Google Gemini API (Free Tier)

#### Daily Limits
- **Token Limit**: 1,000,000 tokens per day
- **Request Limit**: 15 requests per minute
- **Concurrent Requests**: 1 request at a time (free tier)
- **Model**: gemini-pro (text-only)

#### Token Calculation
```javascript
// Approximate token calculation
const estimateTokens = (text) => {
  // Rough estimate: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
};

// Example email processing
const emailContent = "Your email content here..."; // ~500 characters
const promptOverhead = "Generate a professional response..."; // ~100 characters
const totalTokens = estimateTokens(emailContent + promptOverhead); // ~150 tokens
```

#### Rate Limiting Behavior
- **HTTP 429**: Rate limit exceeded (15 requests/minute)
- **HTTP 403**: Daily quota exceeded (1M tokens/day)
- **Retry Strategy**: Exponential backoff with jitter

#### Monitoring Commands
```bash
# Check daily token usage
docker compose logs n8n | grep "gemini_tokens_used" | tail -10

# Monitor rate limiting
docker compose logs n8n | grep "rate_limit" | tail -10

# Check API response times
docker compose logs n8n | grep "gemini_response_time" | tail -10
```

### Gmail API Quotas

#### Daily Limits
- **Quota Units**: 1,000,000,000 per day
- **Per User Rate**: 250 quota units per user per second
- **Batch Requests**: 100 requests per batch

#### Quota Unit Costs
- **Read Message**: 5 quota units
- **Create Draft**: 10 quota units
- **Send Message**: 100 quota units
- **Watch Mailbox**: 2 quota units per setup

#### Typical Usage Calculation
```javascript
// Daily quota usage for 100 emails
const dailyEmails = 100;
const quotaPerEmail = 5 + 10; // Read + Create Draft
const dailyQuotaUsage = dailyEmails * quotaPerEmail; // 1,500 units
const percentageUsed = (dailyQuotaUsage / 1000000000) * 100; // 0.00015%
```

#### Monitoring
```bash
# Check Gmail API usage
docker compose logs n8n | grep "gmail_quota_used" | tail -10

# Monitor OAuth token refresh
docker compose logs n8n | grep "oauth_refresh" | tail -10
```

### Twilio SMS Limits

#### Trial Account Limits
- **Free Credits**: $15.50 (approximately 500 SMS messages)
- **Verified Numbers**: Can only send to verified phone numbers
- **Message Prefix**: "Sent from your Twilio trial account"
- **Rate Limit**: 1 message per second

#### Paid Account Limits
- **Rate Limit**: 1 message per second (default)
- **Daily Limit**: No inherent daily limit (billing-based)
- **Message Length**: 160 characters per SMS segment
- **International**: Additional charges apply

#### Cost Calculation
```javascript
// SMS cost calculation (US numbers)
const smsRate = 0.0075; // $0.0075 per SMS
const dailySMS = 50;
const monthlyCost = dailySMS * smsRate * 30; // $11.25/month
```

#### Monitoring
```bash
# Check SMS rate limiting
docker compose logs n8n | grep "sms_rate_limit" | tail -10

# Monitor daily SMS count
cat .sms-counts.json | jq '.'

# Check SMS delivery status
docker compose logs n8n | grep "sms_delivery" | tail -10
```

## Performance Targets

### Response Time Targets (Requirements 1.3, 3.1)

#### Email Processing Pipeline
- **Gmail Detection**: < 30 seconds (requirement)
- **Gemini Response**: < 3 seconds 95th percentile (requirement)
- **Draft Creation**: < 5 seconds
- **SMS Delivery**: < 10 seconds (requirement)
- **End-to-End**: < 45 seconds total

#### Performance Monitoring
```bash
# Monitor end-to-end processing time
docker compose logs n8n | grep "workflow_execution_time" | \
  awk '{print $NF}' | sort -n | tail -10

# Check 95th percentile response times
docker compose logs n8n | grep "gemini_response_time" | \
  awk '{print $NF}' | sort -n | awk 'BEGIN{c=0} {a[c++]=$1} END{print a[int(c*0.95)]}'
```

### Throughput Targets

#### Email Volume Capacity
- **Light Usage**: 1-10 emails/day
- **Medium Usage**: 10-50 emails/day
- **Heavy Usage**: 50-200 emails/day
- **Enterprise**: 200+ emails/day (requires scaling)

#### Resource Requirements by Volume
```yaml
# Light usage (1-10 emails/day)
resources:
  n8n:
    memory: 512MB
    cpu: 0.25
  postgres:
    memory: 256MB
    cpu: 0.1

# Medium usage (10-50 emails/day)
resources:
  n8n:
    memory: 1GB
    cpu: 0.5
  postgres:
    memory: 512MB
    cpu: 0.25

# Heavy usage (50-200 emails/day)
resources:
  n8n:
    memory: 2GB
    cpu: 1.0
  postgres:
    memory: 1GB
    cpu: 0.5
```

## Monitoring Procedures

### Health Check Monitoring

#### Automated Health Checks
```bash
# Add to crontab for continuous monitoring
crontab -e

# Check every 5 minutes
*/5 * * * * curl -f https://health.yourdomain.com/healthz || echo "Health check failed at $(date)" >> /var/log/pulse-health.log

# Check every hour with detailed logging
0 * * * * curl -s https://health.yourdomain.com/healthz | jq '.' >> /var/log/pulse-health-detailed.log
```

#### Health Check Response Analysis
```bash
# Analyze health check responses
tail -100 /var/log/pulse-health-detailed.log | jq -r '
  select(.status == "unhealthy") | 
  "\(.timestamp): \(.services | to_entries[] | select(.value.status == "down") | .key)"
'

# Check service response times
tail -100 /var/log/pulse-health-detailed.log | jq -r '
  .services | to_entries[] | 
  "\(.key): \(.value.response_time_ms // "N/A")ms"
'
```

### Performance Monitoring

#### Response Time Monitoring
```bash
# Create performance monitoring script
cat > /home/pulse/monitor-performance.sh << 'EOF'
#!/bin/bash

LOG_FILE="/var/log/pulse-performance.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

# Test health check response time
HEALTH_TIME=$(curl -w "%{time_total}" -s -o /dev/null https://health.yourdomain.com/healthz)

# Test n8n response time
N8N_TIME=$(curl -w "%{time_total}" -s -o /dev/null -u admin:password https://pulse.yourdomain.com/healthz)

# Log results
echo "$DATE,health_check,$HEALTH_TIME" >> $LOG_FILE
echo "$DATE,n8n_service,$N8N_TIME" >> $LOG_FILE

# Alert if response time > 5 seconds
if (( $(echo "$HEALTH_TIME > 5.0" | bc -l) )); then
    echo "ALERT: Health check response time: ${HEALTH_TIME}s" | \
    mail -s "Pulse Performance Alert" admin@yourdomain.com
fi
EOF

chmod +x /home/pulse/monitor-performance.sh

# Add to crontab every 10 minutes
echo "*/10 * * * * /home/pulse/monitor-performance.sh" | crontab -
```

#### Resource Usage Monitoring
```bash
# Monitor Docker container resources
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"

# Log resource usage
docker stats --no-stream --format "{{.Name}},{{.CPUPerc}},{{.MemUsage}}" | \
  sed 's/%//g' | sed 's/ //g' >> /var/log/pulse-resources.log
```

### Log Analysis and Alerting

#### Error Rate Monitoring
```bash
# Create error monitoring script
cat > /home/pulse/monitor-errors.sh << 'EOF'
#!/bin/bash

# Count errors in last hour
ERROR_COUNT=$(docker compose logs --since=1h n8n 2>/dev/null | grep -c "ERROR")
WARN_COUNT=$(docker compose logs --since=1h n8n 2>/dev/null | grep -c "WARN")

# Alert thresholds
ERROR_THRESHOLD=5
WARN_THRESHOLD=20

if [ $ERROR_COUNT -gt $ERROR_THRESHOLD ]; then
    echo "High error rate detected: $ERROR_COUNT errors in last hour" | \
    mail -s "Pulse Error Alert" admin@yourdomain.com
fi

if [ $WARN_COUNT -gt $WARN_THRESHOLD ]; then
    echo "High warning rate detected: $WARN_COUNT warnings in last hour" | \
    mail -s "Pulse Warning Alert" admin@yourdomain.com
fi

# Log metrics
echo "$(date '+%Y-%m-%d %H:%M:%S'),errors,$ERROR_COUNT,warnings,$WARN_COUNT" >> /var/log/pulse-errors.log
EOF

chmod +x /home/pulse/monitor-errors.sh

# Run every 30 minutes
echo "*/30 * * * * /home/pulse/monitor-errors.sh" | crontab -
```

#### API Quota Monitoring
```bash
# Create quota monitoring script
cat > /home/pulse/monitor-quotas.sh << 'EOF'
#!/bin/bash

# Extract quota usage from logs
GEMINI_TOKENS=$(docker compose logs --since=24h n8n 2>/dev/null | \
  grep "gemini_tokens_used" | tail -1 | grep -o '[0-9]*' | tail -1)

SMS_COUNT=$(cat .sms-counts.json 2>/dev/null | jq -r '.dailyCount // 0')

# Alert thresholds (80% of limits)
GEMINI_THRESHOLD=800000  # 80% of 1M tokens
SMS_THRESHOLD=40         # 80% of 50 SMS

if [ "${GEMINI_TOKENS:-0}" -gt $GEMINI_THRESHOLD ]; then
    echo "Gemini token usage high: $GEMINI_TOKENS tokens used today" | \
    mail -s "Pulse Quota Alert" admin@yourdomain.com
fi

if [ "${SMS_COUNT:-0}" -gt $SMS_THRESHOLD ]; then
    echo "SMS usage high: $SMS_COUNT SMS sent today" | \
    mail -s "Pulse SMS Alert" admin@yourdomain.com
fi

# Log quota usage
echo "$(date '+%Y-%m-%d %H:%M:%S'),gemini_tokens,${GEMINI_TOKENS:-0},sms_count,${SMS_COUNT:-0}" >> /var/log/pulse-quotas.log
EOF

chmod +x /home/pulse/monitor-quotas.sh

# Run every 2 hours
echo "0 */2 * * * /home/pulse/monitor-quotas.sh" | crontab -
```

## Operational Dashboards

### Command Line Dashboard
```bash
# Create real-time dashboard script
cat > /home/pulse/dashboard.sh << 'EOF'
#!/bin/bash

clear
echo "=== Pulse AI Secretary Dashboard ==="
echo "Generated: $(date)"
echo

# Service Status
echo "=== Service Status ==="
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo

# Health Check
echo "=== Health Check ==="
curl -s https://health.yourdomain.com/healthz | jq -r '
  "Overall Status: \(.status)",
  "n8n: \(.services.n8n.status) (\(.services.n8n.response_time_ms // "N/A")ms)",
  "PostgreSQL: \(.services.postgresql.status) (\(.services.postgresql.response_time_ms // "N/A")ms)",
  "Gemini API: \(.services.external_apis.gemini.status) (\(.services.external_apis.gemini.response_time_ms // "N/A")ms)",
  "Gmail API: \(.services.external_apis.gmail.status) (\(.services.external_apis.gmail.response_time_ms // "N/A")ms)",
  "Twilio API: \(.services.external_apis.twilio.status) (\(.services.external_apis.twilio.response_time_ms // "N/A")ms)"
'
echo

# Resource Usage
echo "=== Resource Usage ==="
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
echo

# Recent Activity
echo "=== Recent Activity (Last 10 entries) ==="
docker compose logs --tail=10 n8n 2>/dev/null | grep -E "(workflow|execution|error)" | tail -5
echo

# API Quotas
echo "=== API Quotas ==="
SMS_COUNT=$(cat .sms-counts.json 2>/dev/null | jq -r '.dailyCount // 0')
echo "SMS Count Today: $SMS_COUNT / 50"

GEMINI_TOKENS=$(docker compose logs --since=24h n8n 2>/dev/null | \
  grep "gemini_tokens_used" | tail -1 | grep -o '[0-9]*' | tail -1)
echo "Gemini Tokens Today: ${GEMINI_TOKENS:-0} / 1,000,000"
EOF

chmod +x /home/pulse/dashboard.sh

# Create alias for easy access
echo "alias pulse-dashboard='/home/pulse/dashboard.sh'" >> ~/.bashrc
```

### Web Dashboard Setup

#### Simple HTML Dashboard
```bash
# Create web dashboard
mkdir -p /home/pulse/web-dashboard
cat > /home/pulse/web-dashboard/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Pulse AI Secretary Dashboard</title>
    <meta http-equiv="refresh" content="30">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .status-ok { color: green; }
        .status-error { color: red; }
        .metric { margin: 10px 0; padding: 10px; border: 1px solid #ccc; }
        .header { background-color: #f0f0f0; padding: 10px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Pulse AI Secretary Dashboard</h1>
        <p>Last Updated: <span id="timestamp"></span></p>
    </div>
    
    <div class="metric">
        <h3>System Health</h3>
        <div id="health-status">Loading...</div>
    </div>
    
    <div class="metric">
        <h3>API Quotas</h3>
        <div id="quota-status">Loading...</div>
    </div>
    
    <script>
        document.getElementById('timestamp').textContent = new Date().toLocaleString();
        
        // Fetch health status
        fetch('/healthz')
            .then(response => response.json())
            .then(data => {
                const healthDiv = document.getElementById('health-status');
                const status = data.status === 'healthy' ? 'status-ok' : 'status-error';
                healthDiv.innerHTML = `<span class="${status}">Status: ${data.status}</span>`;
            })
            .catch(error => {
                document.getElementById('health-status').innerHTML = '<span class="status-error">Error loading health status</span>';
            });
    </script>
</body>
</html>
EOF

# Serve with simple HTTP server (for internal use only)
cd /home/pulse/web-dashboard
python3 -m http.server 8080 &
```

## Alerting Configuration

### Email Alerts Setup
```bash
# Install mail utilities
sudo apt install -y mailutils

# Configure postfix for sending emails
sudo dpkg-reconfigure postfix

# Test email sending
echo "Test email from Pulse monitoring" | mail -s "Test Alert" admin@yourdomain.com
```

### Slack Integration (Optional)
```bash
# Create Slack webhook integration
cat > /home/pulse/slack-alert.sh << 'EOF'
#!/bin/bash

SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"
MESSAGE="$1"
CHANNEL="#pulse-alerts"

curl -X POST -H 'Content-type: application/json' \
    --data "{\"channel\":\"$CHANNEL\",\"text\":\"$MESSAGE\"}" \
    $SLACK_WEBHOOK
EOF

chmod +x /home/pulse/slack-alert.sh

# Use in monitoring scripts
# ./slack-alert.sh "Pulse AI Secretary health check failed"
```

## Troubleshooting Performance Issues

### High Response Times
```bash
# Diagnose slow responses
# 1. Check system resources
top -p $(docker inspect --format '{{.State.Pid}}' $(docker compose ps -q))

# 2. Check database performance
docker compose exec postgres psql -U n8n -d n8n -c "
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;"

# 3. Check network latency to APIs
curl -w "@curl-format.txt" -s -o /dev/null https://generativelanguage.googleapis.com/v1beta/models
```

### High Memory Usage
```bash
# Check memory usage by container
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}"

# Check for memory leaks
docker compose exec n8n node -e "console.log(process.memoryUsage())"

# Restart services if needed
docker compose restart n8n
```

### Database Performance Issues
```bash
# Check database connections
docker compose exec postgres psql -U n8n -d n8n -c "
SELECT count(*) as active_connections 
FROM pg_stat_activity 
WHERE state = 'active';"

# Check slow queries
docker compose exec postgres psql -U n8n -d n8n -c "
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements 
WHERE mean_time > 1000 
ORDER BY mean_time DESC;"

# Vacuum and analyze
docker compose exec postgres psql -U n8n -d n8n -c "VACUUM ANALYZE;"
```

## Capacity Planning

### Scaling Indicators
- **CPU Usage**: Consistently > 70%
- **Memory Usage**: Consistently > 80%
- **Response Times**: 95th percentile > 5 seconds
- **Error Rate**: > 2%
- **Queue Depth**: Workflow executions backing up

### Scaling Options

#### Vertical Scaling
```yaml
# Increase resources in docker-compose.prod.yml
services:
  n8n:
    deploy:
      resources:
        limits:
          memory: 4G      # Increased from 2G
          cpus: '2.0'     # Increased from 1.0
```

#### Horizontal Scaling (Future Enhancement)
- Multiple n8n instances with load balancer
- Database read replicas
- Redis for session storage
- Message queue for workflow distribution

This comprehensive monitoring and limits guide ensures optimal operation of Pulse AI Secretary with proactive monitoring, alerting, and performance optimization.