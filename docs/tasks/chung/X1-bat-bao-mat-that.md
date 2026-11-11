# X1 — Bật bảo mật thật cho toàn hệ thống

Người làm: A (chính, bước 1–2), C (bước 3), B và D (bước 4)
Người review: cả nhóm (mỗi người duyệt phần controller của mảng mình)
Trạng thái: chưa làm
Cần có trước: A4, A5, A6, B6, C3, C4, C5, C6, D2, D4, D5, D6
Cần trước bước frontend: không
Mở khóa: X2
Nhánh git: x1-strict-security
Ước lượng: 1 ngày

## Vì sao cần task này
Trong lúc phát triển, backend chạy "mở": `anyRequest().permitAll()`, có header `X-Debug-User-Id`, có user mặc định. Một số controller còn cho **giả danh người khác qua tham số**:
- `NodeController` nhận `?currentUserId=`, và rơi về `orElse(2L)` khi không có user.
- `RealtimeController` nhận `?userId=`: ai cũng nghe được luồng sự kiện của người khác.
- `ArtifactController` có `orElse(1L)` / `orElse(null)`.
- Hai controller mới (pull 11/11/2026) cũng vậy: `WorkflowGraphController` (11 chỗ `?currentUserId=`, `orElse(2L)`) của B, `PipelineTemplateController` (3 chỗ, `orElse(1L)`) của D.

Khi mọi mảng đã nối FE với đăng nhập thật, phải đóng hết các cửa này.

## Kiến thức phải nắm
Spring Security `authorizeHttpRequests`, `AuthenticationEntryPoint` và `AccessDeniedHandler` (trả lỗi JSON), Spring profile (`application-dev.yml`), EventSource không gửi được header, test tham số hóa duyệt mọi endpoint.

## Bước 0 — Tự đọc, không dùng AI (cả nhóm)
Đọc: `BE/security/**`, mọi file trong `BE/controller/`, `docs/specs/system-overview.md` mục 4 (ma trận RBAC).
Trả lời (mỗi người trả lời cho mảng mình):
1. Endpoint nào của mảng bạn công khai, endpoint nào cần thành viên, cần owner, cần admin?
2. Endpoint nào của mảng bạn còn đọc user từ tham số hoặc có `orElse(...)`?

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `wpe-backend/src/**`, `FE/**`, `docs/**`

## Được ghi
- (A) `BE/security/**`, `wpe-backend/src/main/resources/application.yml`, `wpe-backend/src/main/resources/application-dev.yml` (mới), `BE-test/security/**`
- (C) `BE/controller/NodeController.java`, `BE/controller/RealtimeController.java`, `BE/controller/ArtifactController.java`, `FE/services/impl/http/realtime.ts`, test liên quan
- (B) `BE/controller/WorkflowGraphController.java`; (D) `BE/controller/PipelineTemplateController.java`; và controller khác của mảng mình nếu rà ra lỗi ở bước 4
- `docs/TEAM_DEVELOPMENT_GUIDE.md` (cách chạy với profile dev), `docs/tasks/chung/X1-bat-bao-mat-that.md`

## Đặc tả đã chốt
- `SecurityConfig`:
  - `permitAll` chỉ cho: Swagger, `/api/v1/auth/**` và `/api/auth/**`, `/api/v1/guest/**` và `/api/guest/**`, `/api/v1/health`, `/uploads/**`, `/error`.
  - Mọi thứ khác `authenticated()`.
  - 401 và 403 trả JSON đúng chuẩn Chương III (dùng `AuthenticationEntryPoint` và `AccessDeniedHandler`).
- `X-Debug-User-Id` và user mặc định chỉ hoạt động trong **profile `dev`**:
  - `application.yml`: `app.security.debug-user-id-enabled: false`.
  - `application-dev.yml`: bật lại; có filter đặt principal từ header này, chỉ khi request không có Bearer.
