# FD1 — Làm lại Overview của admin: số liệu thật, bỏ thông tin thừa

Người làm: D
Trạng thái: chưa làm
Lỗi xử lý: L19 (phần Overview), L20
Nhánh git: fix-fd1-overview-admin
Làm trước: FA1 (đăng nhập admin). Song song được với FA2.

> Viết tắt như FA1.

## Lỗi người dùng thấy
Tab Overview (Analytics) của admin toàn số giả, nhiều ô không liên quan tới hệ thống này.

## Nguyên nhân (đã đọc code)
- `FE/features/admin/tabs/AnalyticsTab.tsx` (394 dòng) lấy dữ liệu qua `getSystemKpis`, `getAnalyticsTrends`, `getRoleDistribution` của `MockAdminService`.
- Backend không có API thống kê.

## Cách sửa (đã chốt)
**Nguyên tắc:** Overview admin chỉ hiện số **tính được từ DB**. Ô nào không tính được (doanh thu, uptime server, CPU, "AI score"...) thì **xóa**, không để số giả.

1. **Backend** `BE/controller/AdminStatsController.java` (mới, tách khỏi `AdminController` của A để không đụng file), `@PreAuthorize("hasRole('ADMIN')")`:
   - `GET /api/v1/admin/stats` trả:
     - Người dùng: tổng, đang hoạt động, bị khóa, mới trong 7 ngày.
     - Dự án: tổng, đếm theo trạng thái (DRAFT, PLANNING, ACTIVE, PAUSED, COMPLETED, ARCHIVED), mới trong 7 ngày.
     - Task (node): tổng, đếm theo trạng thái, số task trễ hạn.
     - Template: số PUBLIC, số PRIVATE, tổng lượt clone.
   - `GET /api/v1/admin/stats/trends?range=7D|30D`: theo từng ngày, số user mới, số dự án mới, số task chuyển DONE (dựa trên `created_at`/`updated_at` có sẵn; ghi chú rõ "task DONE theo ngày cập nhật cuối" vì không có cột thời điểm hoàn thành).
   - Phân bố vai trò: số user theo `system_role`, số dòng `project_member` theo role.
2. **Frontend**:
   - `HttpAdminService.getSystemKpis`, `getAnalyticsTrends`, `getRoleDistribution` gọi các API trên (file do A tạo ở FA2; D chỉ sửa 3 phương thức này). Chưa có FA2 thì tạo kiểu riêng ở `FE/types/admin-stats.types.ts` và gọi qua `FE/services/admin/adminStats.ts` (mới).
   - `AnalyticsTab.tsx` bố cục lại: hàng KPI (Người dùng · Dự án đang chạy · Task trễ hạn · Template), biểu đồ xu hướng 7D/30D, biểu đồ trạng thái dự án, phân bố vai trò. Bỏ hết các ô không có số thật.
   - Lỗi API → hiện thông báo lỗi trong tab, không hiện số giả.

## Được sửa
- `BE/controller/AdminStatsController.java` (mới), `BE/service/admin/AdminStatsService.java` (mới), `BE/dto/response/admin/stats/**` (mới)
- `BE/repository/*.java` (chỉ thêm method đếm)
- `BE-test/**/admin/AdminStats*` (mới)
- `FE/features/admin/tabs/AnalyticsTab.tsx`, `FE/features/admin/AdminPortalView.tsx` (chỉ phần Overview), `FE/types/admin-stats.types.ts` (mới), `FE/services/admin/adminStats.ts` (mới), `FE/services/admin/HttpAdminService.ts` (chỉ 3 phương thức trên), test FE

## Test phải có
- Service thống kê: với dữ liệu seed, số user = 3, số dự án theo trạng thái khớp SQL `SELECT status, COUNT(*) FROM project GROUP BY status`.
- User thường gọi `/admin/stats` → 403.

## Kiểm bằng tay
1. Đăng nhập admin, mở Overview: số user, dự án khớp thực tế (so với `psql`).
2. Tạo thêm 1 dự án bằng alex, tải lại Overview: số dự án tăng 1, xu hướng hôm nay tăng 1.
3. Không còn ô nào có số giả.

## Kết quả (Claude ghi, dán output thật)
