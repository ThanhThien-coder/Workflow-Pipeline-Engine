# A4 — Đăng nhập trên giao diện, tự làm mới token, đăng xuất (FE Cụm 1)

Người làm: A
Người review: B
Trạng thái: chưa làm
Cần có trước: A2, A3
Cần trước bước frontend: không
Mở khóa: X1
Nhánh git: a4-auth-ui
Ước lượng: 1–1,5 ngày

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

### Đã làm gì (file nào, vì sao)

### Kết quả test (dán output thật, không chép tay)

### Điều chưa chắc / cần nhóm quyết

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**
