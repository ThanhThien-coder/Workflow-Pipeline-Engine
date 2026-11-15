-- G17: minh chứng nộp kèm task trước đây không vào kho Artifacts (is_in_repository mặc định FALSE).
-- Đưa chúng vào kho; mỗi nhóm trùng hoàn toàn (cùng dự án, cùng tên, cùng link) chỉ một bản nằm trong kho
-- (bản có id nhỏ nhất), và bỏ qua nhóm đã có sẵn một bản trong kho.
UPDATE artifacts a
SET is_in_repository = TRUE
WHERE a.node_id IS NOT NULL
  AND a.is_in_repository = FALSE
  AND NOT EXISTS (
      SELECT 1 FROM artifacts b
      WHERE b.project_id = a.project_id AND b.name = a.name AND b.url = a.url AND b.is_in_repository = TRUE
  )
  AND a.id = (
      SELECT MIN(c.id) FROM artifacts c
      WHERE c.project_id = a.project_id AND c.name = a.name AND c.url = a.url
        AND c.node_id IS NOT NULL AND c.is_in_repository = FALSE
  );
