# A6 — Quản trị người dùng và workspace cho Admin (Cụm 10.1, 10.2)

Người làm: A
Người review: B
Trạng thái: chờ kiểm
Cần có trước: A2, A3
Cần trước bước frontend: không
Mở khóa: X1
Nhánh git: a6-admin
Ước lượng: 1,5 ngày

> ⚡ **Chế độ sprint:** task này **để lại sau hạn nộp**, làm theo chế độ thường (xem [SPRINT_2_NGAY.md](../SPRINT_2_NGAY.md) mục 6).

## Vì sao cần task này
Chưa có API admin. Tab `UserManagementTab` và `WorkspacesTab` đang dùng `MockAdminService`.

## Kiến thức phải nắm
Quyền cấp hệ thống (`users.system_role`) khác quyền cấp dự án (`project_member.role`). `@PreAuthorize("hasRole('ADMIN')")`, che dữ liệu nhạy cảm (data masking), và nguyên tắc admin không được xem nội dung task (`docs/specs/system-overview.md`, Phân hệ 5 mục 4).

## Bước 0 — Tự đọc, không dùng AI
Đọc: integration map mục 10.1, 10.2; `docs/specs/system-overview.md` (Phân hệ 5, UC4, UC6); `FE/services/admin/IAdminService.ts`, `FE/services/admin/MockAdminService.ts`, `FE/types/admin.types.ts`; `FE/features/admin/tabs/UserManagementTab.tsx`, `FE/features/admin/tabs/WorkspacesTab.tsx`.
Trả lời:
1. Admin khác Owner ở đâu? Vì sao admin được xem danh sách workspace mà không được xem task bên trong?
2. Email `alex.kim@pipeline.engine` che thành gì? Nên che ở backend hay frontend, vì sao?
3. Khóa một user đang đăng nhập: những bước nào khiến họ bị đá ra ngay?

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `wpe-backend/src/**`, `FE/**`, `docs/**`

## Được ghi
- `BE/controller/AdminController.java` (mới), `BE/service/admin/**` (mới), `BE/dto/request/admin/**`, `BE/dto/response/admin/**` (mới)
- `BE/repository/UserRepository.java`, `BE/repository/ProjectRepository.java`, `BE/repository/RefreshTokenRepository.java` (chỉ thêm method)
- `BE-test/**/admin/**` (test mới)
- `FE/services/admin/HttpAdminService.ts` (mới), `FE/services/container.ts` (chỉ dòng `adminService`), `FE/types/admin.types.ts`, `FE/features/admin/tabs/UserManagementTab.tsx`, `FE/features/admin/tabs/WorkspacesTab.tsx` (chỉ phần gọi service và báo lỗi), test FE
- `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md` (mục 10.1, 10.2), `docs/tasks/A-tai-khoan/A6-quan-tri-admin.md`

## Đặc tả đã chốt
- `GET /api/v1/admin/users?query=&status=ACTIVE|SUSPENDED` → `AdminUserDto[]`. Email che theo dạng: ký tự đầu + `***@` + tên miền, ví dụ `a***@pipeline.engine`. Che ở backend.
- `POST /api/v1/admin/users/{id}/suspend`, body `{ reason, durationDays }`: đặt `is_locked = true`, `token_version += 1`, thu hồi mọi refresh token. Không được khóa user có `system_role = ADMIN` → 403 `CANNOT_SUSPEND_ADMIN`. `durationDays` chưa có cột lưu hạn, nên chỉ ghi log; ghi rõ hạn chế này trong ghi chép, **không** tự thêm migration.
- `POST /api/v1/admin/users/{id}/unban`: đặt `is_locked = false`.
- `GET /api/v1/admin/workspaces`: danh sách dự án, chỉ gồm metadata (tên, owner, trạng thái, số thành viên, số node, `updatedAt`). Không trả tiêu đề hay nội dung task.
- `POST /api/v1/admin/workspaces/{id}/archive`: đặt `status = ARCHIVED`.
- Mọi endpoint admin dùng `@PreAuthorize("hasRole('ADMIN')")`, nên **bắt buộc JWT thật ngay từ task này**. Request chỉ có `X-Debug-User-Id` sẽ bị từ chối, vì không có principal trong `SecurityContext`.
- Giữ mock (chưa có trong SSOT): `getSystemKpis`, `getAnalyticsTrends`, `getRoleDistribution`, `getSecurityAuditLogs`.

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 Tự viết hàm che email kèm test: email bình thường, phần trước `@` chỉ có 1 ký tự, chuỗi không có `@`.
3. 🤝 Service, controller và test: `@WebMvcTest` với `@WithMockUser(roles = "ADMIN")` và với user không có quyền.
4. 🤝 `HttpAdminService`, nối 2 tab.
5. 🧠 Chạy thật: đăng nhập `admin` rồi khóa `sarah.chen`. Sarah đang mở app phải bị đá ra ở request kế tiếp. Mở khóa thì sarah đăng nhập lại được.

