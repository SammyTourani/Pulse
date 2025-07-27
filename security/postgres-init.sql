-- PostgreSQL Security Initialization Script
-- Implements security hardening for PostgreSQL database
-- Requirements: 2.3, 2.4

-- Enable logging for security monitoring
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_min_duration_statement = 1000;
ALTER SYSTEM SET log_connections = on;
ALTER SYSTEM SET log_disconnections = on;
ALTER SYSTEM SET log_checkpoints = on;
ALTER SYSTEM SET log_lock_waits = on;

-- Enable row-level security
ALTER SYSTEM SET row_security = on;

-- Set secure authentication methods
ALTER SYSTEM SET password_encryption = 'scram-sha-256';

-- Configure connection security
ALTER SYSTEM SET ssl = on;
ALTER SYSTEM SET ssl_prefer_server_ciphers = on;
ALTER SYSTEM SET ssl_min_protocol_version = 'TLSv1.2';

-- Set resource limits
ALTER SYSTEM SET max_connections = 20;
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';

-- Enable query statistics for monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Create audit log table for security events
CREATE TABLE IF NOT EXISTS security_audit_log (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    event_type VARCHAR(50) NOT NULL,
    user_name VARCHAR(100),
    database_name VARCHAR(100),
    command_tag VARCHAR(100),
    object_type VARCHAR(50),
    object_name VARCHAR(200),
    details JSONB,
    client_addr INET,
    application_name VARCHAR(100)
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_security_audit_timestamp ON security_audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_security_audit_event_type ON security_audit_log(event_type);

-- Create function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
    p_event_type VARCHAR(50),
    p_details JSONB DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO security_audit_log (
        event_type,
        user_name,
        database_name,
        details,
        client_addr,
        application_name
    ) VALUES (
        p_event_type,
        current_user,
        current_database(),
        p_details,
        inet_client_addr(),
        current_setting('application_name', true)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create data retention function
CREATE OR REPLACE FUNCTION cleanup_old_data() RETURNS VOID AS $$
BEGIN
    -- Clean up old execution data (older than 7 days)
    DELETE FROM execution_entity 
    WHERE "startedAt" < NOW() - INTERVAL '7 days';
    
    -- Clean up old audit logs (older than 90 days)
    DELETE FROM security_audit_log 
    WHERE timestamp < NOW() - INTERVAL '90 days';
    
    -- Log cleanup activity
    PERFORM log_security_event('data_cleanup', 
        jsonb_build_object('cleaned_at', NOW()));
END;
$$ LANGUAGE plpgsql;

-- Create user for n8n with minimal privileges
DO $$
BEGIN
    -- Create role if it doesn't exist
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'n8n_app') THEN
        CREATE ROLE n8n_app WITH LOGIN PASSWORD 'secure_app_password';
    END IF;
    
    -- Grant minimal required privileges
    GRANT CONNECT ON DATABASE n8n TO n8n_app;
    GRANT USAGE ON SCHEMA public TO n8n_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO n8n_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO n8n_app;
    
    -- Grant privileges on future tables
    ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO n8n_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT USAGE, SELECT ON SEQUENCES TO n8n_app;
END
$$;

-- Create read-only user for monitoring
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'n8n_monitor') THEN
        CREATE ROLE n8n_monitor WITH LOGIN PASSWORD 'secure_monitor_password';
    END IF;
    
    -- Grant read-only access
    GRANT CONNECT ON DATABASE n8n TO n8n_monitor;
    GRANT USAGE ON SCHEMA public TO n8n_monitor;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO n8n_monitor;
    GRANT SELECT ON security_audit_log TO n8n_monitor;
    
    -- Grant access to system views for monitoring
    GRANT SELECT ON pg_stat_database TO n8n_monitor;
    GRANT SELECT ON pg_stat_user_tables TO n8n_monitor;
    GRANT SELECT ON pg_stat_statements TO n8n_monitor;
END
$$;

-- Revoke public schema privileges from public role
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON DATABASE n8n FROM PUBLIC;

-- Create security policies for sensitive tables
-- Note: This would be expanded based on actual n8n table structure

-- Log initialization
SELECT log_security_event('database_initialized', 
    jsonb_build_object(
        'version', version(),
        'initialized_at', NOW(),
        'security_features', jsonb_build_array(
            'row_level_security',
            'audit_logging',
            'minimal_privileges',
            'ssl_encryption'
        )
    )
);

-- Reload configuration
SELECT pg_reload_conf();

COMMIT;