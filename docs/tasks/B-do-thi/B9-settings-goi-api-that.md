# B9 — Màn Settings đọc thông tin dự án và vai trò từ backend thật

Người làm: B
Người review: C
Trạng thái: xong
Cần có trước: B6
Cần trước bước frontend: không
Mở khóa: không
Nhánh git: b-settings-that
Ước lượng: 0,5 ngày

> Task tạo ngày 12/11/2026 theo yêu cầu của người B, sau khi B6 phát hiện lỗi. A2 đã ghi `getProjectSettings` là "chưa có task nào nhận". Làm ở **chế độ sprint**: Claude làm hết, người B làm vòng hiểu.

## Vì sao cần task này
`HttpWorkflowService.getProjectSettings` vẫn gọi mock (nằm trong `METHODS_STILL_MOCKED`). Ở chế độ API thật, dự án nào và ai đăng nhập cũng nhận cùng một dữ liệu giả: id `'1'`, tên "Marketing Campaign Q4", trạng thái DRAFT, vai trò OWNER. Hệ quả:
1. Màn Settings hiện tên, trạng thái sai; xuất bản xong rồi F5, nhãn vẫn ghi DRAFT.
2. Khóa canvas theo vai trò (B5) không có tác dụng: sarah (COLLABORATOR) bị coi là OWNER nên vẫn thấy nút sửa đồ thị, bấm mới nhận 403.
3. Nút Publish từng gửi nhầm tới dự án 1 (B6 đã vá tạm bằng cách truyền `projectId` từ trang).

## Kiến thức phải nắm
Mẫu Adapter (đổi dữ liệu backend sang kiểu FE), "không tin client" (vai trò ở FE chỉ để hiện giao diện; backend mới là lớp chặn thật), suy ra dữ liệu khi backend chưa có endpoint trả sẵn.

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `FE/**`, `wpe-backend/src/**`, `docs/**`

## Được ghi
- `FE/services/impl/http/projectSettings.ts` (mới) và `FE/services/impl/http/__tests__/projectSettings.test.ts` (mới)
- `FE/services/impl/HttpWorkflowService.ts` (chỉ `getProjectSettings`, import, và danh sách `METHODS_STILL_MOCKED`)
- `docs/tasks/B-do-thi/B9-settings-goi-api-that.md`, `docs/tasks/B-do-thi/README.md` (thêm dòng B9), `docs/tasks/B-do-thi/B6-xuat-ban-giao-dien.md` (chỉ dòng "Mở khóa")

**Không ghi:** `FE/store/slices/settingsSlice.ts`, `FE/types/settings.types.ts` (của D2). Làm như vậy để không xung đột với PR của D.

## Đặc tả đã chốt
- `getProjectSettings(projectId)` gọi `GET /api/v1/projects/{id}` (`ProjectDetailResponse`), trả `ProjectSettingsDto`: `id`, `name`, `description` (null thì `''`), `status`, `ownerId` dạng chuỗi, `createdAt`, `updatedAt`, `myRole`.
- Backend chưa có trường "vai trò của tôi", nên `myRole` suy ra như sau:
  1. User đang đăng nhập (`getStoredUserId()`) trùng `ownerId` thì là `OWNER`; **không** gọi thêm request.
  2. Ngược lại gọi `GET /api/v1/projects/{id}/members`, lấy `role` của dòng có `userId` trùng (`MANAGER`, `COLLABORATOR`, `VIEWER`).
  3. Không có trong danh sách (ví dụ admin hệ thống) hoặc chưa đăng nhập thì là `VIEWER` (chỉ xem). Không bao giờ tự nhận `OWNER` khi không chắc.
- Lỗi (404, 403, mất mạng) thì ném `ApiError`, không trả dữ liệu giả.
- Xóa `getProjectSettings` khỏi `METHODS_STILL_MOCKED`.
- Giữ nguyên mock cho `updateProjectSettings`, `getProjectAuditLogs`, `getProjectMembersDetailed` (ngoài phạm vi).

