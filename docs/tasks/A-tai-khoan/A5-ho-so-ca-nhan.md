# A5 — Hồ sơ cá nhân, đổi mật khẩu, ảnh đại diện (Cụm 2)

Người làm: A
Người review: B
Trạng thái: chờ kiểm
Cần có trước: A2, A3
Cần trước bước frontend: không
Mở khóa: X1
Nhánh git: a5-profile
Ước lượng: 1,5–2 ngày

> ⚡ **Chế độ sprint:** task này **để lại sau hạn nộp**, làm theo chế độ thường (xem [SPRINT_2_NGAY.md](../SPRINT_2_NGAY.md) mục 6).

## Vì sao cần task này
Bảng `users` chưa có cột cho chức danh, tiểu sử, kỹ năng, liên kết và ảnh đại diện. `ProfileView` đang chạy bằng mock.

## Kiến thức phải nắm
multipart/form-data, kiểm định dạng file bằng magic bytes, lưu file và phục vụ file tĩnh trong Spring (`ResourceHandler`), cột JSONB với `@JdbcTypeCode(SqlTypes.JSON)`, `ALTER TABLE` trong Flyway.

## Bước 0 — Tự đọc, không dùng AI
Đọc: integration map Cụm 2; bảng USERS trong `docs/specs/database-schema.md`; `FE/services/contracts/IProfileService.ts`; `FE/types/profile.types.ts`; `FE/views/ProfileView.tsx`; `FE/store/useProfileStore.ts`.
Trả lời:
1. `IProfileService` có 9 phương thức, SSOT chỉ có 4 endpoint. Phương thức nào làm thật ở task này, phương thức nào giữ mock? Tự nghĩ trước rồi so với đặc tả bên dưới.
2. Vì sao chỉ kiểm `Content-Type` do client gửi là chưa đủ khi cho upload ảnh?
3. Đổi mật khẩu xong thì những phiên nào bị thu hồi, bằng 2 cơ chế nào?

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `wpe-backend/src/**`, `FE/**`, `docs/**`

## Được ghi
- `wpe-backend/src/main/resources/db/migration/V7__add_user_profile_columns.sql` (số V7 đã cấp cho A; V5, V6 đã được dùng)
- `BE/entity/UserEntity.java` (thêm trường)
- `BE/controller/UserProfileController.java` (mới), `BE/service/profile/**` (mới), `BE/dto/request/profile/**`, `BE/dto/response/profile/**`
- `BE/config/StaticResourceConfig.java` (mới, phục vụ `/uploads/**`)
- `wpe-backend/src/main/resources/application.yml` (mục mới `app.upload`, `spring.servlet.multipart`)
- `BE-test/**/profile/**` (test mới)
- `FE/services/impl/HttpProfileService.ts` (mới), `FE/services/container.ts` (chỉ dòng `profileService`), `FE/types/profile.types.ts`, `FE/views/ProfileView.tsx` (chỉ phần xử lý lỗi), test FE
- `.gitignore` (thêm `wpe-backend/uploads/` — file dùng chung, báo nhóm)
- `docs/specs/database-schema.md` (bảng USERS), `docs/tasks/A-tai-khoan/A5-ho-so-ca-nhan.md`

## Đặc tả đã chốt
- V7: `ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500), ADD COLUMN title VARCHAR(150), ADD COLUMN bio TEXT, ADD COLUMN skills JSONB NOT NULL DEFAULT '[]'::jsonb, ADD COLUMN links JSONB NOT NULL DEFAULT '{}'::jsonb;`
- Endpoint dưới `/api/v1/users/me/`: `GET profile`, `PUT profile`, `POST password`, `POST avatar` (multipart, field tên `file`), `DELETE avatar`.
- Response đúng kiểu `ProfileDto` của FE (`FE/types/profile.types.ts`). Trường nào FE có mà DB không có thì trả giá trị mặc định hợp lý và ghi vào ghi chép.
- Lỗi: đổi email bị trùng → 409 `EMAIL_TAKEN`; mật khẩu hiện tại sai → 400 `WRONG_PASSWORD`; mật khẩu mới dưới 8 ký tự → 400 `VALIDATION_FAILED`.
- Đổi mật khẩu, làm trong **1 transaction**: băm BCrypt mới, `token_version += 1`, mọi refresh token của user đặt `revoked = true`.
- Ảnh đại diện:
  - Tối đa 2MB, chỉ nhận PNG/JPEG/WebP, kiểm bằng magic bytes.
  - Lưu ở `${app.upload.dir:uploads}/avatars/<userId>-<chuỗi ngẫu nhiên>.<đuôi>`, URL trả về dạng `/uploads/avatars/...`. Thay ảnh thì xóa file cũ.
  - Sai định dạng → 400 `UNSUPPORTED_MEDIA`. Quá cỡ → 400 `FILE_TOO_LARGE` (đặt `spring.servlet.multipart.max-file-size: 2MB` và bắt `MaxUploadSizeExceededException`).
