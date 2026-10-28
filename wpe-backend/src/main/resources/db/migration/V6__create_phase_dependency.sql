-- =============================================================================
-- WORKFLOW PIPELINE ENGINE — V6__create_phase_dependency.sql
-- BẢNG NỐI PHASE_DEPENDENCY: CHO PHÉP MỘT MACRO PHASE CÓ NHIỀU PHASE TIỀN NHIỆM
-- Cột work_phase.parent_phase_id (V1) chỉ lưu được 1 cha, nối cha thứ 2 sẽ ghi đè cha cũ.
-- Cột cũ được giữ nguyên để tương thích ngược; dữ liệu hiện có được sao chép sang bảng mới.
-- Target DB: PostgreSQL 15+
-- =============================================================================

CREATE TABLE phase_dependency (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    parent_phase_id BIGINT NOT NULL REFERENCES work_phase(id) ON DELETE CASCADE,
    child_phase_id BIGINT NOT NULL REFERENCES work_phase(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_phase_dependency UNIQUE (parent_phase_id, child_phase_id),
    CONSTRAINT chk_phase_dependency_not_self CHECK (parent_phase_id <> child_phase_id)
);

-- Chỉ mục tối ưu truy vấn toàn bộ cạnh Phase của một dự án (phục vụ GET /projects/{id}/graph)
CREATE INDEX idx_phase_dependency_project ON phase_dependency(project_id);

-- Sao chép quan hệ cha-con hiện có từ cột cũ sang bảng nối
INSERT INTO phase_dependency (project_id, parent_phase_id, child_phase_id)
SELECT project_id, parent_phase_id, id
FROM work_phase
WHERE parent_phase_id IS NOT NULL
ON CONFLICT DO NOTHING;