## Việc cần làm
1. Viết test đỏ cho `getProjectSettings`: không còn trong danh sách mock; owner, COLLABORATOR, MANAGER, VIEWER, người ngoài danh sách, chưa đăng nhập; dự án không tồn tại.
2. Viết `projectSettings.ts`, nối vào `HttpWorkflowService`. Test xanh, `npm run typecheck && npm test` pass.
3. Chạy thật với backend: dự án mẫu 1 (alex OWNER, sarah COLLABORATOR), dự án 2 (PLANNING), dự án không tồn tại.

## Tiêu chí xong
- [x] Test của task fail trước khi sửa, pass sau khi sửa.
- [x] `npm run typecheck && npm test` pass.
- [x] Chạy thật: đúng tên, trạng thái, vai trò của từng user; dự án không tồn tại ra lỗi 404.
- [ ] Trình duyệt (buổi kiểm chung): sarah mở canvas dự án mẫu thì các nút sửa đồ thị bị vô hiệu hóa; alex thì sửa được; màn Settings hiện đúng tên, trạng thái.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. Backend không trả "vai trò của tôi", FE suy ra thế nào? Vì sao không biết thì chọn VIEWER mà không chọn OWNER?
2. FE tự tính vai trò rồi, sao backend vẫn phải kiểm quyền ở mọi API ghi?
3. Owner mở Settings thì gọi mấy request, Collaborator thì mấy request? Vì sao khác nhau?

## Cấm
- Sửa file ngoài mục "Được ghi". File dùng chung thì báo nhóm trước (README mục 6).
- Đọc, in, commit `.env*`, khóa, mật khẩu thật, API key. Dùng `git add -f`.
- Tự ghi trạng thái `xong`. Chỉ người review ghi sau khi kiểm.

## Ghi chép của người làm
> Phần này do Claude ghi (chế độ sprint). Người B đọc lại ở giai đoạn Học lại.