- Giữ mock, ghi rõ trong `HttpProfileService`: `setProjectPublic`, `updatePrivacy`, `deactivateAccount`, `deleteAccount` (chưa có trong SSOT).
- Không đưa file ảnh vào git: thêm `wpe-backend/uploads/` vào `.gitignore`.

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 Tự viết file migration V7. Claude chỉ review.
3. 🤝 Entity, service, controller và test (hồ sơ, mật khẩu, ảnh).
4. 🧠 Tự viết hàm kiểm magic bytes kèm test: PNG `89 50 4E 47`, JPEG `FF D8 FF`, WebP là `RIFF` ở byte 0–3 và `WEBP` ở byte 8–11.
5. 🤝 `HttpProfileService`, nối `container.ts`, xử lý lỗi trên `ProfileView`.
6. 🧠 Chạy thật: đổi ảnh đại diện; đổi mật khẩu rồi đăng nhập lại bằng mật khẩu mới; một tab khác đang đăng nhập phải bị đá ra ở lần gọi API kế tiếp.
7. Cập nhật bảng USERS trong `docs/specs/database-schema.md`.

## Tiêu chí xong
- [ ] `./mvnw test` và `npm test` pass. Có test BE cho: cập nhật hồ sơ, trùng email, sai mật khẩu cũ, đổi mật khẩu làm thu hồi phiên, file sai định dạng (file `.txt` đổi đuôi thành `.png`), ảnh trên 2MB.
- [ ] App khởi động trên DB đã chạy V1–V6 thì chạy được V7 (dán log Flyway).
- [ ] Đổi mật khẩu xong, dùng access token cũ gọi API → 401.
- [ ] Commit không chứa file ảnh nào.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. Vì sao `skills` và `links` để JSONB mà không tạo bảng riêng? Khi nào nên tách bảng theo 3NF?
2. Magic bytes là gì? Kẻ gian đổi đuôi file `.exe` thành `.png` thì bị chặn ở bước nào?
3. Đã thu hồi refresh token rồi, vì sao vẫn phải tăng `token_version`?

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

> **Quyết định của người làm (A), 13/11/2026:** task này ghi "để lại sau hạn nộp, chế độ thường", nhưng A quyết định làm **kiểu sprint**: Claude làm hết, kể cả các bước 🧠 (migration V7, hàm kiểm magic bytes); **bỏ Bước 0 và mục "Dành cho Claude"**. Mỗi hành vi đều viết test trước, chạy thấy FAIL rồi mới code cho PASS.
>
> **Vòng hiểu: chưa làm.**

### Trả lời Bước 0
(Bỏ qua theo quyết định ở trên.)