- Bỏ giả danh:
  - `NodeController`: bỏ `@RequestParam currentUserId` và `orElse(2L)`. `getMyTasks` chỉ trả task của chính người gọi; `?userId=` khác người gọi → 403.
  - `RealtimeController`: bỏ `?userId=`, lấy user từ token.
  - `ArtifactController`: dùng `requireCurrentUserId()`.
- SSE: EventSource không gửi được header, nên cho phép JWT qua query `?access_token=` **chỉ** với `/api/v1/realtime/subscribe` (xử lý trong `JwtAuthFilter`). FE `realtime.ts` gắn token vào URL. Token hết hạn thì refresh rồi kết nối lại.
- Mọi controller lấy user bằng `requireCurrentUserId()`.

## Việc cần làm
1. (A) 🧠 Lập bảng **toàn bộ endpoint** từ code thật (method, path, công khai / thành viên / owner / admin). Tìm bằng `grep -rn "@\(Get\|Post\|Put\|Patch\|Delete\|Request\)Mapping" wpe-backend/src/main/java`. Bảng này cũng là đầu vào cho X2.
2. (A) 🤝 Sửa `SecurityConfig`, thêm EntryPoint và AccessDeniedHandler, profile dev, nhận token qua query cho SSE, kèm test.
3. (C) 🤝 Sửa `NodeController`, `RealtimeController`, `ArtifactController` và `realtime.ts`, kèm test.
4. (B, D) 🤝 Bỏ `?currentUserId=` và `orElse(...)` trong `WorkflowGraphController` (B) và `PipelineTemplateController` (D). 🧠 Tự rà các controller khác của mảng mình: endpoint nào cũng lấy user từ `requireCurrentUserId()` và kiểm quyền đúng như bảng ở bước 1. Thiếu thì sửa.
5. (Cả nhóm) Chạy toàn bộ app ở profile mặc định (không phải dev), không dùng header debug.

## Tiêu chí xong
- [ ] `grep -rn "orElse(2L)\|orElse(1L)" wpe-backend/src/main` không còn kết quả.
- [ ] Có test tham số hóa dựa trên bảng ở bước 1: mọi endpoint không công khai, gọi không token → 401.
- [ ] User thường gọi endpoint admin → 403.
- [ ] Gọi `?currentUserId=3` hoặc `?userId=3` không còn đóng vai được user 3.
- [ ] FE chạy trọn luồng đăng nhập → làm task → nhận realtime ở profile mặc định.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. Vì sao chỉ cho token qua query với SSE, không cho mọi API?
2. Profile dev khác profile mặc định ở đâu? Lỡ deploy nhầm profile dev thì rủi ro gì?
3. Sau này thêm endpoint mới mà quên phân quyền thì phát hiện bằng gì?

## Cấm
- Sửa file ngoài mục "Được ghi". File dùng chung thì báo nhóm trước (README mục 6).
- Đọc, in, commit `.env*`, khóa, mật khẩu thật, API key. Dùng `git add -f`.
- Tự ghi trạng thái `xong`.

## Dành cho Claude (đọc trước khi làm)
Người dán file này là **một trong các người làm** của task chung. Hỏi họ là A, B, C hay D, rồi chỉ làm các bước của người đó.
1. Chưa sửa code vội. Yêu cầu người làm trả lời Bước 0 cho mảng của họ.
2. Bước 🧠: không làm hộ. Chỉ gợi ý.
3. Bước 🤝: làm từng phần nhỏ, giải thích, yêu cầu họ tự chạy test.
4. Chỉ sửa đúng phần file được ghi cho người đó.
5. Không đọc hay in `.env*`, khóa, mật khẩu, API key.
6. Làm xong: hỏi họ 3 câu bảo vệ, chỉ đổi trạng thái thành `chờ kiểm`.

## Ghi chép của người làm
### Bảng endpoint (A)

### Kết quả rà soát của từng mảng (A, B, C, D)

### Kết quả test (dán output thật)

### Điều chưa chắc / cần nhóm quyết

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**
