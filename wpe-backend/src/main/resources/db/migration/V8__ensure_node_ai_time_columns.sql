-- Reapply the AI timing schema for databases that previously used V3
-- for user-profile columns before the migration histories were reconciled.
ALTER TABLE node
    ADD COLUMN IF NOT EXISTS estimated_hours INT NOT NULL DEFAULT 8;

ALTER TABLE node
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_node_started_at ON node(started_at);
