-- D2: chi chan trung loi moi dang PENDING; cho phep nhieu ban ghi REJECTED/ACCEPTED/EXPIRED/REVOKED cho cung (project, invitee)
ALTER TABLE project_invitation DROP CONSTRAINT IF EXISTS uq_pending_project_invitation;
CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_invitation ON project_invitation (project_id, invitee_id) WHERE status = 'PENDING';