## Tiêu chí xong
- [ ] Test BE: admin gọi được; user thường → 403; khóa admin → 403 `CANNOT_SUSPEND_ADMIN`; khóa user thì `is_locked` bật, `token_version` tăng, refresh token bị thu hồi.
- [ ] Có test chứng minh `GET /admin/workspaces` không chứa tên task nào.
- [ ] Kịch bản bước 5 chạy đúng (ghi kết quả vào ghi chép).
- [ ] `npm test` pass.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. `@PreAuthorize` được kiểm ở đâu trong luồng request? Vì sao request chỉ có `X-Debug-User-Id` bị từ chối?
2. Vì sao không cho khóa ADMIN? Nếu hệ thống chỉ có 1 admin thì nên chặn thêm gì?
3. Muốn tự mở khóa sau N ngày (`durationDays`) thì cần thêm gì ở DB và cần job gì?

## Cấm
- Sửa file ngoài mục "Được ghi". File dùng chung thì báo nhóm trước (README mục 6).
- Đọc, in, commit `.env*`, khóa, mật khẩu thật, API key. Dùng `git add -f`.
- Trả nội dung task hoặc tài nguyên của dự án cho admin.
- Tự ghi trạng thái `xong`. Chỉ người review ghi sau khi kiểm.

## Dành cho Claude (đọc trước khi làm)
Người dán file này là **người làm** task. Mục tiêu kép: task chạy đúng **và** người làm hiểu hết những gì đã làm.
1. Chưa sửa code vội. Yêu cầu người làm tóm tắt mục tiêu task và đọc câu trả lời Bước 0 của họ. Sai hoặc thiếu thì giải thích, rồi hỏi lại.
2. Bước 🧠: không viết hộ. Chỉ gợi ý, đặt câu hỏi dẫn dắt, chỉ chỗ sai.
3. Bước 🤝: làm từng phần nhỏ. Mỗi phần nói rõ sửa file nào, vì sao, chạy kiểm thế nào. Yêu cầu người làm tự chạy lệnh và đọc kết quả.
4. Chỉ sửa file trong "Được ghi". Cần đụng file khác, nhất là file dùng chung, thì dừng lại và nói lý do để người làm hỏi nhóm.
5. "Đặc tả đã chốt" là quyết định của nhóm, không tự đổi. Thấy đặc tả sai thì báo ra, không tự làm theo ý mình.
6. Không đọc hay in `.env*`, khóa, mật khẩu, API key.
7. Làm xong: hỏi người làm 3 câu trong "Câu hỏi bảo vệ", nhắc họ điền ghi chép bằng lời của họ, chỉ đổi trạng thái thành `chờ kiểm`.

## Ghi chép của người làm
> Viết bằng lời của bạn. Người review đọc phần này trước khi đọc code.

> **Quyết định của người làm (A):** task ghi "để lại sau hạn nộp, chế độ thường", nhưng A quyết định làm **kiểu sprint** (theo `SPRINT_2_NGAY.md`): Claude làm hết các bước, kể cả bước 🧠 (hàm che email kèm test). Bỏ Bước 0 và mục "Dành cho Claude". **Vòng hiểu: chưa làm.**

### Trả lời Bước 0
Bỏ qua (chế độ sprint, xem quyết định ở trên).

### Đã làm gì (file nào, vì sao)
Mỗi phần đều viết test trước, chạy thấy FAIL, rồi mới code cho PASS (output ở mục dưới).

**Backend**
- `BE/service/admin/EmailMasker.java` (mới): che email theo đặc tả: ký tự đầu + `***@` + tên miền. Phần trước @ chỉ 1 ký tự vẫn thêm `***` (không lộ độ dài). Không có @, null hoặc rỗng → `***` (không bao giờ trả chuỗi gốc). Nhiều @ → lấy tên miền từ @ cuối.
- `BE/service/admin/AdminService.java` (mới):
  - `getUsers(query, status)`: email đã che; `status` ACTIVE/SUSPENDED/ALL, sai → 400. Tìm theo username/họ tên, **không** tìm theo email để Admin không dò ra email thật qua ô tìm kiếm.
  - `suspendUser`: `is_locked = true`, `token_version += 1`, `revokeAllByUserId`. User ADMIN → `ForbiddenException("CANNOT_SUSPEND_ADMIN", ...)` (403). `durationDays` **chỉ ghi log**, không thêm migration.
  - `unbanUser`: `is_locked = false`.
  - `getWorkspaces`: chỉ metadata (tên, owner, trạng thái, số thành viên, số node, `updatedAt`). Số node/thành viên lấy bằng `COUNT ... GROUP BY`. Service không phụ thuộc `NodeRepository`/`ArtifactRepository` nên không có đường nào đọc tiêu đề hay nội dung task.
  - `archiveWorkspace`: `status = ARCHIVED`.
