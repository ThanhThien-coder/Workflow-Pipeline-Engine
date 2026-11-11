-- =============================================================================
-- WORKFLOW PIPELINE ENGINE — V9__work_phase_ui_metadata.sql
-- LƯU VỊ TRÍ / KÍCH THƯỚC THẺ MACRO PHASE TRÊN CANVAS
-- Trước V9 bảng work_phase không có cột tọa độ: kéo Phase rồi tải lại trang là mất vị trí.
-- Dạng dữ liệu: { "x": 280, "y": 140, "w": 250, "h": 220 }. Phase cũ nhận '{}' (chưa có vị trí).
-- Target DB: PostgreSQL 15+
-- =============================================================================

ALTER TABLE work_phase ADD COLUMN ui_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
