-- G33: dự án chưa Start (DRAFT/PLANNING) thì mọi task phải LOCKED.
-- Trước đây tạo dự án từ template để task gốc ở TODO, và "Unlock early" chạy được khi chưa Start.
-- Đưa các task TODO đó về LOCKED và xóa dấu mở sớm; Start project sẽ mở lại task gốc.
UPDATE node
SET status = 'LOCKED',
    force_unlocked_by = NULL,
    force_unlocked_at = NULL,
    version = version + 1
WHERE status = 'TODO'
  AND project_id IN (SELECT id FROM project WHERE status IN ('DRAFT', 'PLANNING'));
