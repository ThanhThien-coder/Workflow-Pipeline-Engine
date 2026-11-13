# FA3 — Nhật ký hệ thống (System log) của admin: ghi thật, hiện rõ ràng

Người làm: A
Trạng thái: chờ kiểm
Lỗi xử lý: L22
Nhánh git: fix-fa3-nhat-ky-admin
Làm trước: FA2

> Viết tắt như FA1.

## Lỗi người dùng thấy
Tab System log của admin hiện dữ liệu giả, không rõ dòng nào nói về việc gì, bấm vào không ra gì.

## Nguyên nhân (đã đọc code)
- `getSecurityAuditLogs` chỉ có trong `MockAdminService`.
- DB không có bảng nhật ký nào (các bảng hiện có: users, refresh_token, pipeline_template, project, project_member, work_phase, node, node_dependency, artifacts, project_feedback, guest_link, notification, project_invitation, phase_dependency).

## Cách sửa (đã chốt)
**Nhật ký admin = sự kiện bảo mật và quản trị cấp hệ thống**, không phải hoạt động trong dự án (hoạt động dự án là FC5).

1. **Migration `MIG/V13__admin_audit_log.sql`** (báo nhóm số V13): bảng `admin_audit_log`
   `id BIGSERIAL`, `created_at TIMESTAMPTZ DEFAULT NOW()`, `actor_user_id BIGINT NULL` (null khi đăng nhập sai user không tồn tại), `actor_username VARCHAR(100)`, `action VARCHAR(50) NOT NULL`, `target_type VARCHAR(30)`, `target_id VARCHAR(50)`, `detail TEXT`, `ip_address VARCHAR(64)`; index theo `created_at DESC` và `action`.
2. **`BE/service/admin/AdminAuditService.record(...)`**: ghi 1 dòng, chạy trong transaction riêng (`REQUIRES_NEW`) để ghi log lỗi không làm hỏng nghiệp vụ chính.
3. **Các sự kiện ghi** (chỉ trong file của A):
   | action | Ghi ở đâu |
   | :--- | :--- |
   | `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`, `REGISTER` | `AuthService` |
   | `ACCOUNT_LOCKED_LOGIN` (user bị khóa cố đăng nhập) | `AuthService` |
   | `USER_SUSPENDED`, `USER_UNBANNED`, `WORKSPACE_ARCHIVED` | service admin của FA2 |
   Sự kiện template (`TEMPLATE_CREATED/UPDATED/DELETED`) do FD3 thêm sau (file của D).
4. **API** `GET /api/v1/admin/audit-logs?action=&from=&to=&page=&size=` (`ADMIN`), mới nhất trước, mặc định 50 dòng.
5. **FE**: `HttpAdminService.getSecurityAuditLogs` gọi API thật (sửa `IAdminService`/kiểu nếu cần tham số lọc). `AuditLogsTab.tsx` hiện bảng: Thời gian · Người thực hiện · Hành động (nhãn tiếng Việt + màu: đỏ cho thất bại/khóa, xanh cho thành công) · Đối tượng · Chi tiết · IP. Có lọc theo nhóm hành động (Đăng nhập / Quản trị / Template) và dòng mô tả ngắn ở đầu tab: "Nhật ký đăng nhập và thao tác quản trị trên toàn hệ thống". Không có gì để "bấm vào" thì bỏ hiệu ứng bấm.

## Được sửa
- `MIG/V13__admin_audit_log.sql` (mới), `BE/entity/AdminAuditLogEntity.java` (mới), `BE/repository/AdminAuditLogRepository.java` (mới)
- `BE/service/admin/**`, `BE/controller/AdminController.java`, `BE/service/auth/AuthService.java` (chỉ thêm lời gọi ghi log)
- `BE-test/**/admin/**`, `BE-test/service/auth/AuthServiceTest.java`
- `FE/services/admin/HttpAdminService.ts`, `FE/services/admin/IAdminService.ts`, `FE/types/admin.types.ts`, `FE/features/admin/tabs/AuditLogsTab.tsx`, `FE/hooks/useAdminPortal.ts`, test FE
- `docs/specs/database-schema.md` (thêm bảng mới)

