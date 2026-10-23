-- =============================================================================
-- WORKFLOW PIPELINE ENGINE — V4__create_project_invitation.sql
-- TÁI THIẾT LẬP BẢNG PROJECT_INVITATION (QUY TRÌNH MỜI THÀNH VIÊN BẤT ĐỒNG BỘ)
-- Theo đặc tả SSOT: docs/specs/database-schema.md (Mục 3.5 & Bảng Quyết Định Mục 6)
-- Target DB: PostgreSQL 15+
-- =============================================================================

CREATE TABLE project_invitation (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    inviter_id BIGINT NOT NULL REFERENCES users(id),
    invitee_id BIGINT NOT NULL REFERENCES users(id),
    role VARCHAR(20) NOT NULL DEFAULT 'COLLABORATOR',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uq_pending_project_invitation UNIQUE (project_id, invitee_id, status)
);

-- Chỉ mục tối ưu truy vấn danh sách lời mời theo người dùng và trạng thái (phục vụ Topbar Popup)
CREATE INDEX idx_invitation_invitee_status ON project_invitation(invitee_id, status);

-- Chỉ mục tối ưu truy vấn danh sách lời mời đang chờ theo dự án (phục vụ Settings Members Tab)
CREATE INDEX idx_invitation_project_status ON project_invitation(project_id, status);
