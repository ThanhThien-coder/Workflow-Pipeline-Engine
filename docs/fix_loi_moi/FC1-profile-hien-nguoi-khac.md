# FC1 — Tài khoản mới đăng nhập thấy hồ sơ của người khác

Người làm: C
Trạng thái: chờ kiểm
Lỗi xử lý: L2
Nhánh git: fix-fc1-profile-that
Làm trước: không (kiểm tài khoản mẫu cần FA1; kiểm bằng tài khoản mới đăng ký thì không cần)

> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.

## Lỗi người dùng thấy
Đăng ký tài khoản mới rồi đăng nhập: menu hồ sơ góc trên và trang Profile hiện tên, email của một người khác.

## Nguyên nhân (đã đọc code)
- `FE/services/container.ts`: `profileService: new MockProfileApi()`, **luôn** là mock, kể cả chế độ API thật. `MockProfileApi.getMyProfile` trả một hồ sơ giả cố định.
- `FE/components/common/GlobalProfileMenu.tsx` dòng 30–45: ưu tiên `profile.displayName`, `profile.email` từ `useProfileStore` (= hồ sơ giả), chỉ dùng tên thật khi chưa có profile.
- `FE/store/useProfileStore.ts`: profile tải một lần, chỉ tải khi `!profile`; không xóa khi đăng xuất/đăng nhập user khác → user sau thấy hồ sơ user trước.
- User thật đã có sẵn ở FE: `authApi.getStoredUser()` (`FE/services/impl/http/auth.ts`, lưu khi đăng nhập: id, username, email, name, role, avatarUrl). Backend **chưa có** `GET /users/me` (task A5 chưa làm).

## Cách sửa (đã chốt)
1. Tạo `FE/services/impl/HttpProfileService.ts` cài `IProfileService`:
   - `getMyProfile()`: dựng từ `getStoredUser()` (id, username, email, `displayName = name || username`, avatarUrl, role). Không có user → ném lỗi chưa đăng nhập.
   - Các phương thức ghi (`updateProfile`, `uploadAvatar`, `removeAvatar`, `changePassword`, `updatePrivacy`, `deactivateAccount`, `deleteAccount`, `setProjectPublic`): backend chưa có → ném `ApiError` rõ ràng "Tính năng chưa hỗ trợ" (không giả vờ thành công). Màn Profile ẩn hoặc vô hiệu hóa các nút đó, có dòng chú thích.
2. `container.ts`: `profileService: isMock ? new MockProfileApi() : new HttpProfileService()`.
3. `useProfileStore`: thêm `reset()`; gọi khi đăng xuất và khi đăng nhập thành công (ở chỗ `authSlice` lưu phiên). `GlobalProfileMenu` tải lại khi `currentUser.id` đổi.

## Được sửa
- `FE/services/impl/HttpProfileService.ts` (mới), `FE/services/container.ts` (chỉ dòng `profileService`)
- `FE/store/useProfileStore.ts`, `FE/store/slices/authSlice.ts` (chỉ gọi `reset()` ở đăng nhập/đăng xuất)
- `FE/components/common/GlobalProfileMenu.tsx`, `FE/views/ProfileView.tsx` (chỉ ẩn/vô hiệu nút chưa hỗ trợ), test FE

## Test phải có
- `HttpProfileService.getMyProfile` trả đúng user đang lưu.
- Đăng nhập A → profile A; đăng xuất, đăng nhập B → profile B (không còn A). Trước khi sửa phải fail.

## Kiểm bằng tay
1. Đăng ký tài khoản mới "meo" → menu góc trên và trang Profile hiện đúng tên, email của meo.
2. Đăng xuất, đăng nhập alex → hiện alex. Không F5 cũng đúng.

## Kết quả (Claude ghi, dán output thật)

**File đã sửa**
- `FE/services/impl/HttpProfileService.ts` (mới): `getMyProfile()` dựng từ `getStoredUser()` (`displayName = name || username`), chưa đăng nhập → lỗi 401; mọi phương thức ghi ném `ApiError` 501 "Tính năng chưa hỗ trợ".
- `FE/services/container.ts`: `profileService: isMock ? new MockProfileApi() : new HttpProfileService()`.
- `FE/store/useProfileStore.ts`: thêm `reset()`.
- `FE/store/slices/authSlice.ts`: gọi `reset()` trong `applySession` (đăng nhập/đăng ký) và `resetUserData` (đăng xuất).
- `FE/components/common/GlobalProfileMenu.tsx`: tải lại hồ sơ khi `auth.currentUser.id` đổi.
- `FE/views/ProfileView.tsx`: tải lại khi đổi user; vô hiệu hóa các nút ghi (lưu hồ sơ, ảnh đại diện, riêng tư, public dự án, đổi mật khẩu, deactivate/delete) kèm dòng chú thích "Tính năng chưa hỗ trợ". Lưu ý: các nút này bị vô hiệu cả ở chế độ mock.

**Test đã thêm**: `FE/services/impl/__tests__/HttpProfileService.test.ts` (4 test: getMyProfile trả đúng user lưu + 401 khi chưa đăng nhập; phương thức ghi ném "Tính năng chưa hỗ trợ"; đăng nhập A → đăng xuất → đăng nhập B thì profile là B; GlobalProfileMenu tải lại khi đổi user).

**Output test thật** (13/11/2026)
- Trước khi sửa (giữ service mới + test, hoàn lại 5 file còn lại): `Tests 2 failed | 2 passed (4)`; 2 test fail là "Đăng nhập A → profile A; đăng xuất, đăng nhập B…" và "GlobalProfileMenu tự tải lại khi currentUser.id đổi".
- Sau khi sửa:
```text
npm run typecheck  → tsc -b, exit 0
npm test           → Test Files 48 passed (48) | Tests 365 passed (365)
```
- Backend: không đổi file nào.
