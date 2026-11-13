# FB1 — Tạo dự án từ template mẫu (slug) bị lỗi

Người làm: B
Trạng thái: chưa làm
Lỗi xử lý: L4, L8
Nhánh git: fix-fb1-clone-template-slug
Làm trước: không

> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.

## Lỗi người dùng thấy
Tạo dự án chọn template mẫu (SDLC, Marketing, DevOps) thì lỗi; chỉ tạo được dự án trống hoặc từ template tự lưu.

## Nguyên nhân (đã đọc code)
- 3 template mẫu trong `V5__seed_templates_and_add_slug.sql` có slug `tpl-sdlc`, `tpl-marketing`, `tpl-devops`.
- `BE/service/PipelineTemplateService.java` dòng 423: id trả về cho FE là **slug** nếu có, không thì là số. Template tự lưu không có slug → id là số.
- `FE/services/impl/HttpWorkflowService.ts`:
  - `cloneTemplate` (dòng ~315): `templateId: Number(req.templateId)` → `Number('tpl-sdlc')` = `NaN` → `JSON.stringify` thành `null`.
  - `createProject` (dòng ~280): `templateId: cmd.templateId ? Number(cmd.templateId) : null`, cùng lỗi.
- Backend `CloneTemplateRequest.getNumericTemplateId()`/`getTemplateIdentifier()` **đã hỗ trợ** cả số lẫn slug, nhưng nhận `null` nên báo "Không tìm thấy mẫu quy trình với ID: null".
- `workspaceSlice.createProject` có template thì gọi `cloneTemplate`.

## Cách sửa (đã chốt)
1. FE gửi `templateId` **đúng như nhận**: chuỗi số thì gửi số (`/^\d+$/`), còn lại gửi nguyên chuỗi slug. Sửa ở cả `cloneTemplate` và `createProject`; nên tách một hàm nhỏ `toTemplateIdPayload(id)` dùng chung.
2. Kiểm tra clone thật cả 3 template mẫu: dự án mới có đủ phase, node, cạnh như `graph_data`; đồ thị mở ra vẽ được. Nếu template nào clone ra thiếu phase/node thì sửa phần đọc `graph_data` trong `TemplateCloneService` (file của D, đợt này B được sửa vì thuộc luồng tạo dự án; báo D một câu).
3. Lỗi clone hiện ra toast có message của backend, không nuốt lỗi.

## Được sửa
- `FE/services/impl/HttpWorkflowService.ts` (chỉ `createProject`, `cloneTemplate`), `FE/store/slices/workspaceSlice.ts` (chỉ phần báo lỗi nếu cần)
- `BE/service/TemplateCloneService.java` (chỉ khi bước 2 phát hiện lỗi)
- Test FE `FE/services/impl/__tests__/**` hoặc `FE/services/impl/http/__tests__/**`; `BE-test/**/TemplateClone*`

## Test phải có
- Test FE: `cloneTemplate({ templateId: 'tpl-sdlc' })` gửi body có `templateId: 'tpl-sdlc'`; `templateId: '12'` gửi số `12`. Chạy trước khi sửa phải fail.
- Test BE: clone `tpl-sdlc`, `tpl-marketing`, `tpl-devops` → số phase và node khớp `graph_data` của từng template.

## Kiểm bằng tay
1. Đăng nhập alex, tạo dự án với từng template mẫu → tạo được, mở Workflow thấy đủ phase và task.
2. Settings → lưu dự án thành template → tạo dự án mới từ template đó → vẫn chạy (không hỏng trường hợp id số).

## Kết quả (Claude ghi, dán output thật)
