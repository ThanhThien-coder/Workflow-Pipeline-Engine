# A4 — Đăng nhập trên giao diện, tự làm mới token, đăng xuất (FE Cụm 1)

Người làm: A
Người review: B
Trạng thái: chờ kiểm
Cần có trước: A2, A3
Cần trước bước frontend: không
Mở khóa: X1
Nhánh git: a4-auth-ui
Ước lượng: 1–1,5 ngày

> ⚡ **Chế độ sprint:** Claude làm hết các bước, kể cả 🧠; bỏ qua Bước 0 và mục "Dành cho Claude". Luồng làm: [SPRINT_2_NGAY.md](../SPRINT_2_NGAY.md) mục 2–3.
> - **Claude tự chạy bằng dòng lệnh:** `npm run typecheck && npm test`.
> - **Dời về buổi kiểm chung (mục 7):** đăng nhập alex trên giao diện; token hết hạn tự refresh; đăng xuất rồi F5; đăng nhập sarah (bảng 7.2 dòng 2–4).
> - **Không làm trong sprint:** không có.

## Vì sao cần task này
FE đang đăng nhập bằng mock (`FE/services/mock/MockWorkflowService.auth.ts`). Cần nối `AuthView` → `authSlice` → API thật, lưu token, tự refresh khi gặp 401 và đăng xuất sạch.

## Kiến thức phải nắm
Zustand slice, `localStorage` và `sessionStorage` (ứng với rememberMe), interceptor, refresh kiểu "single-flight" (nhiều request dùng chung 1 promise), race condition.

## Bước 0 — Tự đọc, không dùng AI
Đọc: `FE/components/auth/AuthView.tsx`, `FE/store/slices/authSlice.ts`, `FE/services/mock/MockWorkflowService.auth.ts`, `FE/types/auth.types.ts`, `FE/services/http/apiClient.ts` (từ A2), integration map mục 1.1–1.3.
Trả lời:
1. `authSlice` đang lưu những gì, ở key nào? Ai khác đọc các key đó? (gợi ý: `grep -rn "wpe_auth_" wpe-frontend/src`)
2. 3 request cùng nhận 401 một lúc. Nếu mỗi request tự gọi refresh thì sao? Single-flight giải quyết thế nào?
3. Đăng xuất phải dọn những store nào để người đăng nhập sau không thấy dữ liệu của người trước?

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `FE/**`, `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md`

## Được ghi
- `FE/services/impl/http/auth.ts`, `FE/services/http/apiClient.ts` (phần xử lý 401)
- `FE/services/impl/HttpWorkflowService.ts` (chỉ 4 phương thức auth và danh sách `METHODS_STILL_MOCKED`)
- `FE/store/slices/authSlice.ts`, `FE/components/auth/**`, `FE/types/auth.types.ts`
- Test tương ứng trong các thư mục `__tests__`
- `docs/tasks/A-tai-khoan/A4-dang-nhap-giao-dien.md`

## Đặc tả đã chốt
- `login`, `register`, `logout` của `HttpWorkflowService` gọi qua `auth.ts` và được xóa khỏi `METHODS_STILL_MOCKED`. `getCurrentUser` trả user đã lưu khi đăng nhập (`wpe_auth_user`). Khi A5 xong có thể làm mới bằng `GET /api/v1/users/me/profile`.
- Lưu phiên: `rememberMe = true` thì dùng `localStorage`, ngược lại dùng `sessionStorage`. Giữ nguyên key `wpe_auth_token`, `wpe_auth_user`, thêm `wpe_refresh_token`.
- Gặp 401 trên request **có gửi token**: gọi `POST /auth/refresh` **đúng 1 lần** (single-flight). Thành công thì gửi lại request gốc 1 lần. Thất bại thì xóa phiên, quay về màn đăng nhập, hiện toast "Phiên đăng nhập đã hết hạn". Không refresh cho chính request `/auth/refresh` và `/auth/login` (tránh vòng lặp).
- Đăng xuất: gọi `POST /auth/logout`. Lỗi mạng thì vẫn xóa phiên trên máy. Reset các slice của `useWorkflowStore`, cùng `useProfileStore` và `useNotificationStore`.
- Màn đăng nhập hiển thị lỗi theo `ApiError.code`: `BAD_CREDENTIALS`, `ACCOUNT_LOCKED`, `USERNAME_TAKEN`, `EMAIL_TAKEN`. Không đổi giao diện ngoài phần báo lỗi.

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 Viết bảng test case FE trước, ít nhất 8 dòng: login đúng, sai, bị khóa; register trùng; refresh thành công; refresh thất bại thì đăng xuất; 3 request 401 cùng lúc chỉ refresh 1 lần; đăng xuất dọn store.
3. 🤝 `auth.ts`, nối vào `HttpWorkflowService`.
4. 🧠 **Tự viết** đoạn "giữ một promise refresh dùng chung" trong `apiClient` (khoảng 15 dòng). Claude chỉ được review.
5. 🤝 `authSlice` và `AuthView` hiển thị lỗi theo `ApiError.code`.
6. 🧠 Chạy thật với backend: đăng nhập alex. Tạm đặt `jwt.access-token-expiration-ms: 60000` trên máy bạn (không commit), chờ token hết hạn rồi thao tác tiếp: app phải tự refresh, không văng ra.

