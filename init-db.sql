-- Initialize PostgreSQL database for Pulse AI Secretary
-- This script runs automatically when the PostgreSQL container starts

-- Grant necessary permissions to n8n user
GRANT ALL PRIVILEGES ON DATABASE n8n TO n8n;

-- Create indexes for better n8n performance
-- Note: These indexes will be created after n8n creates its tables
-- They improve query performance for workflow execution history
CREATE INDEX IF NOT EXISTS idx_execution_entity_workflowid ON execution_entity(workflowid);
CREATE INDEX IF NOT EXISTS idx_execution_entity_finished ON execution_entity(finished);
CREATE INDEX IF NOT EXISTS idx_execution_entity_startedat ON execution_entity(startedat);

-- Log successful initialization
DO $
BEGIN
    RAISE NOTICE 'Pulse AI Secretary database initialized successfully';
    RAISE NOTICE 'Database optimized for n8n workflow execution';
END $;