### Đã làm gì (file nào, vì sao)
**Backend**
- `V7__add_user_profile_columns.sql`: đúng câu `ALTER TABLE` trong đặc tả (5 cột; `skills`/`links` JSONB có DEFAULT nên dòng cũ tự có `[]`/`{}`). Không sửa migration nào khác.
- `UserEntity`: thêm `avatarUrl`, `title`, `bio`, `skills` (`List<String>`), `links` (`Map<String,String>`); hai cột JSONB dùng `@JdbcTypeCode(SqlTypes.JSON)` giống các entity khác; `@Builder.Default` để user mới (đăng ký) có `[]`/`{}`.
- `service/profile/ImageMagicBytes` + `ImageType`: nhận PNG `89 50 4E 47`, JPEG `FF D8 FF`, WebP `RIFF` (byte 0–3) + `WEBP` (byte 8–11). Không tin Content-Type hay đuôi file.
- `service/profile/AvatarStorage`: lưu `${app.upload.dir}/avatars/<userId>-<16 ký tự ngẫu nhiên>.<đuôi theo magic bytes>`, trả URL `/uploads/avatars/...`; chỉ xóa file khi URL đúng dạng và nằm trong thư mục avatars (chặn `../`).
- `service/profile/ProfileService`:
  - `updateProfile`: email đã thuộc user khác → `ConflictException("EMAIL_TAKEN", ...)` (409, dùng handler sẵn có). `saveAndFlush` để vi phạm UNIQUE do 2 request cùng lúc cũng thành 409.
  - `changePassword` (`@Transactional`, 1 transaction): sai mật khẩu cũ → 400 `WRONG_PASSWORD`; đúng thì băm BCrypt mới, `token_version + 1`, `refreshTokenRepository.revokeAllByUserId(userId)`.
  - `uploadAvatar`: rỗng hoặc sai magic bytes → 400 `UNSUPPORTED_MEDIA`; > 2MB → 400 `FILE_TOO_LARGE`; thay ảnh thì xóa file cũ **sau khi commit** (rollback thì xóa file mới). `removeAvatar`: đặt null, xóa file.
  - Trường FE có mà DB chưa có: `privacy` = `{visibility: "members", showEmail: false, showStats: true}` (giống mặc định của mock), `projects` = `[]`, `recentActivity` = `[]`. `displayName` = `full_name`, trống thì lấy `username`; `title`/`bio`/link trống trả `""`.
- `service/profile/ProfileBadRequestException` + `@ExceptionHandler` **cục bộ** trong `UserProfileController`, trả `ErrorResponse` cùng dạng `{timestamp,status,error,message,path}`. Không sửa `GlobalExceptionHandler`.
- `UserProfileController`: `GET/PUT /profile`, `POST /password`, `POST /avatar` (multipart, field `file`), `DELETE /avatar` dưới `/api/v1/users/me` (và `/api/users/me` như AuthController). Mật khẩu mới < 8 ký tự bị `@Size(min = 8)` chặn → 400 `VALIDATION_FAILED` (handler sẵn có).
- `application.yml`: `spring.servlet.multipart.max-file-size: 2MB`, `max-request-size: 3MB`, **`resolve-lazily: true`**; `app.upload.dir: ${APP_UPLOAD_DIR:uploads}`.
  - Vì sao `resolve-lazily`: mặc định Spring phân tích multipart **trước** khi chọn controller, nên `MaxUploadSizeExceededException` chỉ tới được `GlobalExceptionHandler` (bắt `Exception` → 500). Bật lười thì lỗi được ném lúc Spring đọc tham số `file` của `uploadAvatar`, lúc đó đã biết controller nên `@ExceptionHandler(MaxUploadSizeExceededException)` cục bộ trả được 400 `FILE_TOO_LARGE`, không đụng file dùng chung. Hiện chỉ A5 dùng multipart nên không ảnh hưởng chỗ khác. **Chưa kiểm trên server thật** (xem "Điều chưa chắc").
- `config/StaticResourceConfig`: phục vụ `/uploads/**` từ `app.upload.dir`.

**Frontend**
- `services/impl/HttpProfileService.ts` (mới): 5 hàm gọi API thật; 4 hàm giữ mock (`setProjectPublic`, `updatePrivacy`, `deactivateAccount`, `deleteAccount`), ghi rõ trong comment và hằng `PROFILE_METHODS_STILL_MOCKED`. Đổi mã lỗi backend → `ProfileError`: `EMAIL_TAKEN`→`EMAIL_TAKEN`, `WRONG_PASSWORD`→`INVALID_PASSWORD`, `VALIDATION_FAILED`→`WEAK_PASSWORD` (đổi mật khẩu) / `VALIDATION` (sửa hồ sơ), `UNSUPPORTED_MEDIA`→`UNSUPPORTED_TYPE`, `FILE_TOO_LARGE`. `avatarUrl` tương đối được ghép gốc backend (`http://localhost:8080/uploads/...`). Upload tự gọi `fetch` với `FormData` vì `apiClient` chỉ gửi JSON; gặp 401 thì gọi 1 request qua `apiClient` để kích hoạt tự làm mới token (A4) rồi gửi lại đúng 1 lần.
- `container.ts`: dòng `profileService` thành `isMock ? new MockProfileApi() : new HttpProfileService()` (+ 1 dòng import).
- `types/profile.types.ts`: thêm mã `EMAIL_TAKEN` vào `ProfileErrorCode`.
- `ProfileView.tsx` (chỉ phần xử lý lỗi): thêm câu cho `EMAIL_TAKEN`; lỗi `ApiError` (mạng, 401, 500) hiện `message` thay vì câu chung chung.

