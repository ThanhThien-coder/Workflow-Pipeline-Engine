# D4 — Template Studio và Catalog chạy API thật (FE 10.3)

Người làm: D
Người review: A
Trạng thái: chưa làm
Cần có trước: A2, D3
Cần trước bước frontend: không
Mở khóa: X1
Nhánh git: d4-templates-ui
Ước lượng: 1–1,5 ngày

## Vì sao cần task này
`templateService` trong `FE/services/container.ts` đang luôn dùng `MockTemplateService`. Màn Template Studio, Catalog và hộp thoại tạo dự án đều đọc template giả.

## Kiến thức phải nắm
Dependency Inversion (đổi Mock sang Http mà không sửa component), xử lý lỗi nghiệp vụ trên form, sự kiện tùy biến trên trình duyệt (`wpe_template_updated`).

## Bước 0 — Tự đọc, không dùng AI
Đọc: `FE/features/admin/templates/TemplateStudioView.tsx`, `TemplateCatalogView.tsx`, `FE/hooks/useTemplateStudio.ts`, `FE/services/template/**`, `FE/components/workspace/CreatePipelineModal.tsx`; test `FE/hooks/__tests__/useTemplateStudio.test.ts`, `FE/services/template/__tests__/MockTemplateService.test.ts`.
Trả lời:
1. Sự kiện `wpe_template_updated` dùng để làm gì, ai nghe nó?
2. `validateGraph` đang chạy ở FE hay gọi BE? Khi nào nên gọi BE?
3. Admin mất mạng giữa lúc lưu template thì UI nên làm gì?

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `FE/**`, `docs/**`

## Được ghi
- `FE/services/impl/HttpTemplateService.ts` (mới), `FE/services/container.ts` (chỉ dòng `templateService`)
- `FE/features/admin/templates/**`, `FE/hooks/useTemplateStudio.ts`
- `FE/components/workspace/CreatePipelineModal.tsx` (chỉ phần chọn template)
- `FE/types/template.types.ts`, test FE
- `docs/tasks/D-du-an/D4-template-giao-dien.md`

## Đặc tả đã chốt
- `HttpTemplateService` (mới) implements `ITemplateService`:
  - `getTemplates`, `getTemplateById`, `createTemplate`, `updateTemplate`, `deleteTemplate` gọi API của D3;
  - `getAllTemplates` = gọi danh sách không lọc;
  - `validateGraph` gọi `POST /templates/validate`.
- Nối vào `container.ts` theo `isMockMode` (A2).
- `CreatePipelineModal` lấy danh sách template thật.
- Lỗi 422 → Studio tô đỏ các node trong `cycleNodes`. Lỗi 403 → toast "Chỉ quản trị viên được chỉnh sửa template".

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 Viết bảng test case trước.
3. 🤝 Code và test.
4. 🧠 Chạy thật: đăng nhập admin, tạo template 2 phase 4 node; đăng nhập alex, tạo dự án từ template đó; kiểm đồ thị dự án mới đúng như template.

## Tiêu chí xong
- [ ] `npm test` pass.
- [ ] Kịch bản bước 4 chạy đúng (ghi kết quả).
- [ ] Template có chu trình → Studio báo lỗi đúng node.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. Vì sao `HttpTemplateService` phải giữ đúng interface `ITemplateService` giống bản mock?
2. Đổi giữa Mock và Http mà không sửa component: đó là nguyên tắc nào trong SOLID? Chỉ vào code.
3. Lưu template bị lỗi giữa chừng thì dữ liệu trên form có mất không? Bạn xử lý thế nào?

## Cấm
- Sửa file ngoài mục "Được ghi". File dùng chung thì báo nhóm trước (README mục 6).
- Đọc, in, commit `.env*`, khóa, mật khẩu thật, API key. Dùng `git add -f`.
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
