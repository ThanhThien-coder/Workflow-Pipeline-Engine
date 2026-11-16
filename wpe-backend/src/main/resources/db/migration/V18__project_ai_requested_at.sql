-- B3: thời điểm bấm chạy AI gần nhất. Dùng để giữ chỗ (chống bấm trùng) và tính cooldown 180 giây.
-- Chạy AI lỗi thì backend trả lại giá trị cũ, nên lỗi không tính cooldown.
ALTER TABLE project ADD COLUMN ai_requested_at TIMESTAMPTZ DEFAULT NULL;
