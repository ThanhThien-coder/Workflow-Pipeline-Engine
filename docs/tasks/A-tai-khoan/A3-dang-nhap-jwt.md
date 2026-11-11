# A3 — Đăng ký, đăng nhập, JWT và xoay vòng refresh token (Cụm 1)

Người làm: A
Người review: B
Trạng thái: chưa làm
Cần có trước: A1
Cần trước bước frontend: không
Mở khóa: A4, A5, A6, A8
Nhánh git: a3-auth-jwt
Ước lượng: 2–2,5 ngày

## Vì sao cần task này
Backend chưa có `AuthController`. `BE/security/SecurityConfig.java` đang để `anyRequest().permitAll()`. `jwt.secret` nằm thẳng trong `application.yml`. Task này là nền cho A4–A6 và cho việc bật bảo mật thật ở X1.

## Kiến thức phải nắm
BCrypt (salt, cost), JWT (header.payload.signature, HS256, claims, `exp`), access token và refresh token, xoay vòng token (rotation) và phát hiện dùng lại (reuse detection), `token_version`, chuỗi filter của Spring Security, `OncePerRequestFilter`, `SecurityContextHolder`, API của jjwt 0.12 (đã có trong `pom.xml`).

## Bước 0 — Tự đọc, không dùng AI
Đọc: integration map Cụm 1 (mục 1.1–1.3); `docs/specs/system-overview.md` mục 5; `BE/security/SecurityConfig.java`, `BE/security/CurrentUserProvider.java`, `BE/entity/UserEntity.java`, `BE/entity/RefreshTokenEntity.java`; bảng `users` và `refresh_token` trong `V1__init_schema.sql`; `V2__seed_initial_data.sql`.
Trả lời:
1. Vì sao lưu `token_hash` (SHA-256) của refresh token chứ không lưu token gốc? Vì sao refresh token không băm bằng BCrypt?
2. Kẻ gian lấy được một refresh token cũ (đã bị xoay) rồi gửi lại. Hệ thống phát hiện thế nào và phản ứng ra sao (theo mục 1.3)?
3. Đổi mật khẩu thì `token_version` tăng. Access token cũ bị chặn ở đâu, bằng cách nào?
4. 🧠 Vẽ nháp sơ đồ tuần tự "Đăng nhập" trên giấy, chụp ảnh dán vào ghi chép (bản chính thức làm ở A8).

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `wpe-backend/src/**`
- `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md`, `docs/specs/system-overview.md`, `docs/specs/database-schema.md`

## Được ghi
- `BE/controller/AuthController.java` (mới)
- `BE/service/auth/**` (mới: `AuthService`, `JwtService`, `RefreshTokenService`)
- `BE/security/JwtAuthFilter.java` (mới), `BE/security/SecurityConfig.java`, `BE/security/CurrentUserProvider.java`
- `BE/dto/request/auth/**`, `BE/dto/response/auth/**`
- `BE/repository/UserRepository.java`, `BE/repository/RefreshTokenRepository.java` (chỉ thêm method)
- `BE/exception/**` (thêm exception và handler mới)
- `wpe-backend/src/main/resources/application.yml` (mục `jwt`)
- `BE-test/service/auth/**`, `BE-test/security/**`, `BE-test/controller/AuthControllerTest.java` (mới)
- `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md` (Cụm 1), `docs/tasks/A-tai-khoan/A3-dang-nhap-jwt.md`

## Đặc tả đã chốt
- Endpoint đặt ở cả `/api/v1/auth/**` và `/api/auth/**` (giống các controller khác): `POST register` → 201, `POST login` → 200, `POST refresh` → 200, `POST logout` → 200 `{ "success": true }`. Body và response đúng mục 1.1–1.3. `user.id` trả dạng chuỗi.
- Mã lỗi:
  - Sai mật khẩu hoặc không có user → 401 `BAD_CREDENTIALS`, hai trường hợp cùng một thông báo (không để lộ user có tồn tại hay không).
  - `is_locked = true` → 403 `ACCOUNT_LOCKED`.
  - Trùng username hoặc email → 409 `USERNAME_TAKEN` / `EMAIL_TAKEN`.
  - Refresh token không có, sai hoặc hết hạn → 401 `INVALID_REFRESH_TOKEN`.
  - Refresh token đã bị thu hồi mà vẫn gửi lại → thu hồi **mọi** refresh token của user đó, trả 401 `REFRESH_TOKEN_REUSED`.
