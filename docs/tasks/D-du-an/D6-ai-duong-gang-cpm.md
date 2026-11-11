# D6 — Chẩn đoán AI: đường găng CPM thật, phát hiện task ngâm, Gemini tùy chọn (Cụm 9)

Người làm: D
Người review: A
Trạng thái: chờ kiểm
Cần có trước: B1
Cần trước bước frontend: không
Mở khóa: X1
Nhánh git: d6-ai-cpm
Ước lượng: 1,5–2 ngày

> ⚡ **Chế độ sprint:** task này **để lại sau hạn nộp**, làm theo chế độ thường (xem [SPRINT_2_NGAY.md](../SPRINT_2_NGAY.md) mục 6).

## Vì sao cần task này
`BE/service/ai/AiServiceClientImpl.java` hiện chỉ là heuristic đơn giản: `criticalPath` liệt kê mọi node, và mọi node IN_PROGRESS đều bị coi là điểm nghẽn. Đặc tả `docs/specs/ai-diagnostics.md` yêu cầu tính CPM (forward pass theo `estimated_hours`) và phát hiện node ngâm (quá 2,5 × `estimated_hours`). Endpoint AI cũng chưa chắc đã kiểm quyền thành viên.

## Kiến thức phải nắm
CPM: ES, EF, LS, LF, slack; thứ tự topo (dùng lại B1); mẫu Strategy (`AiServiceClient` có nhiều cài đặt); gọi HTTP API bên ngoài bằng `RestClient` và đặt timeout; giữ bí mật qua biến môi trường.

## Bước 0 — Tự đọc, không dùng AI
Đọc: toàn bộ `docs/specs/ai-diagnostics.md`; integration map Cụm 9; `BE/controller/AiDiagnosticController.java`, `BE/service/ai/AiDiagnosticService.java`, `AiServiceClient.java`, `AiServiceClientImpl.java`, `BE-test/service/ai/AiDiagnosticServiceTest.java`; `V3__add_node_ai_time_columns.sql`; `FE/components/overview/**`, `FE/components/popovers/AiDiagnosisPopover.tsx`.
Trả lời:
1. 🧠 Tính tay CPM cho đồ thị A(8h)→B(4h), A→C(10h), B→D(2h), C→D(3h): ES, EF, LS, LF, slack của từng node. Đường găng là gì?
2. Vì sao phải có thứ tự topo trước khi chạy forward pass?
3. API key Gemini nên để ở đâu cho an toàn? Lỡ commit lên git thì phải làm gì?

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `wpe-backend/src/**`, `FE/**`, `docs/**`

## Được ghi
- `BE/service/ai/**`, `BE/controller/AiDiagnosticController.java`, `BE/dto/response/ai/**`
- `wpe-backend/src/main/resources/application.yml` (chỉ mục `app.ai`, báo A)
- `BE-test/service/ai/**`, `BE-test/controller/AiDiagnosticControllerTest.java`
- `FE/components/overview/**` (phần AI), `FE/components/popovers/AiDiagnosisPopover.tsx`, `FE/services/impl/http/ai.ts` (mới)
- `docs/specs/ai-diagnostics.md`, `docs/tasks/D-du-an/D6-ai-duong-gang-cpm.md`

## Đặc tả đã chốt
- Tách lớp `CpmCalculator` thành hàm thuần, dùng `KahnDagService.validateProjectDag(...).sortedOrder()` (trường `sortedOrder` do B1 thêm):
  - forward pass và backward pass; `slack = LS − ES`; node có slack 0 nằm trên đường găng.
  - Đồ thị có chu trình thì không tính CPM, trả cảnh báo.
- Phát hiện node ngâm: node `IN_PROGRESS` có `now − started_at > 2,5 × estimated_hours`. Viết thành hàm thuần nhận tham số `Instant now`. **Không tạo bean `Clock` mới** (C5 tạo `ClockConfig`). Service truyền thời điểm hiện tại vào.
- Tách cài đặt:
  - `HeuristicAiClient`: tách từ code hiện có, dùng CPM thật.
  - `GeminiAiClient` (mới, tùy chọn): chỉ bật khi có biến môi trường `GEMINI_API_KEY`. Timeout 15 giây. Lỗi hoặc quá giờ thì quay về heuristic và ghi `source: "HEURISTIC_FALLBACK"`.
  - Kết quả luôn đúng schema `AiAnalysisResult` trong `ai-diagnostics.md`.
  - Model: `ai-diagnostics.md` đang ghi `gemini-1.5-flash`. Kiểm tra model đó còn được hỗ trợ không trước khi dùng, và ghi lại model đã chọn.
- Endpoint AI: chỉ thành viên dự án được xem và kích hoạt, không phải thành viên → 403.
- Không commit key. Ghi hướng dẫn đặt `GEMINI_API_KEY` vào `ai-diagnostics.md`.

## Việc cần làm
1. 🧠 Bước 0 (tính tay CPM).
2. 🧠 **Tự code** `CpmCalculator` và test bằng chính số liệu ở Bước 0. Claude chỉ review.
3. 🤝 Hàm phát hiện node ngâm, `HeuristicAiClient`, kèm test.
4. 🤝 `GeminiAiClient` (tùy chọn), test bằng HTTP giả lập.
5. 🤝 Nối FE vào API thật.

