# A2 — Nền HTTP frontend: apiClient, bỏ fallback ngầm, tách HttpWorkflowService

Người làm: A
Người review: B
Trạng thái: chờ kiểm
Vòng hiểu: chưa làm (A vắng, làm bù khi A quay lại).
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
> Claude ghi (chế độ sprint, A vắng). Theo SPRINT_2_NGAY.md mục 6: **chưa tách file** `HttpWorkflowService` vào `impl/http/` (phần tách file của bước 5 dời sau hạn nộp). Phần "bỏ fallback ngầm" vẫn làm đủ, kể cả đổi sang composition (`implements IWorkflowService` + `private readonly mock`) ngay trong 1 file, vì còn `extends MockWorkflowService` thì mọi phương thức không override vẫn ngầm chạy mock.

- `FE/services/env.ts` (mới): `isMockMode = import.meta.env.VITE_USE_MOCK !== 'false'` (mặc định mock). `container.ts`, `App.tsx`, `DevToolbar.tsx` đều dùng biến này (trước đó 3 chỗ hiểu 3 kiểu: `!== 'false'`, `=== 'true'`, `!== 'true'`). Hệ quả: không đặt `VITE_USE_MOCK` thì DevToolbar giờ hiện (vì mặc định là mock); trước đây phải đặt đúng `'true'`.
- `FE/services/http/ApiError.ts` (mới): `ApiError extends Error` gồm `status`, `code` (trường `error` của body; không có thì `HTTP_<status>`), `message`, `validationErrors?`, `retryAfterSeconds?`, `cycleNodes?`, getter `isNetworkError`; hàm `isApiError()`. Khớp `ErrorResponse.java` của backend.
- `FE/services/http/apiClient.ts` (mới): `API_BASE_URL` (mặc định `http://localhost:8080/api/v1`), `apiRequest<T>(method, path, { body?, query?, headers?, signal? })`. Gửi `Authorization: Bearer` khi có `wpe_auth_token` (localStorage rồi sessionStorage); không có token mà `import.meta.env.DEV` thì gửi `X-Debug-User-Id` = `id` của `wpe_auth_user`. 204/body rỗng trả `undefined`. Lỗi HTTP ném `ApiError`; lỗi mạng ném `ApiError(status 0, NETWORK_ERROR)`; request bị hủy (AbortError) ném nguyên lỗi gốc. `retryAfterSeconds` lấy từ body, không có thì từ header `Retry-After`. `setUnauthorizedHandler(fn)`: khi request **có gửi token** bị 401, gọi `fn({ error, method, path })`; `fn` trả `true` thì gửi lại request gốc đúng 1 lần (đọc token mới), trả `false`/ném lỗi thì ném `ApiError` 401.
- `FE/services/impl/HttpWorkflowService.ts`: bỏ `extends MockWorkflowService`, chuyển sang `implements IWorkflowService` + `private readonly mock = new MockWorkflowService()`. Mọi phương thức đang gọi API thật chuyển sang `apiRequest`, bỏ toàn bộ `try/catch → super.…` (không còn chữ "mock fallback"). Giữ nguyên URL, method và body. Các phương thức chưa có backend gọi `this.mock.…` tường minh và nằm trong hằng `METHODS_STILL_MOCKED` (mỗi dòng có mã task). Các hàm dev (`resetMockData`, `setMockLatency`, `setMockError`, `setMockCycleError`, `setProjectStatus`) không còn trên `HttpWorkflowService` (optional trong interface; `devSlice` đã kiểm `if` trước khi gọi; DevToolbar chỉ hiện ở chế độ mock).
- Danh sách phương thức gọi API thật (giữ nguyên hành vi; URL tính sau base `/api/v1`):

  | Phương thức | Method + URL |
  | :--- | :--- |
  | getMyTasks | GET `/projects/{pid}/my-tasks?userId=` |
  | updateTaskStatus | PATCH `/nodes/{id}/status` |
  | submitTaskArtifact | POST `/nodes/{id}/submit` |
  | getProjectArtifacts | GET `/projects/{pid}/artifacts?inRepo=true` |
  | createArtifact | POST `/projects/{pid}/artifacts` |
  | deleteArtifact | DELETE `/projects/{pid}/artifacts/{id}` (404 coi như đã xóa) |
  | connectRealtime | SSE GET `/realtime/subscribe?userId=` |
  | getMyProjects, getProjectsList | GET `/projects` |
  | createProject | POST `/projects` |
  | cloneTemplate | POST `/projects/clone-template` |
  | updateProjectStatus | PATCH `/projects/{id}/status` |
  | getInvitationDetail, getInvitation | GET `/invitations/{id}` (404 trả null) |
  | acceptInvitation | POST `/invitations/{id}/accept` |
  | rejectInvitation | POST `/invitations/{id}/reject` |
  | getMacroPhases, getPhaseEdges, getPhaseGraph | GET `/projects/{pid}/graph` |
  | createPhase | POST `/projects/{pid}/phases` |
  | connectPhases | POST `/projects/{pid}/phases/connect?sourcePhaseId=&targetPhaseId=` |
  | disconnectPhases | POST `/projects/{pid}/phases/disconnect?sourcePhaseId=&targetPhaseId=` |
  | deletePhase | DELETE `/projects/{pid}/phases/{id}` (404 coi như đã xóa) |
  | publishPipeline | POST `/projects/{pid}/publish` (422 trả `{ success: false, cycleDetected: true, violatingNodeIds: cycleNodes }`) |

