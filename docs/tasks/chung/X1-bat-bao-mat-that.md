# X1 — Bật bảo mật thật cho toàn hệ thống

Người làm: A (chính, bước 1–2), C (bước 3), B và D (bước 4)
Người review: cả nhóm (mỗi người duyệt phần controller của mảng mình)
Trạng thái: xong
Cần có trước: A4, A5, A6, B6, C3, C4, C5, C6, D2, D4, D5, D6
Cần trước bước frontend: không
Mở khóa: X2
Nhánh git: x1-strict-security
Ước lượng: 1 ngày

> ⚡ **Chế độ sprint:** task này **để lại sau hạn nộp**, làm theo chế độ thường (xem [SPRINT_2_NGAY.md](../SPRINT_2_NGAY.md) mục 6).

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
- [x] `grep -rn "orElse(2L)\|orElse(1L)" wpe-backend/src/main` không còn kết quả. — 17/11: không còn kết quả.
- [x] Có test tham số hóa dựa trên bảng ở bước 1: mọi endpoint không công khai, gọi không token → 401. — `SecurityRulesTest` tự quét mọi endpoint: 150 trường hợp, đều 401.
- [x] User thường gọi endpoint admin → 403. — chạy thật (backend profile mặc định và stack Docker): 403 `ACCESS_DENIED`; admin gọi được (200).
- [x] Gọi `?currentUserId=3` hoặc `?userId=3` không còn đóng vai được user 3. — PR #80 bỏ `?currentUserId=`/`?userId=` giả danh; `my-tasks?userId=` giữ lại nhưng người gọi phải đăng nhập và là thành viên (403).
- [x] FE chạy trọn luồng đăng nhập → làm task → nhận realtime ở profile mặc định. — 17/11 trên stack Docker production (nginx + backend không profile dev): đăng nhập, bấm Start Task, trang My Tasks tự cập nhật khi task đổi trạng thái.

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

