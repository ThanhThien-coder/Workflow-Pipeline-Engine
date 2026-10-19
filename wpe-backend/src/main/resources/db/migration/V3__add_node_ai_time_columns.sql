-- =============================================================================
-- WORKFLOW PIPELINE ENGINE — V3__add_node_ai_time_columns.sql
-- BỔ SUNG TRƯỜNG THỜI GIAN PHỤC VỤ PHÂN HỆ AI (CPM FORWARD PASS & TRAJECTORY DRIFT)
-- Theo đặc tả SSOT: docs/specs/ai-diagnostics.md (Mục 4.3)
-- Target DB: PostgreSQL 15+
-- =============================================================================

-- 1. Bổ sung cột estimated_hours: Thời gian ước tính hoàn thành tác vụ (giờ)
-- Đóng vai trò là Duration trong thuật toán CPM Forward Pass và tính ngưỡng Stalled Node (2.5 * estimated_hours)
ALTER TABLE node
ADD COLUMN estimated_hours INT NOT NULL DEFAULT 8;

-- 2. Bổ sung cột started_at: Thời điểm tác vụ thực tế bắt đầu thực thi (chuyển sang IN_PROGRESS)
-- Dùng để đo lường chính xác thời gian ngâm tác vụ: TimeInState(IN_PROGRESS) = (now - started_at)
ALTER TABLE node
ADD COLUMN started_at TIMESTAMPTZ DEFAULT NULL;

-- 3. Đánh chỉ mục tối ưu truy vấn phát hiện nút ngâm việc (Stalled Node Detection)
CREATE INDEX idx_node_started_at ON node(started_at);