- Các chỗ trước đây lấy dữ liệu giả **dù backend trả 200** cũng bỏ: `getMacroPhases` khi dự án chưa có phase giờ trả `[]`; `getPhaseEdges` không có `phaseEdges` trả `[]`; `getPhaseGraph` không tìm thấy phase ném `ApiError(404, RESOURCE_NOT_FOUND)` (lỗi tính ở FE).
- `wpe-frontend/vite.config.ts`: thêm `test.env.VITE_USE_MOCK = 'true'` để test luôn chạy mock, không phụ thuộc `.env.local` hay biến môi trường của máy.
- `wpe-frontend/.env.example`: `VITE_API_BASE_URL=http://localhost:8080/api/v1`.
- Test mới: `FE/services/http/__tests__/apiClient.test.ts` (15 test), `FE/services/impl/__tests__/HttpWorkflowService.test.ts` (7 test).
- `WorkflowArtifacts.test.tsx`: không sửa. Nguyên nhân lỗi: máy có `VITE_USE_MOCK=false` (trong `.env.local` hoặc biến môi trường) thì `container.ts` tạo `HttpWorkflowService`, test gọi `fetch('/api/v1/…')` trong jsdom (URL tương đối không parse được) → rơi về mock và màn hình không ra trạng thái test chờ. Đặt `test.env` trong `vite.config.ts` là đủ (đã tái hiện và kiểm, xem Kết quả test).

### Kết quả test (dán output thật, không chép tay)
> Máy chạy Node v26.13.0. Node 25+ có `localStorage` riêng che jsdom, nên mọi lệnh test chạy kèm `NODE_OPTIONS=--no-webstorage` (không sửa cấu hình vitest/vite cho chuyện này). Output đã lọc mã màu và lọc dòng bằng `grep`; tên test dài được rút gọn bằng `...` ở phần tiền tố, kết quả giữ nguyên.

**1. Tái hiện lỗi TRƯỚC khi sửa** (test mới viết, code cũ):

