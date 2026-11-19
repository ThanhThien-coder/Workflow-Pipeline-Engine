# S08 — Trang khách (link chia sẻ) có thêm dữ liệu

Người làm: Người 3 (gói Giao diện)
Người review: Thiện
Trạng thái: chưa làm
Cần có trước: không
Mở khóa: không
Nhánh git: s08-trang-khach
Ước lượng: 1 ngày

## Vì sao cần task này (lỗi gốc #25)
Trang khách (`/guest?token=...`, file `FE/views/GuestView.tsx`) hiện rất ít dữ liệu.
- Bản gọi API thật đang **tắt** "AI Summary" và "Evaluation", vì chưa có API (`FE/services/impl/HttpGuestService.ts`: `features = { aiSummary: false, evaluation: false }`).
- Trang chỉ còn: 3 thẻ số (Total Nodes, Completion, Overdue), biểu đồ Velocity, phân bổ trạng thái, 5 hoạt động gần nhất, artifact công khai, form góp ý.
- Khách (thầy cô, khách hàng) không thấy dự án gồm những giai đoạn nào, đang tới đâu, sắp tới hạn gì.

## Đang làm gì (tóm tắt cho người đọc)
1. API khách (`GET /api/v1/guest/{token}/overview`) trả thêm:
   - tiến độ từng phase;
   - số thành viên.

   (Thiện chốt 19/11: KHÔNG làm "hạn chót sắp tới" và "task vừa xong".)
2. Thêm API `GET /api/v1/guest/{token}/ai-summary`, lấy **kết quả AI đã lưu sẵn** của dự án (không gọi AI mới) để bật lại khối "AI Summary".
3. Giao diện khách hiện các phần mới. Khối "Evaluation" (chưa có API) bỏ hẳn khỏi giao diện thật.
4. **Không lộ thông tin riêng tư**: không email, không tên đầy đủ người làm. Chỉ hiện chữ cái đầu như phần "Recent Activity" đang làm.

## Bước 0 — Tự đọc (20 phút)
Đọc `BE/service/GuestGatewayService.java` (`getGuestOverview`), `BE/dto/response/guest/GuestOverviewResponse.java`, `FE/views/GuestView.tsx`. Trả lời:
1. Link khách hết hạn hoặc bị thu hồi thì API trả gì?
2. Phần nào trên trang khách đang lấy từ API, phần nào đang bị tắt?

## Được đọc
- `wpe-backend/src/**`, `wpe-frontend/src/**`, `docs/specs/**` (mục khách)

## Được ghi
> `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`
- `BE/dto/response/guest/GuestOverviewResponse.java` (thêm field **cuối**, giữ field cũ), `BE/dto/response/guest/GuestAiSummaryResponse.java` (MỚI)
- `BE/service/GuestGatewayService.java`, `BE/controller/GuestGatewayController.java` (thêm endpoint ai-summary)
- `FE/types/guest.types.ts` (thêm field tùy chọn), `FE/services/impl/http/guest.ts`, `FE/services/impl/HttpGuestService.ts`, `FE/views/GuestView.tsx`
- Test liên quan, `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md` (mục khách), file task này

## Đặc tả đã chốt
- `GuestOverviewResponse` thêm:
  - `phases: [{ name, status, progressPct, totalTasks, doneTasks }]` theo thứ tự `orderIndex`; tên dùng như `phaseDisplayName` của FE (tên dạng "PHASE 3" mà có phụ đề thì dùng phụ đề);
  - `memberCount: number` (chủ dự án + thành viên đang hoạt động).
- `GET /api/v1/guest/{token}/ai-summary`:
  - Kiểm link như `/overview` (hết hạn hoặc thu hồi → cùng mã lỗi như `/overview`).
  - Đọc kết quả AI **đã lưu** (`latest_ai_analysis` của dự án, đọc qua service AI hiện có, không gọi Gemini).
  - Trả `{ content, highlights[], risks[], generatedAt }`, đúng kiểu `GuestAiSummaryDto` FE đã có:
    - `content`: 1–2 câu tóm tắt dựng từ `metrics` (trạng thái, số task xong 7 ngày, số task còn lại);
    - `highlights`: lấy từ `actionableAdvice`;
    - `risks`: lấy từ `bottlenecks` và `taskTraps` (chỉ mã task + lý do, không tên người).
  - Chưa có phân tích → 404 `AI_SUMMARY_NOT_FOUND`; FE ẩn khối AI và hiện "No AI analysis yet".
- `/api/v1/guest/**` đã `permitAll` trong `SecurityConfig`; endpoint mới nằm dưới đường dẫn này. Kiểm lại `SecurityRulesTest` vẫn xanh.
- Frontend:
  - `HttpGuestService.features = { aiSummary: true, evaluation: false }`; `getAiSummary` gọi API mới.
  - `GuestView` thêm:
    - khối **Phases**: danh sách phase dạng thanh tiến độ ngang (tên, %, nhãn trạng thái) — không cần vẽ đồ thị;
    - số thành viên trên đầu trang.
  - Bỏ hẳn khối Evaluation khỏi giao diện (`features.evaluation` vẫn false). Không xóa code mock của evaluation.

## Việc cần làm
1. 🧠 Bước 0.
2. 🤝 Backend: thêm field + tính dữ liệu + test (dự án 2 phase; kiểm thứ tự phase, %, số task, số thành viên; không có email hay tên người).
3. 🤝 Endpoint ai-summary + test (có phân tích → 200 đúng khuôn; chưa có → 404; link thu hồi → mã lỗi như overview).
4. 🤝 Frontend + test render từng khối, ẩn khối AI khi 404.

## Tiêu chí xong
- [ ] `./mvnw -q test` và `npx vitest run` (ổ `C:` hoa) xanh, `npx tsc -b` sạch.
- [ ] Kiểm tay trên stack thử:
  - Owner bật link khách ở Overview, chạy AI 1 lần (cần key, hoặc bỏ qua phần AI).
  - Mở link trong cửa sổ ẩn danh → thấy Phases, số thành viên, AI Summary (nếu có).
  - Không thấy email hay tên đầy đủ của ai.

## Câu hỏi bảo vệ
1. Vì sao trang khách chỉ đọc kết quả AI đã lưu, không cho khách bấm chạy AI?
2. Dữ liệu nào cố ý không đưa ra trang khách, vì sao?

## Cấm
- Đổi tên hoặc xóa field cũ của `GuestOverviewResponse`. Cho khách gọi AI mới. Lộ email, tên người.
- Đọc `.env*`. Tự ghi `xong`.

## Dành cho Claude (đọc trước khi làm)
- Đọc `docs/tasks/S-sau-deploy/README.md` mục 3–5. Test frontend chạy từ `C:\...` viết hoa.
- Đọc `AiAnalysisResult` và hàm lấy phân tích mới nhất trong `BE/service/ai/AiDiagnosticService.java` trước khi dựng ai-summary (không đoán tên field).
- Làm xong: ghi chép, `chờ kiểm`, hỏi 2 câu bảo vệ.

## Ghi chép của người làm
