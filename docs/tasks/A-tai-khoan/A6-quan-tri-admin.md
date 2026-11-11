# A6 — Quản trị người dùng và workspace cho Admin (Cụm 10.1, 10.2)

Người làm: A
Người review: B
Trạng thái: chưa làm
Cần có trước: A2, A3
Cần trước bước frontend: không
Mở khóa: X1
Nhánh git: a6-admin
Ước lượng: 1,5 ngày

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

### Trả lời Bước 0

### Đã làm gì (file nào, vì sao)

### Kết quả test (dán output thật, không chép tay)

### Điều chưa chắc / cần nhóm quyết

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**