### Đã làm gì (file nào, vì sao)
1. **`FE/services/impl/http/projectSettings.ts` (mới):** `fetchProjectSettings(projectId)` gọi `GET /projects/{id}`, đổi sang `ProjectSettingsDto`, rồi suy ra `myRole` theo đặc tả (owner thì không gọi thêm; không chắc thì `VIEWER`).
2. **`FE/services/impl/HttpWorkflowService.ts`:** `getProjectSettings` gọi hàm trên thay cho `this.mock`, và đã xóa khỏi `METHODS_STILL_MOCKED`.
3. **`FE/services/impl/http/__tests__/projectSettings.test.ts` (mới):** 8 test.
4. Không sửa `settingsSlice.ts`, `settings.types.ts`. Các chỗ đang đọc settings (màn Settings, khóa canvas B5, nút Publish B6) tự nhận dữ liệu thật mà không phải sửa.
5. Rebase lên main `4f7932c` (đã có PR #33 vai trò MANAGER), thêm test cho MANAGER. Theo bảng phân quyền mới, MANAGER **xem** được đồ thị (UC19) nhưng **không sửa** được (UC10, UC11 chỉ Owner), nên khóa canvas của B5 cho MANAGER thấy chế độ chỉ xem là đúng.

### Kết quả test (dán output thật, không chép tay)
**Trước khi sửa** (`npx vitest run src/services/impl/http/__tests__/projectSettings.test.ts`, khi đó chưa có test MANAGER):
```
× getProjectSettings gọi backend thật > không còn nằm trong METHODS_STILL_MOCKED
× getProjectSettings gọi backend thật > owner (alex) xem dự án 5: đúng id, tên, mô tả, trạng thái thật; vai trò OWNER; không cần gọi danh sách thành viên
× getProjectSettings gọi backend thật > sarah xem dự án 5: vai trò lấy từ danh sách thành viên (COLLABORATOR)
× getProjectSettings gọi backend thật > thành viên VIEWER: vai trò VIEWER
× getProjectSettings gọi backend thật > không phải owner, không có trong danh sách thành viên (ví dụ admin hệ thống): chỉ xem (VIEWER)
× getProjectSettings gọi backend thật > chưa đăng nhập (không biết mình là ai): chỉ xem (VIEWER), không tự nhận là OWNER
× getProjectSettings gọi backend thật > dự án không tồn tại: ném ApiError 404, không trả dự án giả
AssertionError: expected [ 'getOverviewData', …(17) ] to not include 'getProjectSettings'
AssertionError: expected { id: '1', …(7) } to deeply equal { id: '5', …(7) }
AssertionError: expected 'OWNER' to be 'COLLABORATOR' // Object.is equality
AssertionError: expected 'OWNER' to be 'VIEWER' // Object.is equality
AssertionError: promise resolved "{ id: '1', …(7) }" instead of rejecting
Tests  7 failed (7)
```

**Sau khi sửa, trên main `4f7932c`** (`npm run typecheck && npm test`):
```
> tsc -b
 Test Files  38 passed (38)
      Tests  293 passed (293)
```

**Chạy thật vào backend cổng 8081** (test tạm, đã xóa; chỉ đọc, DB không đổi). Vai trò suy ra theo user lưu trong `wpe_auth_user`:
```
[LIVE] du an 1, user 2: {"id":"1","name":"Core Banking Pipeline","description":"Next-generation microservices banking workflow engine","status":"ACTIVE","ownerId":"2","myRole":"OWNER",...}
[LIVE] du an 1, user 3: {"id":"1","name":"Core Banking Pipeline",...,"status":"ACTIVE","ownerId":"2","myRole":"COLLABORATOR",...}
[LIVE] du an 2, user 2: {"id":"2","name":"a","description":"","status":"PLANNING","ownerId":"2","myRole":"OWNER",...}
[LIVE] du an 999: {"status":404,"code":"RESOURCE_NOT_FOUND","message":"Không tìm thấy dự án với ID: 999"}
```
Đã tắt backend cổng 8081.

### Điều chưa chắc / cần nhóm quyết
1. **Backend chưa có trường `myRole`** trong `ProjectDetailResponse`, nên người không phải owner tốn thêm 1 request (`/members`). Nếu backend thêm trường này thì FE bỏ được bước suy ra. Việc của D (`ProjectService`), không gấp.
2. **`ProjectStatus` trong `settings.types.ts` vẫn thiếu `PLANNING`, `PAUSED`, `COMPLETED`.** B9 ép kiểu giá trị backend gửi. Báo D thêm vào.
3. **Màn Settings vẫn còn phần giả:** danh sách thành viên (`getProjectMembersDetailed`, D2), đổi tên và mô tả (`updateProjectSettings`), nhật ký (`getProjectAuditLogs`). Hai hàm sau chưa task nào nhận.
4. **Admin hệ thống không phải thành viên** được backend cho xem dự án, nhưng FE xếp là `VIEWER` (chỉ xem). Đúng với ma trận RBAC (admin không có quyền thiết kế đồ thị).

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**

## Review của C (12/11/2026, chế độ sprint)
Đạt 2 tiêu chí review sprint, kiểm trên main `7d5a5b1` (PR #42 đã merge):
1. **Test xanh:** `npx vitest run src/services/impl/http/__tests__/projectSettings.test.ts` 8/8 (chạy cùng test B6, tổng 39/39); `npm run typecheck` sạch.
2. **File sửa:** 6 file, đều trong "Được ghi". Phần sửa `B6-xuat-ban-giao-dien.md` là dòng "Mở khóa", đúng giới hạn.

Đối chiếu `services/impl/http/projectSettings.ts` với "Đặc tả đã chốt": trùng owner thì `OWNER` không gọi thêm; ngược lại tra `/members`; không có tên hoặc chưa đăng nhập thì `VIEWER`. Lỗi đi qua `apiRequest` nên ném `ApiError`, không trả dữ liệu giả. Đạt.

Chưa kiểm: bước trình duyệt (sarah bị khóa nút sửa đồ thị, alex sửa được). Dời về buổi kiểm chung như tiêu chí ghi.