## Test phải có
- Đăng nhập đúng/sai ghi đúng `action`; user không tồn tại vẫn ghi `LOGIN_FAILED` với `actor_user_id = null`.
- Khóa/mở khóa user ghi log có `target_id`.
- Ghi log ném lỗi thì đăng nhập vẫn thành công.
- `GET /admin/audit-logs`: user thường → 403; lọc theo `action` đúng.

## Kiểm bằng tay
1. Đăng nhập sai alex 1 lần, đúng 1 lần, admin khóa rồi mở khóa sarah.
2. Mở tab System log: thấy đủ 4 dòng, đúng thứ tự mới nhất trước, đúng người, đúng nhãn.

## Kết quả (ThanhThien-coder ghi)
- Đã hoàn thành toàn bộ yêu cầu của FA3 và mục 4 của FD3:
  + Backend:
    - Tạo file migration `wpe-backend/src/main/resources/db/migration/V13__admin_audit_log.sql` với bảng `admin_audit_log` và 2 index `created_at DESC` và `action` (không FK tới users).
    - Tạo `AdminAuditLogEntity`, `AdminAuditLogRepository`.
    - Tạo `AdminAuditAction` với 10 hằng số và 3 nhóm `LOGIN`, `ADMIN`, `TEMPLATE`.
    - Tạo `AdminAuditService`: hàm `record` chạy transaction `REQUIRES_NEW`, tự động tra cứu username, lấy IP client từ request, cắt detail tối đa 1000 ký tự và bọc try-catch không ném exception; hàm `search` hỗ trợ lọc theo nhóm, hành động, khoảng thời gian ISO, phân trang và hàm che IP `maskIp`.
    - Tạo DTO `AdminAuditLogResponse`, `AdminAuditLogPageResponse`.
    - Thêm `RefreshTokenService.findUserIdByRawToken`.
    - Ghi sự kiện trong `AuthService` (`LOGIN_SUCCESS`, `LOGIN_FAILED`, `ACCOUNT_LOCKED_LOGIN`, `REGISTER`, `LOGOUT`), `AdminUserService` (`USER_SUSPENDED`, `USER_UNBANNED`), `PipelineTemplateService` (`TEMPLATE_CREATED`, `TEMPLATE_UPDATED`, `TEMPLATE_DELETED`). **Đợt này chưa ghi WORKSPACE_ARCHIVED vì phần workspace chưa làm**.
    - Thêm endpoint `GET /api/v1/admin/audit-logs` trong `AdminController` có `@PreAuthorize("hasRole('ADMIN')")`.
    - Viết đầy đủ unit tests: `AuthServiceTest`, `AdminAuditServiceTest`, `AdminUserServiceTest`, `AdminControllerTest`, `PipelineTemplateServiceTest`.
  + Frontend:
    - `admin.types.ts`: Cập nhật `SecurityAuditLogDto` và type `AuditLogGroup`.
    - Cập nhật `IAdminService`, cài đặt `HttpAdminService.getSecurityAuditLogs`, cập nhật `MockAdminService` lọc theo group.
    - Cập nhật `useAdminPortal`: state `auditGroup`, hàm `setAuditGroup`.
    - Viết lại `AuditLogsTab`: hiển thị mô tả, bộ lọc nhóm nút bấm, cột bảng chuẩn, nhãn tiếng Việt, màu Tailwind xanh lá/đỏ, bỏ hiệu ứng click dòng, xử lý errorMessage và empty state.
    - `AdminPortalView`: truyền `group`, `onGroupChange`, `errorMessage` cho `AuditLogsTab`.
    - Viết đầy đủ unit tests: `HttpAdminService.test.ts`, `MockAdminService.test.ts`, `AuditLogsTab.test.tsx` (dùng `toBeTruthy()` / `queryByText(...).toBeNull()`, không dùng jest-dom).
  + Tài liệu:
    - Cập nhật mục 3.13 bảng `ADMIN_AUDIT_LOG` trong `docs/specs/database-schema.md`.
- Bổ sung theo de-xuat-lam-lai-admin.md: ghi ADMIN_ACCESS_DENIED cho request 403 vào /api/v1/admin/**; LOGIN_SUCCESS đã ghi cho mọi tài khoản, gồm admin.