**Khác:** `.gitignore` thêm `wpe-backend/uploads/` (file dùng chung, báo nhóm); `docs/specs/database-schema.md` cập nhật bảng USERS (ERD + từ điển dữ liệu).

### Kết quả test (dán output thật, không chép tay)
Máy: Windows 11, JDK 21, Node v26.13.0. Test FE chạy với `NODE_OPTIONS=--no-webstorage` (Node 26).

**1. Trước khi code (test mới + code rỗng), backend** — `./mvnw -B test -Dtest='ImageMagicBytesTest,UploadConfigTest,ProfileServiceTest,UserProfileControllerTest'`:
```
[ERROR]   UserProfileControllerTest.changePassword_wrongPassword:130 Status expected:<400> but was:<500>
[ERROR]   UserProfileControllerTest.uploadAvatar_maxUploadSizeExceeded:204 Status expected:<400> but was:<500>
[ERROR]   UserProfileControllerTest.uploadAvatar_tooLarge_service:192 Status expected:<400> but was:<500>
[ERROR]   UserProfileControllerTest.uploadAvatar_unsupported:179 Status expected:<400> but was:<500>
[ERROR]   ImageMagicBytesTest.jpeg_detected:43
[ERROR]   ImageMagicBytesTest.png_detected:37
[ERROR]   ImageMagicBytesTest.webp_detected:49
[ERROR]   ProfileServiceTest.changePassword_isTransactional:197
[ERROR]   ProfileServiceTest.changePassword_wrongCurrent:171
[ERROR]   ProfileServiceTest.updateProfile_emailTaken:156
[ERROR]   ProfileServiceTest.uploadAvatar_textRenamedPng:209
[ERROR]   ProfileServiceTest.uploadAvatar_tooLarge:232
[ERROR]   UploadConfigTest.multipartSettings:29
[ERROR] Errors:
[ERROR]   ProfileServiceTest.changePassword_revokesSessions:182 » UnsupportedOperation TODO A5
[ERROR]   ProfileServiceTest.deleteByUrl_ignoresPathTraversal:293 » UnsupportedOperation TODO A5
[ERROR]   ProfileServiceTest.getMyProfile_defaults:97 » UnsupportedOperation TODO A5
[ERROR]   ProfileServiceTest.getMyProfile_displayNameFallback:116 » UnsupportedOperation TODO A5
[ERROR]   ProfileServiceTest.removeAvatar_ok:277 » UnsupportedOperation TODO A5
[ERROR]   ProfileServiceTest.updateProfile_ok:124 » UnsupportedOperation TODO A5
[ERROR]   ProfileServiceTest.updateProfile_sameEmail_ok:143 » UnsupportedOperation TODO A5
[ERROR]   ProfileServiceTest.uploadAvatar_empty:221 » Introspection
[ERROR]   ProfileServiceTest.uploadAvatar_extensionFromMagicBytes:256 » UnsupportedOperation TODO A5
[ERROR]   ProfileServiceTest.uploadAvatar_png_ok:243 » UnsupportedOperation TODO A5
[ERROR]   ProfileServiceTest.uploadAvatar_replacesOldFile:265 » UnsupportedOperation TODO A5
[ERROR] Tests run: 37, Failures: 13, Errors: 11, Skipped: 0
[INFO] BUILD FAILURE
```
`UploadsStaticResourceTest` viết sau: lần chạy đầu `UploadsStaticResourceTest.missingAvatar_404:63 Status expected:<404> but was:<500>` → đổi thành test ghi lại hành vi hiện tại (xem "Điều chưa chắc" mục 2).

