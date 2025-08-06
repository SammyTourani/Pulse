#!/bin/bash

# validate-env.sh - Environment variable validation script for Pulse AI Secretary
# Exits with non-zero code if required environment variables are missing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track validation status
VALIDATION_FAILED=0

# Function to check if environment variable is set and non-empty
check_env_var() {
    local var_name=$1
    local var_description=$2
    local is_optional=${3:-false}
    
    if [ -z "${!var_name}" ]; then
        if [ "$is_optional" = "false" ]; then
            echo -e "${RED}✗ Missing required environment variable: ${var_name}${NC}"
            echo -e "  Description: ${var_description}"
            VALIDATION_FAILED=1
        else
            echo -e "${YELLOW}⚠ Optional environment variable not set: ${var_name}${NC}"
            echo -e "  Description: ${var_description}"
        fi
    else
        echo -e "${GREEN}✓ ${var_name}${NC}"
    fi
}

echo "🔍 Validating Pulse AI Secretary environment variables..."
echo

# Required n8n configuration
echo "📋 n8n Configuration:"
check_env_var "N8N_BASIC_AUTH_ACTIVE" "Enable basic authentication for n8n web interface"
check_env_var "N8N_BASIC_AUTH_USER" "Username for n8n web interface"
check_env_var "N8N_BASIC_AUTH_PASSWORD" "Password for n8n web interface"

# Required database configuration
echo
echo "🗄️ Database Configuration:"
check_env_var "DB_POSTGRESDB_HOST" "PostgreSQL database host"
check_env_var "DB_POSTGRESDB_PORT" "PostgreSQL database port"
check_env_var "DB_POSTGRESDB_DATABASE" "PostgreSQL database name"
check_env_var "DB_POSTGRESDB_USER" "PostgreSQL database user"
check_env_var "DB_POSTGRESDB_PASSWORD" "PostgreSQL database password"

# Required API keys
echo
echo "🔑 API Keys:"
check_env_var "GEMINI_API_KEY" "Google Gemini API key for AI response generation"
check_env_var "GOOGLE_CLIENT_ID" "Google OAuth2 client ID for Gmail access"
check_env_var "GOOGLE_CLIENT_SECRET" "Google OAuth2 client secret for Gmail access"
check_env_var "TWILIO_ACCOUNT_SID" "Twilio account SID for SMS notifications"
check_env_var "TWILIO_AUTH_TOKEN" "Twilio authentication token"
check_env_var "TWILIO_FROM_NUMBER" "Twilio phone number for sending SMS"

# Required Pulse Gateway configuration
echo
echo "🔐 Pulse Gateway Security:"
check_env_var "PULSE_HMAC_SECRET" "HMAC secret for Pulse Gateway signature verification (32-character hex)"
check_env_var "BRICK_AUTH_KEY" "Authentication key for brick endpoints" true

# Required user configuration
echo
echo "👤 User Configuration:"
check_env_var "USER_PHONE_NUMBER" "User's phone number for SMS notifications"

# SMS rate limiting
echo
echo "📱 SMS Rate Limiting:"
check_env_var "SMS_DAILY_LIMIT" "Daily SMS sending limit (default: 50)" true
check_env_var "SMS_PER_RUN_LIMIT" "Maximum SMS per workflow run (default: 3)" true

# Optional monitoring configuration
echo
echo "📊 Monitoring (Optional):"
check_env_var "HEALTHZ_PORT" "Health check server port (default: 3001)" true
check_env_var "N8N_METRICS" "Enable n8n metrics endpoint (default: true)" true

# Security configuration
echo
echo "🔒 Security Configuration:"
check_env_var "N8N_SECURE_COOKIE" "Enable secure cookies for n8n (default: false)" true
check_env_var "N8N_DISABLE_PRODUCTION_MAIN_PROCESS" "Disable production main process (default: false)" true

echo
if [ $VALIDATION_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All required environment variables are set!${NC}"
    echo "🚀 Ready to start Pulse AI Secretary"
    exit 0
else
    echo -e "${RED}❌ Environment validation failed!${NC}"
    echo
    echo "📝 Please check your .env file and ensure all required variables are set."
    echo "💡 You can use .env.example as a template."
    exit 1
fi