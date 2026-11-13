# FC5 — Nhật ký hoạt động của dự án (System log trong Settings) dùng dữ liệu thật

Người làm: C
Trạng thái: chờ kiểm
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

**File đã sửa**
- BE (mới): `BE/controller/ProjectActivityController.java` (`GET /api/v1/projects/{id}/activity?limit=50`), `BE/service/ProjectActivityService.java`, `BE/dto/response/activity/ProjectActivityItemResponse.java` (`id`, `type`, `actorName`, `message`, `targetCode`, `createdAt`).
  - Service chỉ đọc, kiểm quyền bằng `verifyProjectMemberOrOwner`, gom từ project, project_member, project_invitation, node, artifacts, guest_link, project_feedback. Sắp mới nhất trước, `limit` mặc định 50, tối đa 200.
  - Task chỉ sinh dòng khi `updatedAt` sau `createdAt` và chỉ có lần cập nhật gần nhất (DB không lưu lịch sử; có ghi trong code và trên màn hình).
  - Link khách luôn có dòng "tạo"; đã thu hồi thì thêm dòng "thu hồi", ghi rõ "không rõ thời điểm thu hồi".
- BE: `GuestLinkRepository`, `ProjectInvitationRepository` (thêm method đọc `findByProjectIdOrderByCreatedAtDesc`).
- FE (mới): `FE/services/impl/http/activity.ts`: `fetchProjectActivity(projectId, limit)` (FC2 dùng lại) và `mapActivityToAuditLog`.
- FE: `HttpWorkflowService.getProjectAuditLogs` gọi API thật, xóa dòng `getProjectAuditLogs` khỏi `METHODS_STILL_MOCKED`. `SystemAuditLogSection.tsx`: biểu tượng và nhãn theo loại, thời gian tương đối, lọc theo loại, trạng thái rỗng, chú thích về task. `settings.types.ts`: thêm loại sự kiện và trường tùy chọn `type`, `targetCode`.
- Lưu ý: khi API activity lỗi thì cả trang Settings hiện lỗi (qua `loadSettings`), không rơi về mock. Section đã có prop `error` nhưng chưa được nối, vì phải sửa `settingsSlice`/`SettingsView`, hai file nằm ngoài phạm vi FC5.

**Test đã thêm**
- BE `ProjectActivityServiceTest` (5 test): dự án mẫu có dòng tạo dự án, dòng thành viên sarah, dòng task WPE-xxx, sắp mới nhất trước, limit đúng; đủ loại lời mời, minh chứng, link khách, góp ý; người ngoài → 403; bỏ node chưa cập nhật; link thu hồi có cả dòng tạo.
- BE `ProjectActivityControllerTest` (2 test): 200 kèm danh sách; người ngoài → 403.
- FE `services/impl/http/__tests__/activity.test.tsx` (4 test).

**Output test thật** (13/11/2026)
- Trước khi sửa: FE `activity.test.tsx` lỗi `Failed to resolve import "../activity"`. BE: lớp mới nên test không biên dịch được trên code cũ.
- Sau khi sửa:
```text
./mvnw test       → 441 test, Failures 0, Errors 0, Skipped 1 (ProjectActivityServiceTest 5/5, ProjectActivityControllerTest 2/2)
npm run typecheck → tsc -b, exit 0
npm test          → Test Files 48 passed (48) | Tests 365 passed (365)
```
