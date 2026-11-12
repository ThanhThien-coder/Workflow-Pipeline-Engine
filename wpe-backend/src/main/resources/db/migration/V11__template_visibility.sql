-- Template PUBLIC (admin tao, ai cung thay) va PRIVATE (user luu tu du an cua minh, chi nguoi tao thay)
ALTER TABLE pipeline_template ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'PUBLIC';
ALTER TABLE pipeline_template ADD COLUMN IF NOT EXISTS source_project_id BIGINT REFERENCES project(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_pipeline_template_visibility_owner ON pipeline_template (visibility, created_by);
