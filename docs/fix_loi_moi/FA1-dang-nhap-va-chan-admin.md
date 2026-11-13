# FA1 — Đăng nhập tài khoản mẫu, đăng nhập bằng email, chặn /admin cho user thường

Người làm: A
Trạng thái: chưa làm
Lỗi xử lý: L1, L3, L23 (phần route), L24
Nhánh git: fix-fa1-dang-nhap
Làm trước: không. **Làm đầu tiên**, cả nhóm cần task này để kiểm.

> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`, `MIG/` = `wpe-backend/src/main/resources/db/migration/`.

## Lỗi người dùng thấy
1. Đăng nhập `admin`, `alex.kim`, `sarah.chen` với mật khẩu `Password123!` đều sai mật khẩu.
2. Gõ email (vd `alex.kim@pipeline.engine`) vào ô "Email or username" thì không đăng nhập được, dù ô đó ghi là nhận email.
3. User thường (vd meo) vào được `/admin`. Vì không có role ADMIN nên lưu template bị từ chối, và catalog hiện cả template riêng của meo.

## Nguyên nhân (đã đọc code)
- `MIG/V2__seed_initial_data.sql` dòng 5–13: hash `$2a$10$7EqJtq98...jX1lG` **không khớp** `Password123!`. Đã có test chứng minh: `BE-test/service/auth/SeedPasswordHashTest.java`, test `seedHashMatchesDevPassword` đang `@Disabled` với ghi chú "chờ nhóm cấp số migration mới".
- `BE/service/auth/AuthService.java` dòng 69: `userRepository.findByUsername(request.username().trim())`, không thử tìm theo email. `UserRepository` đã có sẵn `findByEmail`.
- `FE/services/impl/http/auth.ts` dòng 136–140: gửi nguyên chuỗi người dùng gõ vào field `username`. Phần này giữ nguyên, sửa ở backend.
- `FE/App.tsx` dòng 65 và 93–95: `isAdminRoute` render thẳng `<AdminPortalView />`, không kiểm đã đăng nhập hay chưa, cũng không kiểm role.

## Cách sửa (đã chốt)
1. **Migration `MIG/V12__fix_seed_password_hash.sql`** (số V12 phải báo nhóm và ghi vào `docs/tasks/README.md` mục 6.2 trước):
   - Sinh hash BCrypt mới cho `Password123!` bằng `BCryptPasswordEncoder` (chạy trong một test tạm hoặc `jshell`, không tự bịa chuỗi hash).
   - `UPDATE users SET password_hash = '<hash mới>' WHERE username IN ('admin','alex.kim','sarah.chen') AND password_hash = '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi59M117z182rWc4ZqNqQ9g2P5jX1lG';` (chỉ đổi khi còn hash cũ, để không ghi đè nếu ai đã đổi mật khẩu).
   - Sửa `SeedPasswordHashTest`: đổi `SEED_HASH` sang hash mới, bỏ `@Disabled`.
2. **Đăng nhập bằng email** trong `AuthService.login`: chuỗi nhập có `@` thì tìm `findByEmail` (so không phân biệt hoa thường: thêm `findByEmailIgnoreCase` vào `UserRepository` nếu cần), không có `@` thì `findByUsername`. Không tìm thấy thì vẫn chạy `dummyHash()` như cũ (chống dò user theo thời gian phản hồi) và trả cùng một lỗi sai thông tin.
3. **Chặn `/admin` ở FE** trong `App.tsx`:
   - Chưa đăng nhập → `replace('/auth?tab=signin')`.
   - Đã đăng nhập mà `currentUser.role !== 'ADMIN'` → `replace('/workspaces')` và hiện toast "Chỉ quản trị viên mới vào được trang này".
   - Sau khi đăng nhập, user ADMIN được chuyển tới `/admin`, user thường tới `/workspaces` (sửa ở chỗ chuyển trang sau login trong `AuthView.tsx` hoặc `App.tsx`, chọn chỗ đang xử lý chuyển trang).
   - Backend vẫn là lớp chặn thật (template đã `requireAdmin`; API admin của FA2 dùng `@PreAuthorize`). FE chặn chỉ để không hiện trang sai.

## Được sửa
- `MIG/V12__fix_seed_password_hash.sql` (mới)
- `BE/service/auth/AuthService.java`, `BE/repository/UserRepository.java` (chỉ thêm method)
- `BE-test/service/auth/SeedPasswordHashTest.java`, `BE-test/service/auth/AuthServiceTest.java`, `BE-test/controller/AuthControllerTest.java`
- `FE/App.tsx` (chỉ phần route guard `/admin`), `FE/components/auth/AuthView.tsx` (chỉ chỗ chuyển trang sau đăng nhập), test FE liên quan
- `docs/tasks/README.md` (chỉ thêm dòng V12, V13 vào bảng mục 6.2), file task này

## Test phải có
- `SeedPasswordHashTest.seedHashMatchesDevPassword` chạy (không còn `@Disabled`) và pass.
- `AuthServiceTest`: đăng nhập bằng username đúng; bằng email đúng; email viết hoa; email không tồn tại → lỗi sai thông tin (cùng mã lỗi với sai mật khẩu).
- Test FE: chưa đăng nhập vào `/admin` → chuyển `/auth`; user USER vào `/admin` → chuyển `/workspaces`; user ADMIN thấy `AdminPortalView`.

## Kiểm bằng tay
1. `docker compose up -d`, chạy backend để Flyway áp V12 (không cần xóa DB).
2. Đăng nhập `admin` / `Password123!` → vào `/admin`. Vào tab Templates, tạo và lưu một template → thành công.
3. Đăng nhập `alex.kim@pipeline.engine` / `Password123!` → vào `/workspaces`.
4. Đang là alex, gõ `/admin` trên thanh địa chỉ → bị đẩy về `/workspaces`.

## Kết quả (Claude ghi, dán output thật)
