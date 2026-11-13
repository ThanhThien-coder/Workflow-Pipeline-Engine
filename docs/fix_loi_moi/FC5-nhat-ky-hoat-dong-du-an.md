# FC5 — Nhật ký hoạt động của dự án (System log trong Settings) dùng dữ liệu thật

Người làm: C
Trạng thái: chưa làm
Lỗi xử lý: L16
Nhánh git: fix-fc5-nhat-ky-du-an
Làm trước: không. FC2 dùng lại API của task này.

> Viết tắt như FC4.

## Lỗi người dùng thấy
Settings → System audit log của dự án hiện dữ liệu giả.

## Nguyên nhân (đã đọc code)
- `FE/services/impl/HttpWorkflowService.ts` dòng 58 và 436–437: `getProjectAuditLogs` vẫn mock ("chưa có task").
- Backend không có API nhật ký dự án, DB không có bảng nhật ký.

## Cách sửa (đã chốt)
**Không thêm bảng mới.** Dựng nhật ký từ dữ liệu đã có (đọc, không ghi thêm), để không phải sửa service của người khác.
1. Backend `GET /api/v1/projects/{id}/activity?limit=50` (thành viên hoặc owner, dùng `verifyProjectMemberOrOwner`), controller và service **mới** của C. Gom các sự kiện, sắp mới nhất trước:
   | Loại | Lấy từ |
   | :--- | :--- |
   | Tạo dự án | `project.created_at`, owner |
   | Đổi trạng thái dự án (hiện tại) | `project.status`, `project.updated_at` |
   | Thành viên vào / rời / đổi role | lịch sử thành viên (`project_member`, có `/members/history` của D) |
   | Lời mời gửi / chấp nhận / từ chối / thu hồi | `project_invitation` |
   | Task đổi trạng thái (trạng thái hiện tại + lần cập nhật cuối) | `node.status`, `node.updated_at`, người phụ trách |
   | Nộp minh chứng | `artifacts` (người nộp, thời điểm, task) |
   | Link khách tạo / thu hồi | `guest_link` |
   | Góp ý của khách | `project_feedback` |
   Mỗi dòng: `id` (vd `node-12-updated`), `type`, `actorName`, `message` tiếng Việt ngắn, `targetCode` (mã task nếu có), `createdAt`.
   Ghi rõ trong code và màn hình: task chỉ có **lần đổi gần nhất** (DB không lưu lịch sử từng lần).
2. FE: `getProjectAuditLogs(projectId)` gọi API này, đổi sang kiểu `AuditLogItem` đang dùng; xóa khỏi `METHODS_STILL_MOCKED`. `SystemAuditLogSection.tsx` hiện danh sách có biểu tượng theo loại, thời gian tương đối, lọc theo loại; trống thì hiện trạng thái rỗng; lỗi thì hiện lỗi.
3. Viết hàm FE `fetchProjectActivity(projectId, limit)` trong `FE/services/impl/http/activity.ts` (mới) để FC2 dùng lại cho "Recent activity".

## Được sửa
- `BE/controller/ProjectActivityController.java` (mới), `BE/service/ProjectActivityService.java` (mới), `BE/dto/response/activity/**` (mới)
- `BE/repository/*.java` (chỉ thêm method đọc)
- `BE-test/**/ProjectActivity*` (mới)
- `FE/services/impl/http/activity.ts` (mới), `FE/services/impl/HttpWorkflowService.ts` (chỉ `getProjectAuditLogs` và dòng của nó trong `METHODS_STILL_MOCKED`), `FE/types/settings.types.ts` (chỉ thêm trường nếu cần), `FE/components/settings/SystemAuditLogSection.tsx`, test FE

## Test phải có
- Dự án mẫu: có dòng "tạo dự án", có dòng thành viên sarah, có dòng task WPE-xxx; sắp mới nhất trước; `limit` đúng.
- Người ngoài dự án → 403.

## Kiểm bằng tay
1. alex mời meomeo, meomeo chấp nhận, sarah nộp một task → Settings → System log thấy đủ 3 việc này ở đầu danh sách.

## Kết quả (Claude ghi, dán output thật)
