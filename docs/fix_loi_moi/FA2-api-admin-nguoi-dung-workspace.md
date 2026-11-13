# FA2 — API admin thật: người dùng, workspace (bỏ MockAdminService)

Người làm: A
Trạng thái: chưa làm
Lỗi xử lý: L19 (phần người dùng, workspace)
Nhánh git: fix-fa2-api-admin
Làm trước: FA1 (cần đăng nhập được `admin` để kiểm)

> Viết tắt như FA1. Đặc tả gốc ở `docs/tasks/A-tai-khoan/A6-quan-tri-admin.md` mục "Đặc tả đã chốt". Task này làm đúng đặc tả đó, bỏ phần học.

## Lỗi người dùng thấy
Mọi tab admin hiện dữ liệu giả, bấm khóa user hay lưu trữ workspace không có tác dụng thật.

## Nguyên nhân (đã đọc code)
- `FE/services/container.ts`: `adminService: new MockAdminService()`, không phụ thuộc chế độ mock hay API thật.
- Backend không có controller nào dưới `/api/v1/admin/**`.
- `FE/services/admin/IAdminService.ts` có 9 phương thức: `getSystemKpis`, `getAnalyticsTrends`, `getRoleDistribution`, `getUsers`, `suspendUser`, `unbanUser`, `getWorkspaces`, `archiveWorkspace`, `getSecurityAuditLogs`.

## Cách sửa (đã chốt)
**Backend** (mọi endpoint có `@PreAuthorize("hasRole('ADMIN')")`):
- `GET /api/v1/admin/users?query=&status=ACTIVE|SUSPENDED` → danh sách user. Email che ở backend dạng `a***@pipeline.engine` (ký tự đầu + `***@` + tên miền). Có thêm: số dự án đang sở hữu, số dự án đang tham gia, ngày tạo.
- `POST /api/v1/admin/users/{id}/suspend` body `{ reason, durationDays }`: `is_locked = true`, `token_version += 1`, thu hồi mọi refresh token. Khóa user `ADMIN` → 403 mã `CANNOT_SUSPEND_ADMIN`. `durationDays` chỉ ghi log (chưa có cột), không thêm migration.
- `POST /api/v1/admin/users/{id}/unban`: `is_locked = false`.
- `GET /api/v1/admin/workspaces`: mỗi dự án gồm id, tên, owner (tên + email đã che), trạng thái, số thành viên, số phase, số node, % hoàn thành, `createdAt`, `updatedAt`. **Không** trả tiêu đề hay nội dung task.
- `POST /api/v1/admin/workspaces/{id}/archive`: đặt `ARCHIVED` (mọi trạng thái trừ ARCHIVED).

**Frontend:**
- `FE/services/admin/HttpAdminService.ts` (mới) cài `IAdminService`: 5 phương thức trên gọi API thật. `getSystemKpis`, `getAnalyticsTrends`, `getRoleDistribution` để FD1 làm; `getSecurityAuditLogs` để FA3 làm. Tạm thời các phương thức đó ném lỗi rõ ràng `"Chưa nối API (FD1/FA3)"`, **không** trả dữ liệu giả.
- `container.ts`: `adminService: isMock ? new MockAdminService() : new HttpAdminService()`.
- `UserManagementTab.tsx`, `WorkspacesTab.tsx`: chỉ sửa phần gọi service, hiện lỗi API ra toast. Không đổi bố cục (FD2 sẽ làm giao diện chi tiết workspace).

## Được sửa
- `BE/controller/AdminController.java` (mới), `BE/service/admin/**` (mới), `BE/dto/response/admin/**`, `BE/dto/request/admin/**` (mới)
- `BE/repository/UserRepository.java`, `ProjectRepository.java`, `RefreshTokenRepository.java`, `ProjectMemberRepository.java`, `NodeRepository.java`, `WorkPhaseRepository.java` (chỉ thêm method đếm/tìm)
- `BE/exception/GlobalExceptionHandler.java` (chỉ thêm handler ở cuối nếu cần)
- `BE-test/**/admin/**` (mới)
- `FE/services/admin/HttpAdminService.ts` (mới), `FE/services/container.ts` (chỉ dòng `adminService`), `FE/types/admin.types.ts`, `FE/hooks/useAdminPortal.ts`, `FE/features/admin/tabs/UserManagementTab.tsx`, `FE/features/admin/tabs/WorkspacesTab.tsx` (chỉ phần gọi service, báo lỗi), test FE

## Test phải có
- `@WebMvcTest` hoặc test service: admin gọi được; user thường → 403; không token → 401; khóa ADMIN → 403 `CANNOT_SUSPEND_ADMIN`; khóa user → `is_locked` bật, `token_version` tăng, refresh token bị thu hồi.
- Test chứng minh response `GET /admin/workspaces` không chứa tên task nào của dữ liệu mẫu (vd không có "WPE-001").
- Test hàm che email: email thường, phần trước `@` 1 ký tự, chuỗi không có `@`.

## Kiểm bằng tay
1. Đăng nhập `admin`. Tab Users hiện đúng `admin`, `alex.kim`, `sarah.chen` và các tài khoản mới tạo (vd meo).
2. Khóa `sarah.chen`. Ở tab khác, sarah đang đăng nhập bấm bất kỳ gì → bị đá ra trang đăng nhập. Mở khóa → sarah đăng nhập lại được.
3. Tab Workspaces hiện đúng các dự án trong DB. Lưu trữ một dự án → alex thấy dự án đó ở tab Archived.

## Kết quả (Claude ghi, dán output thật)