**2. Trước khi code, frontend** — `NODE_OPTIONS=--no-webstorage npx vitest run src/services/impl/__tests__/HttpProfileService.test.ts src/views/__tests__/ProfileView.test.tsx`:
```
 FAIL  src/services/impl/__tests__/HttpProfileService.test.ts [ src/services/impl/__tests__/HttpProfileService.test.ts ]
Error: Failed to resolve import "../HttpProfileService" from "src/services/impl/__tests__/HttpProfileService.test.ts". Does the file exist?
 FAIL  src/views/__tests__/ProfileView.test.tsx > ProfileView: xử lý lỗi > tải hồ sơ lỗi mạng (ApiError): hiện message của ApiError, không phải câu chung chung
TestingLibraryElementError: Unable to find an element with the text: Không kết nối được tới máy chủ.. This could be because the text is broken up by multiple elements. ...
 FAIL  src/views/__tests__/ProfileView.test.tsx > ProfileView: xử lý lỗi > ProfileError EMAIL_TAKEN: hiện câu báo email đã có người dùng
TestingLibraryElementError: Unable to find an element with the text: This email is already used by another account.. This could be because the text is broken up by multiple elements. ...
 Test Files  2 failed (2)
      Tests  2 failed (2)
```

**3. Sau khi code, TOÀN BỘ backend** — `cd wpe-backend && ./mvnw -B test` (trích):
```
[INFO] Tests run: 2, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.892 s -- in com.pipeline.wpe.controller.profile.UploadsStaticResourceTest
[INFO] Tests run: 13, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.939 s -- in com.pipeline.wpe.controller.profile.UserProfileControllerTest
[WARNING] Tests run: 2, Failures: 0, Errors: 0, Skipped: 1, Time elapsed: 0.506 s -- in com.pipeline.wpe.service.auth.SeedPasswordHashTest
[INFO] Tests run: 7, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.018 s -- in com.pipeline.wpe.service.profile.ImageMagicBytesTest
[INFO] Tests run: 16, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.231 s -- in com.pipeline.wpe.service.profile.ProfileServiceTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.022 s -- in com.pipeline.wpe.service.profile.UploadConfigTest
[WARNING] Tests run: 473, Failures: 0, Errors: 0, Skipped: 1
[INFO] BUILD SUCCESS
```
1 test skip là `SeedPasswordHashTest`, có sẵn `@Disabled` từ A3 (hash seed V2 không khớp `Password123!`), không thuộc A5, không sửa.

**4. Sau khi code, frontend** — `npm ci`; `npm run typecheck` (`tsc -b`, không lỗi); `NODE_OPTIONS=--no-webstorage npm test`:
```
 Test Files  49 passed (49)
      Tests  380 passed (380)
```
(Trong đó `HttpProfileService.test.ts` 17 test, `ProfileView.test.tsx` 2 test.)

Test BE theo "Tiêu chí xong": cập nhật hồ sơ (`updateProfile_ok`, `updateProfile_200`); trùng email (`updateProfile_emailTaken`, `updateProfile_409`); sai mật khẩu cũ (`changePassword_wrongCurrent`, `changePassword_wrongPassword`); đổi mật khẩu thu hồi phiên (`changePassword_revokesSessions`: tokenVersion 3→4, `revokeAllByUserId(2)` được gọi sau `save`; `changePassword_isTransactional`); mật khẩu mới 7 ký tự → `VALIDATION_FAILED` (`changePassword_tooShort`); file `.txt` đổi tên `.png` (`uploadAvatar_textRenamedPng`); ảnh trên 2MB (`uploadAvatar_tooLarge`, `uploadAvatar_tooLarge_service`, `uploadAvatar_maxUploadSizeExceeded`); magic bytes PNG/JPEG/WebP đúng và sai (`ImageMagicBytesTest`, 7 test); thay ảnh xóa file cũ; chặn `../`; access token cũ → 401 `TOKEN_EXPIRED` ở tầng controller (`oldAccessToken_401`, giả lập bằng mock).

**5. Chạy thật (bước 6; log Flyway V7; access token cũ → 401): CHƯA CHẠY.** Lúc làm (13/11/2026) máy không có Postgres (5432), RabbitMQ (5672) hay backend 8080 nào đang nghe (`Test-NetConnection` đều `False`), Docker Desktop không chạy (`docker ps`: không kết nối được docker API). Theo quy tắc sprint, không tự bật Docker/DB dùng chung; dừng bước này và báo lại. **Chưa có log Flyway thật.**