- `BE/controller/AdminController.java` (mới): `/api/v1/admin/**` (kèm alias `/api/admin/**` giống AuthController).
  - Mỗi endpoint gắn `@PreAuthorize("hasRole('ADMIN')")` riêng. Không gắn ở mức class, vì nếu gắn ở class thì cả hàm `@ExceptionHandler` cũng bị kiểm quyền.
  - Có **handler `AccessDeniedException` cục bộ**: chưa đăng nhập → 401 `UNAUTHORIZED`; có Authorization nhưng token hỏng → 401 `TOKEN_EXPIRED` (để FE tự refresh); không phải ADMIN → 403 `ACCESS_DENIED`. Thiếu handler này thì `GlobalExceptionHandler` trả **500** (đã tái hiện bằng test).
- `BE/dto/request/admin/SuspendUserRequest.java`: `reason` bắt buộc, tối đa 255 ký tự; `durationDays` > 0, tối đa 3650.
- `BE/dto/response/admin/AdminUserResponse.java`, `WorkspaceOverviewResponse.java`.
- Repository (chỉ THÊM method, không sửa method cũ):
  - `UserRepository.searchForAdmin`.
  - `ProjectRepository.findAllByOrderByUpdatedAtDesc`, `countProjectsGroupByOwner`, `countJoinedProjectsGroupByMember`, `countActiveMembersGroupByProject`, `countNodesGroupByProject`.
  - `RefreshTokenRepository` không cần sửa, dùng `revokeAllByUserId` có sẵn.
- Test:
  - `BE-test/service/admin/EmailMaskerTest.java` (4 test).
  - `BE-test/service/admin/AdminServiceTest.java` (11 test).
  - `BE-test/controller/admin/AdminControllerTest.java` (11 test).

**Vì sao không dùng `@WithMockUser`:** pom.xml **chưa có `spring-security-test`**, mà pom nằm ngoài "Được ghi", nên tôi không thêm. Test controller vẫn kiểm phân quyền thật qua chuỗi filter:
- `@WebMvcTest` + `@Import(SecurityConfig.class)`.
- Gửi `Authorization: Bearer <token giả>`, mock `JwtService.parseAccessToken` và `UserRepository.findById`.
- Nhờ vậy `JwtAuthFilter` thật đặt principal với `ROLE_ADMIN`/`ROLE_USER`, rồi `@PreAuthorize` thật kiểm quyền.

**Frontend**
- `FE/services/admin/HttpAdminService.ts` (mới): gọi qua `apiRequest`, nên tự kèm Bearer và ném `ApiError` giữ nguyên mã lỗi backend.
  - Map dữ liệu: role USER → `STANDARD_USER`; trạng thái dự án ACTIVE → RUNNING, ARCHIVED → ARCHIVED, còn lại → IDLE; `lastLoginAt`/`maskedIp` null → `—`.
  - **Giữ mock**: `getSystemKpis`, `getAnalyticsTrends`, `getRoleDistribution`, `getSecurityAuditLogs`.
- `FE/services/container.ts`: dòng `adminService` thành `isMock ? new MockAdminService() : new HttpAdminService()`, thêm 1 dòng import cần thiết.
- `FE/types/admin.types.ts`:
  - thêm `durationDays?` vào `SuspendUserRequestDto`;
  - thêm `memberCount?`, `projectStatus?`, `updatedAt?` vào `WorkspaceOverviewDto`;
  - thêm kiểu JSON của backend: `AdminUserApiDto`, `WorkspaceOverviewApiDto`, `SuspendUserApiRequest`, `ProjectStatusApi`.
- `UserManagementTab.tsx`, `WorkspacesTab.tsx`: **không sửa**. Hai tab không gọi service trực tiếp: service được gọi trong `useAdminPortal`, và hook này đã bắt lỗi rồi hiện toast bằng `err.message`. Vì vậy lỗi `ApiError` từ backend (ví dụ "Không được khóa tài khoản có quyền ADMIN.") tự hiện lên.
- Test: `FE/services/admin/__tests__/HttpAdminService.test.ts` (9 test).
- `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md`: thêm mục "Trạng thái hiện thực (A6)" vào 10.1, 10.2.

