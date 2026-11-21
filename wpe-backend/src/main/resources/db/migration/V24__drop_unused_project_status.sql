-- G34: trạng thái dự án còn 4 giá trị: DRAFT, ACTIVE, PAUSED, ARCHIVED.
-- PLANNING giống hệt DRAFT; COMPLETED bỏ (dự án xong vẫn ACTIVE, không dùng nữa thì lưu trữ);
-- INACTIVE không có đường chuyển vào. Đổi dữ liệu cũ sang giá trị còn lại.
-- Task của dự án PLANNING đã về LOCKED ở V23 nên không cần đụng bảng node.
UPDATE project SET status = 'DRAFT', updated_at = now() WHERE status = 'PLANNING';
UPDATE project SET status = 'ACTIVE', updated_at = now() WHERE status = 'COMPLETED';
UPDATE project SET status = 'ARCHIVED', updated_at = now() WHERE status = 'INACTIVE';