### Điều chưa chắc / cần nhóm quyết
1. **FILE_TOO_LARGE khi file vượt `max-file-size`.** Không sửa `GlobalExceptionHandler` (file dùng chung). Đã dùng cách nằm trong phạm vi được ghi: `spring.servlet.multipart.resolve-lazily: true` + `@ExceptionHandler(MaxUploadSizeExceededException)` cục bộ trong controller. Test MockMvc chỉ chứng minh handler cục bộ đổi lỗi này thành 400 `FILE_TOO_LARGE`; MockMvc **không** chạy bộ phân tích multipart thật nên việc lỗi được ném muộn (sau khi chọn controller) **chưa kiểm trên Tomcat thật**. Nếu chạy thật vẫn ra 500: **xin nhóm cho thêm 1 handler `MaxUploadSizeExceededException` → `400 FILE_TOO_LARGE` vào `GlobalExceptionHandler`** (cách chắc chắn nhất; khi đó có thể bỏ `resolve-lazily`).
2. **URL không có file dưới `/uploads/**` trả 500 thay vì 404**: Spring 6.1 ném `NoResourceFoundException`, `GlobalExceptionHandler` bắt `Exception` thành 500 (đúng cho mọi URL không tồn tại, không riêng A5). Test `UploadsStaticResourceTest.missingAvatar_currentBehavior` ghi lại hành vi này. Cần nhóm thêm handler `NoResourceFoundException` → 404 rồi đổi test.
3. **`.gitignore` (file dùng chung)**: đã thêm `wpe-backend/uploads/` đúng mục "Được ghi" — báo nhóm.
4. **`AuthResponse.user.avatarUrl` vẫn luôn null**: `UserMapper` có `@Mapping(target = "avatarUrl", ignore = true)`; `UserMapper` không nằm trong "Được ghi" nên chưa sửa. Cần nhóm cho sửa nếu muốn avatar có ngay sau đăng nhập.
5. **X1 phải mở công khai `/uploads/**`** khi đổi `anyRequest().permitAll()` thành `authenticated()` (thẻ `<img>` không gửi Bearer token).
6. **Chạy FE qua proxy**: nếu đặt `VITE_API_BASE_URL` tương đối (`/api/v1`), ảnh `/uploads/...` sẽ gọi vào Vite (chưa có proxy `/uploads`, `vite.config.ts` không được sửa). Mặc định là URL đầy đủ `http://localhost:8080/api/v1` nên không sao.
7. **Câu `WEAK_PASSWORD` trong ProfileView** ghi "ít nhất 8 ký tự và 1 chữ số" (theo mock); backend chỉ yêu cầu ≥ 8 ký tự (đặc tả). Giữ nguyên câu; nhóm chốt có bắt chữ số hay không.
8. **Upload multipart không đi qua `apiClient`** (apiClient chỉ gửi JSON). 401 được xử lý bằng 1 request JSON qua apiClient để làm mới token rồi gửi lại. Gọn hơn: cho `apiClient` nhận `FormData` (file của A2).
9. **Chưa chạy thật** (Kết quả test mục 5): cần bật Docker (Postgres, RabbitMQ), chạy backend nhánh này ở cổng khác (VD 8082) để: xem log Flyway áp V7; đăng ký user thử; cập nhật hồ sơ; đổi ảnh (PNG nhỏ, và file > 2MB để kiểm mục 1); đổi mật khẩu; gọi API bằng access token cũ → phải 401 `TOKEN_EXPIRED`; đăng nhập bằng mật khẩu mới → 200; `SELECT token_version, avatar_url, skills, links FROM users ...`, `SELECT revoked FROM refresh_token WHERE user_id = ...`.
10. **Bước cần trình duyệt (dời buổi kiểm chung)**: ProfileView ở chế độ API thật hiển thị/lưu hồ sơ, đổi ảnh hiện đúng ảnh, các câu báo lỗi; đổi mật khẩu ở tab 1 thì tab 2 đang đăng nhập bị đá ra ở lần gọi API kế tiếp.

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**
