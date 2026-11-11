# A2 — Nền HTTP frontend: apiClient, bỏ fallback ngầm, tách HttpWorkflowService

Người làm: A
Người review: B
Trạng thái: chưa làm
Cần có trước: T0
Cần trước bước frontend: không
Mở khóa: A4, A5, A6, B5, C3, C4, C6, D4 (và bước frontend của D1, D5)
Nhánh git: a2-api-client
Ước lượng: 1–1,5 ngày — **nên xong trong 2 ngày đầu**, vì 8 task khác cần nó

> ⚡ **Chế độ sprint:** Claude làm hết các bước, kể cả 🧠; bỏ qua Bước 0 và mục "Dành cho Claude". Luồng làm: [SPRINT_2_NGAY.md](../SPRINT_2_NGAY.md) mục 2–3.
> - **Claude tự chạy bằng dòng lệnh:** `npm run typecheck && npm test`, các lệnh `grep` trong tiêu chí xong.
> - **Dời về buổi kiểm chung (mục 7):** tắt backend, mở giao diện ở chế độ API thật → phải báo lỗi (bảng 7.2 dòng 1).
> - **Không làm trong sprint:** bước 5 (tách file `HttpWorkflowService`), ảnh chụp màn hình.

## Vì sao cần task này
- `FE/services/impl/HttpWorkflowService.ts` (957 dòng sau lần pull 11/11/2026, khoảng 48 chỗ `super.…`/fallback, gồm cả phần đồ thị và xuất bản mới thêm) **kế thừa** `MockWorkflowService`, và khi backend lỗi thì tự chuyển sang dữ liệu giả. Vì vậy khi test với backend thật, lỗi bị che mất.
- Base URL không thống nhất: `.env.example` ghi `http://localhost:8080/api`, code mặc định `/api/v1`. Sau lần pull 11/11/2026 backend đã nhận cả `/api` lẫn `/api/v1` nên không còn gọi hỏng, nhưng vẫn cần chốt một chuẩn (`/api/v1`).
- `VITE_USE_MOCK` đang được hiểu theo 3 cách: `FE/services/container.ts` dùng `!== 'false'`, `FE/App.tsx` dùng `=== 'true'`, `FE/components/dev/DevToolbar.tsx` dùng `!== 'true'`.
- Test `FE/components/workspace/__tests__/WorkflowArtifacts.test.tsx` đang lỗi. Log cho thấy test chạy qua `HttpWorkflowService` ("Failed to parse URL from /api/v1/…"), nên nghi là test bị ảnh hưởng bởi file env trên máy. Test phải luôn chạy chế độ mock.
- Cả 4 người sẽ phải sửa file này, nên phải tách theo mảng **trước khi** ai bắt đầu.

## Kiến thức phải nắm
fetch API, CORS, biến môi trường Vite (`import.meta.env`, thứ tự nạp `.env`/`.env.local`), DI container, composition và inheritance, chuẩn lỗi JSON (Chương III của integration map), mock `fetch` trong vitest.

## Bước 0 — Tự đọc, không dùng AI
Đọc: Chương I và Chương III của `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md`; `FE/services/container.ts`; `FE/services/contracts/IWorkflowService.ts`; lướt cấu trúc `FE/services/impl/HttpWorkflowService.ts` và đếm số chỗ có chữ "mock fallback".
Trả lời:
1. Viết bằng chữ đường đi của lời gọi `getMyTasks` từ component tới backend. Ở chế độ mock thì nó dừng ở đâu?
2. Vì sao "tự chuyển sang mock khi lỗi" nguy hiểm khi test tích hợp? Cho 1 ví dụ lỗi bị che.
3. `HttpWorkflowService extends MockWorkflowService` có đúng nghĩa "là một" (is-a) không? Nếu đổi sang composition thì code trông thế nào?

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `FE/**`, `wpe-frontend/vite.config.ts`, `wpe-frontend/.env.example`
- `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md`

## Được ghi
- `FE/services/http/**` (mới: `apiClient.ts`, `ApiError.ts`, test)
- `FE/services/impl/**` (tách file, giữ hành vi)
- `FE/services/env.ts` (mới)
- `FE/services/container.ts`
- `FE/App.tsx`, `FE/components/dev/DevToolbar.tsx` (chỉ dòng đọc `VITE_USE_MOCK`)
- `wpe-frontend/vite.config.ts` (chỉ phần `test`)
- `wpe-frontend/.env.example`
- `FE/components/workspace/__tests__/WorkflowArtifacts.test.tsx` (chỉ khi cần)
- `docs/tasks/A-tai-khoan/A2-nen-http-frontend.md`