`NODE_OPTIONS=--no-webstorage npx vitest run src/services/impl --reporter=verbose`
```
 × ... > getMyTasks: mất kết nối backend thì ném lỗi NETWORK_ERROR, không trả dữ liệu giả
 × ... > getMyProjects: backend trả 500 thì ném lỗi kèm mã lỗi của body, không trả dữ liệu giả
 × ... > getMacroPhases: backend trả 403 thì ném lỗi, không trả đồ thị giả
 × ... > submitTaskArtifact: backend trả 409 thì ném lỗi, không giả vờ nộp thành công
 × ... > gọi đúng base URL chuẩn http://localhost:8080/api/v1 khi không đặt VITE_API_BASE_URL
 ✓ ... > publishPipeline: 422 vẫn trả kết quả chu trình (hành vi cũ giữ nguyên)
 × ... > publishPipeline: mất kết nối thì ném lỗi, không giả vờ xuất bản thành công
 Test Files  1 failed (1)
      Tests  6 failed | 1 passed (7)
```
Thông báo lỗi tiêu biểu: `AssertionError: promise resolved "[ { id: 's01', …(12) }, …(16) ]" instead of rejecting` (getMyTasks trả 17 task giả khi mất mạng); `promise resolved "{ success: true, newStatus: 'ACTIVE' }" instead of rejecting` (publishPipeline giả vờ xuất bản thành công khi mất mạng); `expected '/api/v1/projects/1/my-tasks?userId=2' to be 'http://localhost:8080/api/v1/projects…'`.

`VITE_USE_MOCK=false NODE_OPTIONS=--no-webstorage npx vitest run src/components/workspace/__tests__/WorkflowArtifacts.test.tsx` (giả lập máy đặt API thật, chưa có `test.env`):
```
   × Workflow Artifacts Island & Drawer UI Components > renders friendly Empty State when no artifacts are present 1014ms
 FAIL  src/components/workspace/__tests__/WorkflowArtifacts.test.tsx > Workflow Artifacts Island & Drawer UI Components > renders friendly Empty State when no artifacts are present
 Test Files  1 failed (1)
      Tests  1 failed | 8 passed (9)
```
Sau khi thêm `test.env`, cùng lệnh: `Test Files  1 passed (1)`, `Tests  9 passed (9)`.
(Trên worktree sạch không có `.env.local`, trước khi sửa toàn bộ là `Test Files 25 passed (25)`, `Tests 151 passed (151)`.)

**2. SAU khi sửa:**

`npm run typecheck` → `tsc -b` không báo lỗi.

`NODE_OPTIONS=--no-webstorage npm test`
```
 Test Files  27 passed (27)
      Tests  173 passed (173)
```
`VITE_USE_MOCK=false NODE_OPTIONS=--no-webstorage npx vitest run` (chứng minh test không phụ thuộc env của máy)
```
 Test Files  27 passed (27)
      Tests  173 passed (173)
```
Riêng 2 file test mới (`npx vitest run src/services/impl src/services/http --reporter=verbose`):
```
 ✓ apiClient > base URL mặc định là http://localhost:8080/api/v1 và nối query đúng
 ✓ apiClient > có token thì gửi Authorization: Bearer và không gửi X-Debug-User-Id
 ✓ apiClient > token nằm trong sessionStorage cũng được gửi
 ✓ apiClient > không có token mà đang dev thì gửi X-Debug-User-Id lấy từ wpe_auth_user
 ✓ apiClient > không có token, không có user thì không gửi header danh tính nào
 ✓ apiClient > gửi body dạng JSON kèm Content-Type
 ✓ apiClient > 409: ném ApiError với status, code (trường error), message, validationErrors
 ✓ apiClient > 422: ném ApiError kèm cycleNodes
 ✓ apiClient > 429: ném ApiError kèm retryAfterSeconds (từ body, hoặc từ header Retry-After)
 ✓ apiClient > lỗi không có body JSON: code = HTTP_<status>, có message mặc định
 ✓ apiClient > 204: trả undefined
 ✓ apiClient > lỗi mạng: ném ApiError status 0, code NETWORK_ERROR
 ✓ apiClient > 401 có token: gọi unauthorized handler; handler trả true thì gửi lại đúng 1 lần với token mới
 ✓ apiClient > 401 có token: handler trả false thì ném ApiError 401, không gửi lại
 ✓ apiClient > 401 khi không gửi token: không gọi handler
 ✓ ... > getMyTasks: mất kết nối backend thì ném lỗi NETWORK_ERROR, không trả dữ liệu giả
 ✓ ... > getMyProjects: backend trả 500 thì ném lỗi kèm mã lỗi của body, không trả dữ liệu giả
 ✓ ... > getMacroPhases: backend trả 403 thì ném lỗi, không trả đồ thị giả
 ✓ ... > submitTaskArtifact: backend trả 409 thì ném lỗi, không giả vờ nộp thành công
 ✓ ... > gọi đúng base URL chuẩn http://localhost:8080/api/v1 khi không đặt VITE_API_BASE_URL
 ✓ ... > publishPipeline: 422 vẫn trả kết quả chu trình (hành vi cũ giữ nguyên)
 ✓ ... > publishPipeline: mất kết nối thì ném lỗi, không giả vờ xuất bản thành công
 Test Files  2 passed (2)
      Tests  22 passed (22)
```
`grep -rn "mock fallback" wpe-frontend/src/services` → không có kết quả (exit 1).