### Kết quả test (dán output thật, không chép tay)

**1. Hàm che email: trước khi code (stub trả nguyên chuỗi) → FAIL**
```
[ERROR] Tests run: 4, Failures: 4, Errors: 0, Skipped: 0 <<< FAILURE! -- in com.pipeline.wpe.service.admin.EmailMaskerTest
expected: "a***@pipeline.engine"
 but was: "alex.kim@pipeline.engine"
expected: "***"
 but was: "khongphaiemail"
expected: "a***@x.io"
 but was: "a@x.io"
[INFO] BUILD FAILURE
```
Sau khi code → PASS
```
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0 -- in com.pipeline.wpe.service.admin.EmailMaskerTest
[INFO] BUILD SUCCESS
```

**2. AdminService: trước khi code (stub ném UnsupportedOperationException) → FAIL**
```
[ERROR]   AdminServiceTest.archive_unknown_404:271
[ERROR]   AdminServiceTest.getUsers_badStatus:189
[ERROR]   AdminServiceTest.suspend_admin_forbidden:110
[ERROR]   AdminServiceTest.suspend_unknownUser_404:124
[ERROR]   AdminServiceTest.archive_setsArchived:259 » UnsupportedOperation A6: chưa làm
[ERROR]   AdminServiceTest.getUsers_filters:179 » UnsupportedOperation A6: chưa làm
[ERROR]   AdminServiceTest.getUsers_masksEmailAndCounts:156 » UnsupportedOperation A6: chưa làm
[ERROR]   AdminServiceTest.getWorkspaces_metadataOnly:209 » UnsupportedOperation A6: chưa làm
[ERROR]   AdminServiceTest.suspend_regularUser_locksBumpsVersionAndRevokes:90 » UnsupportedOperation A6: chưa làm
[ERROR]   AdminServiceTest.unban_unlocks:137 » UnsupportedOperation A6: chưa làm
[ERROR] Tests run: 11, Failures: 4, Errors: 6, Skipped: 0
[INFO] BUILD FAILURE
```
Test `adminService_hasNoTaskContentDependency` là test cấu trúc nên pass ngay từ đầu. Nó canh để sau này không ai thêm NodeRepository/ArtifactRepository vào service, hay field task/title/description vào DTO.

Sau khi code → PASS
```
[INFO] Tests run: 11, Failures: 0, Errors: 0, Skipped: 0 -- in com.pipeline.wpe.service.admin.AdminServiceTest
[INFO] BUILD SUCCESS
```

**3. AdminController: có `@PreAuthorize` nhưng CHƯA có handler AccessDeniedException → user thường và người chưa đăng nhập đều ra 500**
```
[ERROR]   AdminControllerTest.anonymous_unauthorized:235 Status expected:<401> but was:<500>
[ERROR]   AdminControllerTest.badToken_tokenExpired:148 Status expected:<401> but was:<500>
[ERROR]   AdminControllerTest.debugHeaderOnly_unauthorized:139 Status expected:<401> but was:<500>
[ERROR]   AdminControllerTest.regularUser_forbidden:118 Status expected:<403> but was:<500>
[ERROR] Tests run: 11, Failures: 4, Errors: 0, Skipped: 0
[INFO] BUILD FAILURE
```
Thêm handler cục bộ → PASS
```
[INFO] Tests run: 11, Failures: 0, Errors: 0, Skipped: 0 -- in com.pipeline.wpe.controller.admin.AdminControllerTest
[INFO] Tests run: 11, Failures: 0, Errors: 0, Skipped: 0 -- in com.pipeline.wpe.service.admin.AdminServiceTest
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0 -- in com.pipeline.wpe.service.admin.EmailMaskerTest
[INFO] Tests run: 26, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

**4. Toàn bộ backend** (`cd wpe-backend && ./mvnw -B test`)
```
[WARNING] Tests run: 2, Failures: 0, Errors: 0, Skipped: 1 -- in com.pipeline.wpe.service.auth.SeedPasswordHashTest
[WARNING] Tests run: 460, Failures: 0, Errors: 0, Skipped: 1
[INFO] BUILD SUCCESS
```
1 test skip là `SeedPasswordHashTest` của A3 (`@Disabled` có sẵn trên main, chờ migration sửa hash seed). Không thuộc A6, không sửa.

**5. Frontend**
- `HttpAdminService.test.ts` trước khi có file → FAIL: `Failed to resolve import "../HttpAdminService" ... Does the file exist?` (Test Files 1 failed).
- `npm ci` → exit 0. `npm run typecheck` (`tsc -b`) → exit 0.
- `NODE_OPTIONS=--no-webstorage npm test` (Node v26.13.0, cần cờ này):
```
 ✓ src/services/admin/__tests__/HttpAdminService.test.ts (9 tests)
 ✓ src/services/admin/__tests__/MockAdminService.test.ts (7 tests)
 Test Files  48 passed (48)
      Tests  370 passed (370)