## Đặc tả đã chốt
1. `FE/services/env.ts`: `export const isMockMode = import.meta.env.VITE_USE_MOCK !== 'false'`, tức mặc định là mock. `container.ts`, `App.tsx` và `DevToolbar.tsx` đều dùng biến này.
2. `FE/services/http/apiClient.ts`:
   - `API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api/v1'`. Sửa `.env.example` thành `VITE_API_BASE_URL=http://localhost:8080/api/v1`.
   - `apiRequest<T>(method, path, options?: { body?, query?, headers?, signal? }): Promise<T>`. Response 204 trả `undefined`.
   - Header: có token (key `wpe_auth_token` trong `localStorage` hoặc `sessionStorage`) thì gửi `Authorization: Bearer …`. Không có token mà đang dev (`import.meta.env.DEV`) thì gửi `X-Debug-User-Id` lấy từ `id` trong `wpe_auth_user`, nếu có.
   - Lỗi HTTP thì ném `ApiError` (`FE/services/http/ApiError.ts`) gồm `status`, `code` (trường `error` của body), `message`, `validationErrors?`, `retryAfterSeconds?`, `cycleNodes?`. Lỗi mạng thì `status = 0`, `code = 'NETWORK_ERROR'`.
   - Có `setUnauthorizedHandler(fn)` để A4 gắn phần tự refresh token.
3. **Không còn fallback ngầm.** Phương thức đã có endpoint thật mà lỗi thì ném `ApiError`. Phương thức chưa có backend thì gọi mock **một cách tường minh**, và tên nó nằm trong hằng `METHODS_STILL_MOCKED`, comment ghi mã task sẽ làm (ví dụ `getMacroPhases // B5`).
4. Tách theo mảng vào `FE/services/impl/http/`: `tasks.ts`, `artifacts.ts`, `realtime.ts` (của C); `workspace.ts`, `invitations.ts` (của D); `graph.ts` (của B: chuyển nguyên các hàm đồ thị và `publishPipeline` đang có vào đây, giữ hành vi, chỉ bỏ fallback); `auth.ts` (của A, chỉ để khung). `HttpWorkflowService` chuyển sang `implements IWorkflowService` và giữ một `private readonly mock = new MockWorkflowService()` cho các phương thức chưa có backend (composition thay cho kế thừa). Endpoint đang gọi thật giữ nguyên URL và body.
5. Test luôn chạy mock: đặt `test.env.VITE_USE_MOCK = 'true'` trong `vite.config.ts`, để test không phụ thuộc `.env.local` của từng máy. Không đọc nội dung `.env.local`.
6. Test cho `apiClient`: gửi Bearer, gửi `X-Debug-User-Id`, đọc lỗi 409/422/429, xử lý 204, lỗi mạng (mock `fetch` bằng `vi.fn`).

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 Lập danh sách vào ghi chép: phương thức nào của `HttpWorkflowService` đang gọi API thật (tên phương thức → method + URL). Đây là danh sách phải giữ nguyên hành vi.
3. 🤝 Tạo `env.ts` và sửa 3 chỗ đọc `VITE_USE_MOCK`.
4. 🤝 `ApiError.ts`, `apiClient.ts` và test.
5. 🤝 Tách `HttpWorkflowService` theo mảng, đổi sang composition. Tách xong mỗi file thì chạy `npm run typecheck`.
6. 🤝 Cấu hình test chạy mock rồi chạy `npm test`. Nếu `WorkflowArtifacts.test.tsx` vẫn lỗi: 🧠 tự đọc lỗi, ghi nguyên nhân trước, rồi mới nhờ sửa.
7. 🧠 Chạy app với backend thật (tự đặt `VITE_USE_MOCK=false` trong `.env.local` của bạn, không commit). Tắt backend đi: màn hình phải báo lỗi chứ không hiện dữ liệu giả. Chụp màn hình dán vào ghi chép.
8. Nhắn nhóm danh sách file mới theo mảng. Từ giờ B, C, D chỉ sửa file của mình.

## Tiêu chí xong
- [ ] `cd wpe-frontend && npm run typecheck && npm test` không còn test lỗi (dán dòng tổng kết thật).
- [ ] `grep -rn "mock fallback" wpe-frontend/src/services` không còn kết quả.
- [ ] Có ít nhất 6 test cho `apiClient` như đặc tả mục 6.
- [ ] `METHODS_STILL_MOCKED` có trong code, mỗi dòng ghi mã task sẽ làm.
- [ ] Tắt backend, bật chế độ API thật thì UI hiện lỗi (ảnh trong ghi chép).

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. Khi nào gửi `Authorization`, khi nào gửi `X-Debug-User-Id`? Sau X1 thì còn cái nào?
2. Vì sao test phải luôn chạy mock và không phụ thuộc `.env.local`?
3. Composition ở đây hơn kế thừa ở chỗ nào? Nêu 1 nguyên tắc SOLID liên quan.

## Cấm
- Sửa file ngoài mục "Được ghi". File dùng chung thì báo nhóm trước (README mục 6).
- Đọc, in, commit `.env*`, khóa, mật khẩu thật, API key. Dùng `git add -f`.
- Đổi hành vi (URL, body) của các endpoint đang gọi thật trong lúc tách file.
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