## Tiêu chí xong
- [ ] `npm run typecheck && npm test` pass, có test cho các case ở bước 2.
- [ ] Chạy thật: đăng nhập alex.kim, vào Workspace thấy "Core Banking Pipeline" lấy từ backend (không phải mock).
- [ ] Token hết hạn thì tự refresh: tab Network chỉ có đúng 1 request `/auth/refresh` dù nhiều request cùng lỗi.
- [ ] Đăng xuất rồi F5 thì không còn đăng nhập. Đăng nhập sarah.chen không thấy dữ liệu cũ của alex.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. Lưu token ở `localStorage` có rủi ro gì (XSS)? Dùng cookie `httpOnly` thì khác thế nào?
2. Vì sao chỉ gửi lại request gốc đúng 1 lần?
3. Bước nào trong luồng refresh mà viết sai sẽ tạo vòng lặp vô hạn?

## Cấm
- Sửa file ngoài mục "Được ghi". File dùng chung thì báo nhóm trước (README mục 6).
- Đọc, in, commit `.env*`, khóa, mật khẩu thật, API key. Dùng `git add -f`.
- Commit cấu hình tạm (`access-token-expiration-ms` ngắn).
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
Bỏ qua (chế độ sprint). Vòng hiểu: chưa làm (A vắng, làm bù khi A quay lại).