**Phần A (17/11/2026, làm thay):**
- Đã làm phần 1 (PR #80) và phần 2 (TASK_43):
  1. `application.yml` mặc định an toàn: không còn mật khẩu/bí mật, `debug-user-id-enabled: false` (xóa `default-debug-user-id`), `flyway.out-of-order: false`, `jwt.secret: ${JWT_SECRET}`, thêm `app.cors.allowed-origins: ${APP_CORS_ALLOWED_ORIGINS:}`.
  2. Tạo `application-dev.yml` chỉ dùng trên máy lập trình (`SPRING_PROFILES_ACTIVE=dev`): bật `debug-user-id-enabled: true`, `default-debug-user-id: 2`, `flyway.out-of-order: true`, cấu hình CORS cho localhost:5173, fallback DB/RabbitMQ khớp docker-compose.
  3. Cập nhật `WebCorsConfig` đọc `app.cors.allowed-origins` qua `@Value`: tách theo dấu phẩy, trim, bỏ rỗng; rỗng thì không mapping.
  4. Cài đặt `JsonAuthenticationEntryPoint` (401 trả JSON TOKEN_EXPIRED / UNAUTHORIZED) và `JsonAccessDeniedHandler` (403 trả JSON ACCESS_DENIED) ghi thẳng response bằng ObjectMapper, Content-Type application/json;charset=UTF-8, khắc phục hoàn toàn lỗi 500 khi gọi SSE (`Accept: text/event-stream`) với token sai.
  5. Cài đặt `DevDebugAuthFilter` chỉ thêm khi debug-user-id-enabled=true, chạy sau `JwtAuthFilter`, bỏ qua nếu request có credentials (token sai) hoặc đã xác thực, đặt authentication kèm quyền ROLE_<role>. Header không phải số thì bỏ qua.
  6. Siết chặt `SecurityConfig`: `anyRequest().authenticated()`, cấu hình danh sách permitAll đúng chuẩn, gán EntryPoint và AccessDeniedHandler, bỏ actuator và ghi chú tạm permitAll.
  7. Bổ sung bộ test bảo mật: `SecurityRulesTest` quét tự động > 50 secured endpoints kiểm tra 401 UNAUTHORIZED, kiểm tra đường công khai không trả 401, kiểm tra token sai trả 401 TOKEN_EXPIRED cho cả REST và SSE; `DevDebugAuthFilterTest` kiểm thử đầy đủ các nhánh debug filter; `WebCorsConfigTest` kiểm thử preflight OPTIONS.
- PipelineTemplateController GET còn `getCurrentUserId().orElse(null)`: sau X1 luôn có user vì endpoint đòi đăng nhập.

**C — làm trước phần `NodeController` (12/11/2026, chế độ sprint, nhánh `c-fix-node-auth`).** Lý do làm sớm: khi vẽ C8 thấy Cộng sự gửi `?currentUserId=<id Owner>` là tự duyệt được bài của mình. X1 vẫn để sau hạn nộp; phần C còn lại (`RealtimeController` nhận `?userId=`, `realtime.ts`) chờ A làm SSE nhận token qua query ở bước 2.
- `NodeController`: bỏ `@RequestParam currentUserId` ở `updateStatus`, `submitTask`, `forceUnlock`; người thực hiện lấy từ `currentUserProvider.requireCurrentUserId()` (có gửi token mà token sai → 401 `TOKEN_EXPIRED`, không còn rơi về user 2). `getMyTasks` giữ `?userId=` (bảng Kanban theo phase tải task từng thành viên) nhưng người gọi phải đăng nhập và là thành viên dự án (`verifyProjectMemberOrOwner` → 403).
- **Chưa đóng hết (D thử lại ở #56, 13/11/2026):** chế độ dev đang bật (`app.security.debug-user-id-enabled: true`, `default-debug-user-id: 2`), nên request **không gửi header nào** vẫn được coi là user 2 (alex, Owner): D không gửi header mà vẫn mở khóa được WPE-004 (đã trả dữ liệu về LOCKED v0). Tắt chế độ dev là việc của A ở bước 2, **bắt buộc làm trước khi nộp hoặc deploy**.
- Header `X-Debug-User-Id` của chế độ dev vẫn dùng được như cũ (thay cho `?currentUserId=` khi thử bằng Swagger).
- Test: `NodeControllerTest` thêm 9 test (giả danh qua `?currentUserId=1`, token rác → 401, không phải thành viên → 403, xem task đồng đội được); trước khi sửa đỏ cả 9. Sau khi sửa toàn bộ backend: `Tests run=434, Failures=0, Errors=0, Skipped=1`.
- Chạy thật trên dữ liệu seed:
```
1) sarah force-unlock WPE-004 kèm ?currentUserId=2 (giả alex) -> HTTP 403 | "error":"ACCESS_DENIED"
2) token rác force-unlock -> HTTP 401 | "error":"TOKEN_EXPIRED"
3) token rác PATCH status DONE kèm ?currentUserId=2 -> HTTP 401 | "error":"TOKEN_EXPIRED"
4) admin (không phải thành viên) xem my-tasks dự án 1 -> HTTP 403 | "error":"ACCESS_DENIED"
5) sarah xem my-tasks dự án 1 -> HTTP 200
```
  Dữ liệu không đổi (WPE-004 vẫn LOCKED v0).

### Kết quả test (dán output thật)
**Backend (16/11/2026, sau TASK_43):** `./mvnw test` → 827 test, 0 lỗi (trong đó `SecurityRulesTest` 150, `DevDebugAuthFilterTest` 8, `WebCorsConfigTest` 2). CI PR #81 xanh.

**Chạy thật backend, profile mặc định (16/11/2026):** 17/17 kịch bản đúng. Thiếu biến môi trường thì backend dừng ngay (`DB_URL`). Profile dev: không token vẫn là user 2; header debug đọc đúng vai trò (admin 200, user 403); token rác vẫn 401.

**Stack Docker production (17/11/2026, `docker-compose.prod.yml`, chỉ nginx mở cổng):** backend log `No active profile set, falling back to 1 default profile: "default"`. Gọi qua nginx:
```
1. Trang chu (nginx tra index.html)            -> 200
2. Duong SPA khong co file -> index.html       -> 200
4. Health cong khai                            -> 200
5. Khong token GET graph                       -> 401 UNAUTHORIZED
6. Chi header X-Debug-User-Id                  -> 401 UNAUTHORIZED
7. Token rac                                   -> 401 TOKEN_EXPIRED
8. Swagger khong mo ra ngoai qua nginx         -> dung
9. Alex dang nhap that GET graph               -> 200
10. SSE qua nginx; Sarah doi WPE-002; Alex nhan TASK_STATUS_CHANGED -> dung
11. Bam AI (Python trong Docker)               -> 200 AI_SERVICE; bam lai -> 429 COOLDOWN_ACTIVE
13. User thuong goi API admin                  -> 403 ACCESS_DENIED
14. Admin goi API admin                        -> 200
15. Gui X-Forwarded-For gia 1.2.3.4            -> nhat ky ghi IP that, khong ghi IP gia
16. Lam moi token                              -> 200
```
Trình duyệt (Sarah, profile mặc định): đăng nhập → mở dự án → Kanban → Start Task (`PATCH /nodes/2/status` 200) → đổi trạng thái WPE-002 từ nơi khác → trang My Tasks tự tải lại, task sang cột In Progress không cần tải lại trang. Console không có lỗi.

### Điều chưa chắc / cần nhóm quyết
- Bảng Kanban trong trang Workflow (ngăn phase) không nghe realtime; chỉ trang My Tasks và chuông thông báo tự cập nhật. Cần B/C quyết có nối thêm không. — Đã làm 17/11/2026 (nhóm thống nhất nối realtime): Kanban trang Workflow tự cập nhật, đã kiểm trên trình duyệt.
- Bước 4 (B, D tự rà các controller khác của mảng mình) chưa có ghi chép trong file này.
- Trạng thái để "chờ kiểm" để nhóm duyệt; người làm không tự ghi "xong".

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**
