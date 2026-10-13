-- =============================================================================
-- WORKFLOW PIPELINE ENGINE — V1__init_schema.sql
-- 12 BẢNG CHUẨN HÓA 3NF THEO ĐẶC TẢ SSOT DATABASE SCHEMA
-- Target DB: PostgreSQL 15+
-- =============================================================================

-- 1. BẢNG USERS (Tài khoản người dùng & Quyền hạn hệ thống)
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    full_name VARCHAR(100),
    password_hash VARCHAR(255) NOT NULL,
    system_role VARCHAR(20) NOT NULL DEFAULT 'USER',
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    token_version INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. BẢNG REFRESH_TOKEN (Phiên làm việc & Token Rotation chống Replay Attack)
CREATE TABLE refresh_token (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. BẢNG PIPELINE_TEMPLATE (Kho mẫu quy trình chuẩn hệ thống)
CREATE TABLE pipeline_template (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL DEFAULT 'General',
    created_by BIGINT NOT NULL REFERENCES users(id),
    is_system_standard BOOLEAN NOT NULL DEFAULT FALSE,
    graph_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    clone_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. BẢNG PROJECT (Không gian làm việc & Dự án quy trình)
CREATE TABLE project (
    id BIGSERIAL PRIMARY KEY,
    owner_id BIGINT NOT NULL REFERENCES users(id),
    name VARCHAR(150) NOT NULL,
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    latest_ai_analysis JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. BẢNG PROJECT_MEMBER (Thành viên tham gia & Phân quyền dự án)
CREATE TABLE project_member (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(30) NOT NULL, -- OWNER, COLLABORATOR, VIEWER
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    removed_at TIMESTAMPTZ,    -- NULL = đang hoạt động, có giá trị = Soft Remove
    CONSTRAINT uq_project_member UNIQUE (project_id, user_id)
);

-- 6. BẢNG WORK_PHASE (Giai đoạn vĩ mô Macro Phase của dự án)
CREATE TABLE work_phase (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    parent_phase_id BIGINT REFERENCES work_phase(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    sub_title VARCHAR(255),
    accent_color VARCHAR(50),
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. BẢNG NODE (Tác vụ / Công việc trên đồ thị DAG)
CREATE TABLE node (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    phase_id BIGINT REFERENCES work_phase(id) ON DELETE SET NULL,
    code VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'LOCKED', -- LOCKED, TODO, IN_PROGRESS, REVIEW, DONE
    assigned_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    join_policy VARCHAR(30) NOT NULL DEFAULT 'ALL_COMPLETED', -- ALL_COMPLETED, ANY_COMPLETED
    reject_reason TEXT,
    due_date TIMESTAMPTZ,
    is_overdue BOOLEAN NOT NULL DEFAULT FALSE,
    version BIGINT NOT NULL DEFAULT 0, -- Khóa lạc quan JPA @Version
    ui_metadata JSONB NOT NULL DEFAULT '{}'::jsonb, -- Tọa độ {x, y, w, h, color}
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_project_node_code UNIQUE (project_id, code)
);

-- 8. BẢNG NODE_DEPENDENCY (Cạnh phụ thuộc có hướng giữa các Node trên đồ thị DAG)
CREATE TABLE node_dependency (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    parent_node_id BIGINT NOT NULL REFERENCES node(id) ON DELETE CASCADE,
    child_node_id BIGINT NOT NULL REFERENCES node(id) ON DELETE CASCADE,
    CONSTRAINT uq_node_dependency UNIQUE (parent_node_id, child_node_id),
    CONSTRAINT chk_diff_nodes CHECK (parent_node_id <> child_node_id)
);

-- 9. BẢNG ARTIFACTS (Tài nguyên minh chứng ngoài - Không lưu file vật lý trên server)
CREATE TABLE artifacts (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    node_id BIGINT REFERENCES node(id) ON DELETE SET NULL,
    uploaded_by BIGINT NOT NULL REFERENCES users(id),
    name VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL, -- PR, FIGMA, DOCS, SWAGGER, OTHER_LINK
    url VARCHAR(500) NOT NULL,
    is_in_repository BOOLEAN NOT NULL DEFAULT FALSE,
    is_public_for_guest BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. BẢNG PROJECT_FEEDBACK (Hàng đợi phản hồi 1 chiều từ GV/Khách - Tuyệt đối ko có reply)
CREATE TABLE project_feedback (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    node_id BIGINT REFERENCES node(id) ON DELETE SET NULL,
    reviewer_name VARCHAR(100) NOT NULL,
    reviewer_role VARCHAR(20) NOT NULL, -- TEACHER, GUEST
    content TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN', -- OPEN, RESOLVED
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. BẢNG GUEST_LINK (Chuỗi Token 64 ký tự bảo mật chia sẻ xem tiến độ Read-only)
CREATE TABLE guest_link (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. BẢNG NOTIFICATION (Thông báo quả chuông cá nhân in-app)
CREATE TABLE notification (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT,
    link_url VARCHAR(500),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES TỐI ƯU HÓA HIỆU NĂNG TRUY VẤN
-- =============================================================================
CREATE INDEX idx_node_project_assigned ON node(project_id, assigned_user_id);
CREATE INDEX idx_node_status ON node(status);
CREATE INDEX idx_node_dep_parent ON node_dependency(parent_node_id);
CREATE INDEX idx_node_dep_child ON node_dependency(child_node_id);
CREATE INDEX idx_proj_member_user ON project_member(user_id);
CREATE INDEX idx_guest_link_token ON guest_link(token);
CREATE INDEX idx_notification_user ON notification(user_id, is_read);