> Phần dưới do Claude ghi (chế độ sprint, A vắng mặt). Nhánh `a4-auth-ui` tách từ `origin/a2-api-client` (PR #26, chưa merge).

### Đã làm gì (file nào, vì sao)
**Bảng test case FE (bước 2)**: mỗi dòng có test tự động, fetch được giả lập (không cần backend).

| # | Case | Test |
| :--- | :--- | :--- |
| 1 | Login đúng: gửi `{username, password, rememberMe}`, đổi AuthResponse (`token`, `role`) sang `accessToken`, `systemRole`, có `refreshToken` | `impl/http/__tests__/auth.test.ts` |
| 2 | Login sai 401 `BAD_CREDENTIALS` → ApiError đúng mã; form hiện câu báo lỗi dưới ô mật khẩu | `auth.test.ts`, `AuthView.test.tsx`, `authSlice.http.test.ts` |
| 3 | Login bị khóa 403 `ACCOUNT_LOCKED` → ApiError đúng mã; form hiện câu báo lỗi | `auth.test.ts`, `AuthView.test.tsx` |
| 4 | Register trùng 409 `USERNAME_TAKEN` / `EMAIL_TAKEN` → form hiện câu báo lỗi dưới ô email | `auth.test.ts`, `AuthView.test.tsx` |
| 5 | rememberMe = true lưu localStorage, false lưu sessionStorage (thêm `wpe_refresh_token`) | `auth.test.ts`, `authSlice.http.test.ts` |
| 6 | Refresh thành công: 1 lời gọi `/auth/refresh`, lưu đè token + refresh token mới vào đúng storage, gửi lại request gốc 1 lần, store cập nhật token | `auth.test.ts`, `authSlice.http.test.ts` |
| 7 | Refresh thất bại → xóa phiên, reset store, `isAuthenticated = false`, toast "Phiên đăng nhập đã hết hạn", không lặp | `auth.test.ts`, `authSlice.http.test.ts` |
| 8 | 3 request 401 cùng lúc → đúng 1 lời gọi `/auth/refresh` (cả khi refresh thành công lẫn thất bại; thất bại thì chỉ báo hết hạn 1 lần) | `auth.test.ts` |
| 9 | 401 về muộn (gửi bằng token cũ sau khi refresh đã xong) → không refresh lần 2 | `auth.test.ts` |
| 10 | `/auth/login` bị 401 khi máy còn token cũ → không gọi refresh | `auth.test.ts` |
| 11 | Đăng xuất: gọi `/auth/logout` kèm refresh token (trước khi xóa), xóa phiên, reset `useWorkflowStore`, `useProfileStore`, `useNotificationStore` | `authSlice.http.test.ts` |
| 12 | Đăng xuất khi mất mạng → vẫn xóa phiên và reset store | `authSlice.http.test.ts` |
| 13 | `HttpWorkflowService`: 4 phương thức auth không còn trong `METHODS_STILL_MOCKED`, gọi `/auth/*` thật; `getCurrentUser` trả `wpe_auth_user` | `impl/__tests__/HttpWorkflowService.test.ts` |

**File đã sửa:**
- `FE/services/impl/http/auth.ts` (mới): `login`, `register`, `logout` gọi `/auth/*`; đổi AuthResponse của A3 sang `AuthResponseDto`; lưu/xóa phiên (`saveSession`, `clearSession`, key `wpe_refresh_token`); tự làm mới token: `installAuthRefresh` gắn handler vào apiClient, không refresh cho `/auth/refresh`, `/auth/login`; **single-flight** `refreshOnce()` giữ một promise refresh dùng chung; `getAuthErrorMessage` đổi `ApiError.code` sang câu báo lỗi.
- `FE/services/http/apiClient.ts` (chỉ phần 401): `UnauthorizedContext` có thêm `token` (token đã gửi). Handler so với token đang lưu: khác nhau nghĩa là lần refresh khác đã xong, chỉ gửi lại, không refresh thêm.
- `FE/services/impl/HttpWorkflowService.ts`: 4 phương thức auth gọi `auth.ts`, xóa 4 dòng A4 khỏi `METHODS_STILL_MOCKED`.
- `FE/store/slices/authSlice.ts`: lưu phiên qua `auth.ts` (có refresh token); đăng xuất gọi `/auth/logout` **trước** rồi mới xóa phiên (code cũ xóa trước nên backend không nhận được refresh token); reset các slice của `useWorkflowStore` (trừ `auth`, `ui`), `useProfileStore`, `useNotificationStore` (dùng `setState` từ ngoài, không sửa 2 file store đó), xóa thêm `wpe_user_avatar`; bật tự refresh, refresh hỏng thì đăng xuất trên máy và hiện toast "Phiên đăng nhập đã hết hạn"; `auth.error` lấy câu theo mã lỗi.
- `FE/components/auth/AuthView.tsx`: chỉ phần báo lỗi: câu theo `ApiError.code`, hiện dưới ô tương ứng (dùng sẵn chỗ báo lỗi của `Field`) và trên toast.
- `FE/types/auth.types.ts`: thêm `AuthResponseDto.refreshToken?`, `UserDto.name?` (để tùy chọn cho mock vẫn chạy).
- Test: `impl/http/__tests__/auth.test.ts` (mới), `store/slices/__tests__/authSlice.http.test.ts` (mới), `components/auth/__tests__/AuthView.test.tsx` (mới), thêm 6 test vào `impl/__tests__/HttpWorkflowService.test.ts`.

### Kết quả test (dán output thật, không chép tay)
Máy chạy Node v26.13.0, nên test chạy bằng `NODE_OPTIONS=--no-webstorage npm test` (không sửa cấu hình vitest).

Trước khi sửa (nền A2): `npm run typecheck` sạch; `npm test`: `Test Files 27 passed (27)`, `Tests 173 passed (173)`.

Viết test trước, chạy khi chưa có code A4 (FAIL):
```
 FAIL  src/components/auth/__tests__/AuthView.test.tsx [ src/components/auth/__tests__/AuthView.test.tsx ]
 FAIL  src/services/impl/http/__tests__/auth.test.ts [ src/services/impl/http/__tests__/auth.test.ts ]
 Test Files  4 failed (4)
      Tests  13 failed | 7 passed (20)
```
(13 test fail: 6 test A4 của `HttpWorkflowService` vì auth còn gọi mock, 7 test của `authSlice.http`. 2 file `auth.test.ts`, `AuthView.test.tsx` fail vì chưa có module `auth.ts`.)

Viết `auth.ts` với refresh chưa single-flight (mỗi request 401 tự gọi refresh), chạy lại:
```
 × auth.ts: tự làm mới token khi gặp 401 (single-flight) > 3 request cùng bị 401 một lúc: chỉ đúng 1 lời gọi /auth/refresh, cả 3 gửi lại với token mới
 × auth.ts: tự làm mới token khi gặp 401 (single-flight) > 3 request cùng 401 mà refresh thất bại: 1 lời gọi refresh, onSessionExpired chỉ 1 lần
   → expected [ [ …(2) ], [ …(2) ], [ …(2) ] ] to have a length of 1 but got 3
 Test Files  1 failed | 1 passed (2)
      Tests  2 failed | 29 passed (31)
```
Thêm single-flight (`refreshOnce`) rồi chạy toàn bộ:
```
> wpe-demo@1.0.0 typecheck
> tsc -b
(không lỗi)

 ✓ src/services/http/__tests__/apiClient.test.ts (15 tests)
 ✓ src/services/impl/http/__tests__/auth.test.ts (18 tests)
 ✓ src/services/impl/__tests__/HttpWorkflowService.test.ts (13 tests)
 ✓ src/store/slices/__tests__/authSlice.http.test.ts (7 tests)
 ✓ src/components/auth/__tests__/AuthView.test.tsx (4 tests)

 Test Files  30 passed (30)
      Tests  208 passed (208)
```
Chưa chạy với backend thật (bước 6 và 3 tiêu chí chạy thật): dời sang buổi kiểm chung, mục 7.2 dòng 2–4.

### Điều chưa chắc / cần nhóm quyết
- **Đăng nhập bằng email:** ô "Email or username" nhưng backend A3 chỉ tìm theo `username`. FE gửi nguyên chuỗi người dùng nhập, nên nhập email sẽ nhận `BAD_CREDENTIALS`. Cần nhóm quyết: backend tìm cả email, hay FE đổi nhãn ô.
- **Username khi đăng ký:** màn đăng ký không có ô username (đặc tả cấm đổi giao diện), nên FE lấy phần trước `@` của email (viết thường, bỏ ký tự lạ, tối đa 50). Email có phần trước `@` ngắn hơn 3 ký tự sẽ bị backend trả 400 `VALIDATION_FAILED`. Ô "Workspace name" chưa được gửi lên (backend không nhận).
- **Refresh lỗi mạng cũng đăng xuất:** làm đúng đặc tả ("thất bại thì xóa phiên"), nhưng mất mạng chốc lát lúc token hết hạn cũng bị văng ra dù refresh token còn hạn. Nhóm xem có muốn chỉ đăng xuất khi refresh trả 401/403 không.
- **Reset store:** giá trị ban đầu của các trường gốc (`macroPhases`, `trees`, `currentProjectId`...) đang chép lại trong `authSlice` vì `useWorkflowStore.ts` không nằm trong "Được ghi". Thêm trường gốc mới vào store thì phải nhớ thêm vào `resetUserData`. `useProfileStore`, `useNotificationStore` được dọn bằng `setState` từ ngoài (không sửa 2 file đó); nếu nhóm muốn mỗi store có hàm `reset()` riêng thì cần task khác.
- **`HttpTemplateService`** tự gọi `fetch`, không qua `apiClient`, nên chưa được tự refresh khi 401 (ngoài phạm vi A4).
- **Đăng xuất chờ mạng:** `apiRequest` không có timeout, backend treo thì nút đăng xuất chờ tới khi trình duyệt bỏ request.
- **Test AuthView:** lần chạy FAIL trước khi sửa chỉ là lỗi thiếu module `auth.ts`; chưa chạy riêng được bản "có `auth.ts` mà AuthView chưa sửa" vì hook chặn lệnh `git checkout <file>` dùng để tạm bỏ thay đổi. Đã dừng phần này, không lách.
- Seed V2 (alex.kim, sarah.chen) có hash mật khẩu không khớp `Password123!` nên chưa đăng nhập được với backend thật (đã biết, cần migration, ngoài phạm vi A4).

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**
