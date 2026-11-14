# FD1 — Làm lại Overview của admin: số liệu thật, bỏ thông tin thừa

Người làm: D
Trạng thái: chờ kiểm
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
Các file đã thêm và chỉnh sửa:
**Backend:**
- `wpe-backend/src/main/java/com/pipeline/wpe/controller/AdminController.java`: endpoints `GET /api/v1/admin/stats` và `GET /api/v1/admin/stats/trends`.
- `wpe-backend/src/main/java/com/pipeline/wpe/service/admin/AdminStatsService.java`: tính toán số liệu thống kê người dùng, dự án, task, template, vai trò từ DB và xu hướng theo ngày 7D/30D (task DONE theo ngày cập nhật cuối).
- `wpe-backend/src/main/java/com/pipeline/wpe/dto/response/admin/AdminStatsResponse.java`: DTO response thống kê (UserStats, ProjectStats, TaskStats, TemplateStats, RoleStats).
- `wpe-backend/src/main/java/com/pipeline/wpe/dto/response/admin/AdminTrendPointResponse.java`: DTO response điểm xu hướng theo ngày.
- `wpe-backend/src/test/java/com/pipeline/wpe/admin/AdminStatsServiceTest.java`: unit tests cho `AdminStatsService`.
- `wpe-backend/src/test/java/com/pipeline/wpe/admin/AdminControllerTest.java`: `@WebMvcTest` kiểm thử endpoints `/stats` và `/stats/trends` với phân quyền ADMIN.

**Frontend:**
- `wpe-frontend/src/types/admin.types.ts`: các DTO `AdminStatsDto`, `AdminTrendPointDto`, `AdminUserStatsDto`, `AdminProjectStatsDto`, `AdminTaskStatsDto`, `AdminTemplateStatsDto`, `AdminRoleStatsDto`.
- `wpe-frontend/src/services/admin/HttpAdminService.ts`: cài đặt phương thức `getStats()` và `getTrends(range)`.
- `wpe-frontend/src/hooks/useAdminPortal.ts`: quản lý `stats`, `trends`, `trendRange`, gọi `getStats` và `getTrends`.
- `wpe-frontend/src/features/admin/tabs/AnalyticsTab.tsx`: bố cục lại giao diện Overview theo số liệu thật từ DB, loại bỏ các ô số giả, hỗ trợ chuyển đổi khoảng xu hướng 7D/30D.
- `wpe-frontend/src/services/admin/__tests__/HttpAdminService.test.ts`: unit tests cho `getStats` và `getTrends`.
- `wpe-frontend/src/features/admin/__tests__/useAdminPortal.test.ts`: unit tests cho `useAdminPortal` với số liệu thống kê thật.

Người kiểm chạy test và E2E, xem báo cáo tổng.
