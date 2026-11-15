-- T6: chủ dự án mở khóa sớm một task (LOCKED -> TODO khi task trước chưa xong).
-- Lưu ai mở và lúc nào: để không khóa lại khi sửa dây phụ thuộc, và hiện trong nhật ký hoạt động.
ALTER TABLE node ADD COLUMN IF NOT EXISTS force_unlocked_by BIGINT NULL REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE node ADD COLUMN IF NOT EXISTS force_unlocked_at TIMESTAMPTZ NULL;
