-- G34 (bước 2): bỏ luôn PAUSED, trạng thái dự án còn 3 giá trị: DRAFT, ACTIVE, ARCHIVED.
-- PAUSED chỉ chặn cộng tác viên nộp bài, trong khi hạn chót vẫn chạy và bị quét trễ hạn,
-- nên không có ý nghĩa với việc theo dõi tiến độ. Muốn dừng hẳn thì lưu trữ (ARCHIVED).
UPDATE project SET status = 'ACTIVE', updated_at = now() WHERE status = 'PAUSED';
