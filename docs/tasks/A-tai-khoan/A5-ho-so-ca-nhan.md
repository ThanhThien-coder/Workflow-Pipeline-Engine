# A5 — Hồ sơ cá nhân, đổi mật khẩu, ảnh đại diện (Cụm 2)

Người làm: A
Người review: B
Trạng thái: chưa làm
Cần có trước: A2, A3
Cần trước bước frontend: không
Mở khóa: X1
Nhánh git: a5-profile
Ước lượng: 1,5–2 ngày

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