## Tiêu chí xong
- [ ] Test CPM cho ra đúng số tính tay.
- [ ] Dự án seed: `criticalPath` đúng theo `estimated_hours` (ghi kết quả thật).
- [ ] Không có `GEMINI_API_KEY` thì app vẫn chạy bằng heuristic.
- [ ] Cooldown 429 vẫn hoạt động.
- [ ] `git grep -n "AIza"` không ra kết quả (không có key Google nào trong repo).

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. Slack nghĩa là gì với người quản lý dự án? Node có slack 0 có ý nghĩa gì?
2. Mẫu Strategy nằm ở đâu trong code của bạn? Thêm một nhà cung cấp AI khác thì sửa những gì?
3. Vì sao kết quả AI được cache vào cột JSONB thay vì gọi lại mỗi lần mở trang?

## Cấm
- Sửa file ngoài mục "Được ghi". File dùng chung thì báo nhóm trước (README mục 6).
- Đọc, in, commit `.env*`, khóa, mật khẩu thật, API key. Dùng `git add -f`.
- Tạo bean `Clock` thứ hai. Sửa `KahnDagService` (của B).
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
Sprint 12/11/2026 (Antigravity viết code, Claude kiểm). Phạm vi: CPM thật, node ngâm, tách `HeuristicAiClient`. **Chưa làm**: `GeminiAiClient`, phần frontend (bước 4, 5).

**Trước khi sửa** (code `main`, backend local):
- Dự án 1 (chuỗi WPE-001→002→003→004): `criticalPath` = `['WPE-001','WPE-004','WPE-002','WPE-003']` (sai thứ tự, chỉ liệt kê mọi node), WPE-002 bị coi là điểm nghẽn HIGH chỉ vì đang IN_PROGRESS.
- Dự án 5 (clone `tpl-sdlc`, 7 node 8h, cạnh 001→002, 003→004, 005→006): `criticalPath` = cả 7 node, kể cả WPE-007 đứng riêng.

**Sau khi sửa:** `mvn -B clean test`
```
[INFO] Tests run: 173, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```
`CpmCalculatorTest` dùng đúng số tính tay A(8)→B(4), A→C(10), B→D(2), C→D(3): A(0,8,0,8,0), B(8,12,14,18,6), C(8,18,8,18,0), D(18,21,18,21,0), đường găng A-C-D, tổng 21h.

Chạy thật:
- Dự án 5: `criticalPath` = WPE-001..006, `projectDurationHours` 16, WPE-007 slack 8 không còn trên đường găng; `source` = HEURISTIC.
- Dự án 1, đặt `started_at` WPE-002 = 25 giờ trước (ước lượng 8h, ngưỡng 20h): `criticalPath` = WPE-001→004 đúng thứ tự topo, `stalledCount` 1, WPE-002 HIGH (ngâm + nằm trên đường găng). Đã trả `started_at` về NULL như seed.
- Bấm lại ngay → 429 `COOLDOWN_ACTIVE`, `retryAfterSeconds` 180.
- Không phải thành viên GET `ai-analysis` / POST `ai-diagnostics` → 403 `ACCESS_DENIED`.
- `git grep -n "AIza"` chỉ ra dòng tiêu chí trong chính file task này, không có key.

### Điều chưa chắc / cần nhóm quyết
- Output AI giữ nguyên các key cũ (`criticalPath`, `bottlenecks`...) để frontend không vỡ, thêm `source`, `cpm`, `metrics.projectDurationHours`, `metrics.stalledCount`. Chưa chuyển sang đúng schema `AiAnalysisResult` trong `ai-diagnostics.md`.
- Ngưỡng ngâm dùng `>` 2,5 × ước lượng theo đặc tả task; `ai-diagnostics.md` ghi `≥`. Nhóm thống nhất một bên.
- `GeminiAiClient` chưa làm (cần kiểm model còn hỗ trợ và cần key, không làm được trong đêm).
- Phát hiện phụ: gọi sai method HTTP (GET vào endpoint chỉ có POST) trả 500 thay vì 405, vì `GlobalExceptionHandler` bắt mọi `Exception` thành 500. Thuộc file dùng chung, báo A.

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:** Tính đường găng CPM thật (forward/backward pass, slack) theo thứ tự topo của `KahnDagService`, phát hiện node ngâm quá 2,5 × ước lượng, tách cài đặt AI thành `HeuristicAiClient`.
- **File chính đã sửa:** `CpmCalculator.java`, `StalledNodeDetector.java`, `HeuristicAiClient.java` (thay `AiServiceClientImpl.java`, đã xóa); test: `CpmCalculatorTest`, `StalledNodeDetectorTest`, `HeuristicAiClientTest`, `AiDiagnosticControllerTest`.
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:** Tự tính lại CPM bằng tay (ES, EF, LS, LF, slack); vì sao phải có thứ tự topo trước forward pass; mẫu Strategy (`AiServiceClient` có nhiều cài đặt).