```

**6. Chạy thật (bước 5): CHƯA chạy được**
- Kịch bản gốc (đăng nhập `admin` rồi khóa `sarah.chen`) bị chặn bởi **lỗi seed V2**: hash mật khẩu seed không khớp `Password123!` nên không đăng nhập được `admin`/`sarah.chen`. Cần migration riêng, ngoài A6. Không sửa seed, không UPDATE DB.
- Kiểm thay thế bằng API thật ở cổng 8083 cũng không chạy được. `./mvnw spring-boot:run -Dspring-boot.run.arguments=--server.port=8083` dừng với `Unable to obtain connection from database: Connection to localhost:5432 refused`. Lúc chạy, Docker Desktop không bật (`failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`), cổng 8080 cũng không có backend. Tôi không tự bật Docker. Tiến trình 8083 tự thoát, không còn tiến trình nào của A6 đang chạy.
- Cần chạy lại khi có Docker:
  - (a) đăng ký 1 user thử, gọi `GET /api/v1/admin/users` bằng token của user đó → phải 403 `ACCESS_DENIED` (không phải 500);
  - (b) không có token → 401;
  - (c) sau khi sửa seed: kịch bản bước 5 đầy đủ.

### Điều chưa chắc / cần nhóm quyết
1. **Handler `AccessDeniedException` nên chuyển lên `GlobalExceptionHandler`** cho mọi controller. Hiện chỉ có trong `AdminController`. Controller khác sau này dùng `@PreAuthorize` sẽ bị 500 thay vì 403, vì GlobalExceptionHandler có nhánh `@ExceptionHandler(Exception.class)`. A6 không sửa vì file nằm ngoài "Được ghi".
2. **Lỗi seed V2** chặn kịch bản bước 5 (không đăng nhập được `admin`/`sarah.chen`). Cần migration sửa hash (cấp số theo README mục 6.2).
3. **pom.xml chưa có `spring-security-test`**, nên không dùng được `@WithMockUser`. Test đang giả lập bằng JWT thật qua `JwtAuthFilter`. Nhóm có muốn thêm dependency này không?
4. **`durationDays` chỉ ghi log**: tài khoản bị khóa tới khi Admin unban. Muốn tự mở khóa sau N ngày cần cột `locked_until` (migration) và một job `@Scheduled` quét các user hết hạn khóa.
5. Khi chỉ có 1 ADMIN: hiện không thể khóa ADMIN, nhưng chưa chặn việc hạ quyền admin cuối cùng (chưa có API đổi system_role).
6. UI: `UserManagementTab` chỉ khóa nút Suspend với `SUPER_ADMIN`. Backend thật trả role `ADMIN`, nên với user ADMIN nút vẫn bấm được và backend trả 403 `CANNOT_SUSPEND_ADMIN` (hiện toast). Muốn ẩn nút cho ADMIN thì phải sửa phần hiển thị của tab, ngoài phạm vi "chỉ phần gọi service và báo lỗi".
7. `WorkspacesTab` hiện cột Progress và critical path. Backend chỉ trả metadata nên `HttpAdminService` đặt 0, giao diện sẽ hiện "0%". Cần quyết: bỏ 2 cột này khi dùng API thật, hay cho phép trả thêm số node đã xong (vẫn là số đếm, không phải nội dung task).
8. `lastLoginAt`, `maskedIp`: DB chưa lưu, nên backend luôn trả null (FE hiện `—`).
9. `useAdminPortal.loadData` dùng `Promise.all`: một API admin lỗi thì cả trang không có dữ liệu, kể cả phần mock. Hook nằm ngoài "Được ghi" nên không sửa.

**Bước cần trình duyệt (dời sang buổi kiểm chung, chạy với `VITE_USE_MOCK=false`):**
- đăng nhập admin, mở tab Users: thấy email dạng `a***@...`;
- khóa sarah: sarah đang mở app bị đá ra ở request kế tiếp;
- mở khóa sarah: sarah đăng nhập lại được;
- khóa một ADMIN: hiện toast báo lỗi;
- tab Workspaces: Archive một dự án thì trạng thái thành ARCHIVED;
- user thường mở trang admin: hiện toast lỗi, không có dữ liệu giả.

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**
