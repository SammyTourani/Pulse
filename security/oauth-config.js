/**
 * OAuth2 Configuration for Gmail API Access
 * Implements minimal permissions and secure credential handling
 * Requirements: 2.1, 2.2
 */

/**
 * Gmail OAuth2 Scopes - Minimal Required Permissions
 * Following principle of least privilege
 */
const GMAIL_OAUTH_SCOPES = [
  // Read access to Gmail messages (for monitoring new emails)
  'https://www.googleapis.com/auth/gmail.readonly',
  
  // Compose and send emails (for creating drafts)
  'https://www.googleapis.com/auth/gmail.compose',
  
  // Modify messages (for marking as read, threading)
  'https://www.googleapis.com/auth/gmail.modify'
];

/**
 * OAuth2 Configuration for n8n Gmail Credentials
 * This configuration should be used when setting up Gmail credentials in n8n
 */
const OAUTH2_CONFIG = {
  // OAuth2 URLs
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  accessTokenUrl: 'https://oauth2.googleapis.com/token',
  
  // Required scopes (minimal permissions)
  scope: GMAIL_OAUTH_SCOPES.join(' '),
  
  // Security parameters
  accessType: 'offline', // Get refresh token
  prompt: 'consent',     // Force consent screen
  includeGrantedScopes: false, // Don't include additional scopes
  
  // PKCE (Proof Key for Code Exchange) - Enhanced security
  usePKCE: true,
  
  // Token handling
  tokenType: 'Bearer',
  
  // Redirect URI (must match Google Cloud Console configuration)
  redirectUri: process.env.OAUTH_REDIRECT_URI || 'http://localhost:5678/rest/oauth2-credential/callback'
};

/**
 * Validate OAuth2 environment variables
 * @returns {Object} Validation result with missing variables
 */
function validateOAuthEnvironment() {
  const required = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  return {
    valid: missing.length === 0,
    missing: missing,
    configured: required.filter(key => process.env[key])
  };
}

/**
 * Generate secure OAuth2 state parameter
 * Used to prevent CSRF attacks during OAuth flow
 * @returns {string} Cryptographically secure random state
 */
function generateSecureState() {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validate OAuth2 redirect URI
 * Ensures redirect URI matches expected patterns for security
 * @param {string} redirectUri - URI to validate
 * @returns {boolean} True if URI is valid
 */
function validateRedirectUri(redirectUri) {
  const allowedPatterns = [
    /^http:\/\/localhost:\d+\/rest\/oauth2-credential\/callback$/,
    /^https:\/\/[a-zA-Z0-9.-]+\/rest\/oauth2-credential\/callback$/
  ];
  
  return allowedPatterns.some(pattern => pattern.test(redirectUri));
}

/**
 * Security headers for OAuth2 requests
 * Implements security best practices for API communications
 */
const SECURITY_HEADERS = {
  // Prevent caching of sensitive OAuth responses
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  'Pragma': 'no-cache',
  'Expires': '0',
  
  // Content security
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  
  // Referrer policy
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};

/**
 * OAuth2 token refresh configuration
 * Handles automatic token refresh for long-running workflows
 */
const TOKEN_REFRESH_CONFIG = {
  // Refresh token when it expires in less than 5 minutes
  refreshThreshold: 5 * 60 * 1000, // 5 minutes in milliseconds
  
  // Maximum retry attempts for token refresh
  maxRefreshRetries: 3,
  
  // Backoff delay between refresh attempts
  refreshRetryDelay: 1000, // 1 second
  
  // Token validation endpoint
  tokenInfoUrl: 'https://oauth2.googleapis.com/tokeninfo'
};

/**
 * Validate OAuth2 access token
 * Checks if token is valid and has required scopes
 * @param {string} accessToken - Token to validate
 * @returns {Promise<Object>} Validation result
 */
async function validateAccessToken(accessToken) {
  try {
    const response = await fetch(`${TOKEN_REFRESH_CONFIG.tokenInfoUrl}?access_token=${accessToken}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...SECURITY_HEADERS
      }
    });
    
    if (!response.ok) {
      return { valid: false, error: `HTTP ${response.status}` };
    }
    
    const tokenInfo = await response.json();
    
    // Check if token has required scopes
    const tokenScopes = tokenInfo.scope ? tokenInfo.scope.split(' ') : [];
    const hasRequiredScopes = GMAIL_OAUTH_SCOPES.every(scope => 
      tokenScopes.includes(scope)
    );
    
    return {
      valid: true,
      scopes: tokenScopes,
      hasRequiredScopes: hasRequiredScopes,
      expiresIn: tokenInfo.expires_in,
      audience: tokenInfo.aud
    };
    
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Security audit log for OAuth operations
 * Logs OAuth events without exposing sensitive data
 */
class OAuthSecurityLogger {
  constructor() {
    this.component = 'OAuthSecurity';
  }
  
  logTokenRefresh(success, attempt = 1) {
    const level = success ? 'info' : 'warn';
    const message = success ? 'OAuth token refreshed successfully' : 'OAuth token refresh failed';
    
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      component: this.component,
      event: 'token_refresh',
      success: success,
      attempt: attempt
    }));
  }
  
  logScopeValidation(hasRequiredScopes, actualScopes) {
    const level = hasRequiredScopes ? 'info' : 'error';
    const message = hasRequiredScopes ? 'OAuth scopes validated' : 'OAuth scopes insufficient';
    
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      component: this.component,
      event: 'scope_validation',
      hasRequiredScopes: hasRequiredScopes,
      requiredScopes: GMAIL_OAUTH_SCOPES,
      actualScopes: actualScopes
    }));
  }
  
  logSecurityEvent(event, details = {}) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'WARN',
      component: this.component,
      event: event,
      details: details
    }));
  }
}

// Export configuration and utilities
module.exports = {
  GMAIL_OAUTH_SCOPES,
  OAUTH2_CONFIG,
  SECURITY_HEADERS,
  TOKEN_REFRESH_CONFIG,
  validateOAuthEnvironment,
  generateSecureState,
  validateRedirectUri,
  validateAccessToken,
  OAuthSecurityLogger
};

// Make available for n8n workflows
if (typeof global !== 'undefined') {
  global.OAuthSecurityLogger = OAuthSecurityLogger;
  global.validateAccessToken = validateAccessToken;
}