- Access token: HS256, sống 15 phút (`jwt.access-token-expiration-ms`). Claims: `sub` = userId, `username`, `role` (system_role), `tv` = token_version.
- Refresh token: 32 byte ngẫu nhiên từ `SecureRandom`, mã hóa base64url, tiền tố `rt_`. Lưu SHA-256 dạng hex vào `refresh_token.token_hash`. Sống 7 ngày. Có `rememberMe` hay không thì vẫn 7 ngày; FE tự quyết định lưu ở `localStorage` hay `sessionStorage`.
- Secret: `jwt.secret: ${JWT_SECRET:<giá trị dev đang có>}`. Giữ giá trị dev làm mặc định để máy cả nhóm chạy được; CI và production phải đặt biến môi trường `JWT_SECRET`.
- BCrypt cost 12 cho mật khẩu mới (mục 1.1). Hash trong seed V2 là cost 10, vẫn so khớp được. 🧠 Viết test kiểm hash seed có khớp `Password123!` không. Nếu **không khớp**: tạo migration cập nhật hash (xin số V mới trong nhóm, xem README mục 6.2).
- `JwtAuthFilter`: đọc `Authorization: Bearer`, kiểm chữ ký, hạn dùng, `tv` bằng `users.token_version` và `is_locked = false`. Hợp lệ thì đặt `SecurityContext` với principal = userId (`Long`) và authority `ROLE_<system_role>`. Token sai hoặc hết hạn thì filter **chưa chặn ở task này** (để `permitAll` vẫn chạy cho dev), chỉ không đặt principal.
- `CurrentUserProvider`:
  - Request **có** header `Authorization` mà token không hợp lệ → **không** được rơi về user debug. `requireCurrentUserId()` ném 401 `TOKEN_EXPIRED`.
  - Request **không có** `Authorization` → giữ cơ chế `X-Debug-User-Id` và user mặc định như cũ, cho tới X1.
- `SecurityConfig`: thêm filter trước `UsernamePasswordAuthenticationFilter`, vẫn `permitAll` cho tới X1, bật `@EnableMethodSecurity` để A6 dùng `@PreAuthorize`.
- Task này chưa làm phần FE (A4 làm).

## Việc cần làm
1. 🧠 Bước 0 và sơ đồ nháp.
2. 🧠 **Trước khi code**, viết vào ghi chép bảng test case (tình huống → kết quả mong đợi) cho register, login, refresh, logout và filter, ít nhất 12 dòng.
3. 🤝 `JwtService` và test: tạo token, đọc token, token hết hạn, sai chữ ký.
4. 🤝 `RefreshTokenService` và test: tạo, xoay, phát hiện dùng lại, thu hồi hết.
5. 🧠 Tự viết hàm băm SHA-256 ra chuỗi hex (dùng `MessageDigest`), kèm test.
6. 🤝 `AuthService`, `AuthController`, DTO, handler lỗi, test controller (`@WebMvcTest`).
7. 🤝 `JwtAuthFilter`, sửa `CurrentUserProvider` theo đặc tả, sửa `SecurityConfig`.
8. 🧠 Test bằng Swagger theo kịch bản ở "Tiêu chí xong", dán response thật.
9. Cập nhật Cụm 1 của integration map với các mã lỗi mới.

## Tiêu chí xong
- [ ] `./mvnw test` pass, test mới phủ đủ bảng test case ở bước 2.
- [ ] Swagger: login `alex.kim` / `Password123!` → 200, có `token` và `refreshToken`. Sai mật khẩu → 401 `BAD_CREDENTIALS`.
- [ ] `GET /api/v1/projects` kèm `Authorization: Bearer <token>` trả dự án của alex. Sửa 1 ký tự trong token thì nhận 401, **không** bị coi là user 2.
- [ ] Refresh lần 1 nhận cặp token mới. Gửi lại refresh cũ → 401 `REFRESH_TOKEN_REUSED`, và refresh token mới cũng không dùng được nữa.
- [ ] Logout xong, dùng lại refresh token đó → 401.
- [ ] Không commit secret mới. `jwt.secret` đọc được từ biến môi trường `JWT_SECRET`.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. Vì sao ở task này token sai mà backend vẫn cho request đi tiếp? Rủi ro gì, X1 xử lý thế nào?
2. Giải thích luồng phát hiện refresh token bị dùng lại bằng dữ liệu trong bảng `refresh_token`.
3. Hai tab cùng refresh một lúc bằng cùng một refresh token thì chuyện gì xảy ra? (gợi ý: A4 xử lý "single-flight")

## Cấm
- Sửa file ngoài mục "Được ghi". File dùng chung thì báo nhóm trước (README mục 6).
- Đọc, in, commit `.env*`, khóa, mật khẩu thật, API key. Dùng `git add -f`.
- Sửa migration đã có (V1–V4, và migration người khác đã merge).
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
