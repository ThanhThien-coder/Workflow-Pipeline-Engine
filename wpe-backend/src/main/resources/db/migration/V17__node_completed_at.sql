-- AI T1: thời điểm task chuyển sang DONE, để dịch vụ AI tính số task xong trong 7 ngày gần nhất.
ALTER TABLE node ADD COLUMN completed_at TIMESTAMPTZ DEFAULT NULL;

-- Task đã DONE từ trước: chưa biết giờ xong thật, tạm lấy updated_at.
UPDATE node SET completed_at = updated_at WHERE status = 'DONE' AND completed_at IS NULL;
