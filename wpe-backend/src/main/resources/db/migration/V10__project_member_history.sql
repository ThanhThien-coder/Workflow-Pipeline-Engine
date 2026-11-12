-- Cach B: moi lan vao du an la 1 dong moi; chi 1 dong con hieu luc moi (project, user)
ALTER TABLE project_member DROP CONSTRAINT IF EXISTS uq_project_member;
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_project_member ON project_member (project_id, user_id) WHERE removed_at IS NULL;
