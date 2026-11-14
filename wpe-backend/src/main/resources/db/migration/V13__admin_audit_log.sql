CREATE TABLE admin_audit_log (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_user_id BIGINT NULL,
    actor_username VARCHAR(100),
    action VARCHAR(50) NOT NULL,
    target_type VARCHAR(30),
    target_id VARCHAR(50),
    detail TEXT,
    ip_address VARCHAR(64)
);
CREATE INDEX idx_admin_audit_log_created_at ON admin_audit_log (created_at DESC);
CREATE INDEX idx_admin_audit_log_action ON admin_audit_log (action);