**Chưa chạy:** bước 7 (tắt backend, mở giao diện ở chế độ API thật, chụp màn hình) cần trình duyệt → dời về buổi kiểm chung (SPRINT_2_NGAY.md bảng 7.2 dòng 1).

### Điều chưa chắc / cần nhóm quyết
1. **Chưa tách file** theo mảng (`impl/http/tasks.ts`, `graph.ts`, …) theo SPRINT_2_NGAY.md mục 6. Phần tách file của đặc tả mục 4 còn nợ; composition đã làm trong 1 file. Trong lúc chờ, B/C/D sửa `HttpWorkflowService.ts` thì chỉ sửa phương thức của mảng mình (tasks/README.md, bảng file dùng chung).
2. **Mã task trong `METHODS_STILL_MOCKED` do Claude gán theo tiêu đề task**, cần nhóm xác nhận: auth → A4; `updatePhasePosition` → B5 (sau B2); overview/guest/feedback → D5 (AI: D6); `getProjectMembers` → C6; archive/restore/delete dự án → D1; thành viên và lời mời (tạo, danh sách chờ, thu hồi) → D2. `getProjectSettings`, `updateProjectSettings`, `getProjectAuditLogs` **không thấy task nào nhận** → ghi "chưa có task", nhóm cần chọn người.
3. Base URL mặc định đổi từ `/api/v1` (tương đối, đi qua proxy Vite) sang `http://localhost:8080/api/v1` (tuyệt đối, gọi thẳng backend) theo đặc tả. `WebCorsConfig` của backend đã cho phép `http://localhost:5173` và `http://127.0.0.1:5173`; mở FE ở cổng khác (ví dụ `npm run preview`, cổng 4173) sẽ bị CORS chặn. Proxy `/api/v1` trong `vite.config.ts` giữ nguyên nhưng mặc định không còn dùng.
4. `FE/services/template/HttpTemplateService.ts` vẫn tự đọc `VITE_API_BASE_URL || '/api/v1'` và có fallback riêng: file này **không** nằm trong "Được ghi" nên không sửa. Đề nghị D4 chuyển sang `apiClient`.
5. Header `X-Debug-User-Id` là hành vi **mới** (code cũ không gửi). Backend chỉ đọc khi bật chế độ debug; sau X1 nên bỏ nhánh này.
6. Backend trả lỗi không có `message` thì câu báo lỗi giờ là câu chung `Yêu cầu thất bại (HTTP xxx)` thay cho câu riêng từng hàm (ví dụ "Cập nhật trạng thái thất bại"). UI đang hiện `err.message` vẫn chạy; C6/D1 muốn câu riêng thì bắt theo `ApiError.code`.
7. `getPhaseGraph` không tìm thấy phase thì ném `ApiError(404, RESOURCE_NOT_FOUND)` do FE tự tạo (backend trả 200). B5 xem lại có muốn xử lý khác không.
8. `vite.config.ts` dùng `defineConfig` của `vite` nên khóa `test` không có kiểu (tsc không kiểm file này vì `tsconfig` chỉ `include: ["src"]`; vitest vẫn đọc đúng, đã kiểm bằng lệnh `VITE_USE_MOCK=false`). Muốn có kiểu thì thêm `/// <reference types="vitest" />` ở đầu file (ngoài phần `test`, nên chưa làm).
9. Luật chung số 7 yêu cầu cập nhật `.kb/TIEN_DO.md`, nhưng worktree không có thư mục `.kb/` → không cập nhật.

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**
