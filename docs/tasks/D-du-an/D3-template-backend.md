# D3 — Template backend: kiểm thử, phân quyền ADMIN, kiểm clone khứ hồi (Cụm 10.3)

Người làm: D
Người review: A
Trạng thái: chờ kiểm
Cần có trước: B1, D1
Cần trước bước frontend: không
Mở khóa: D4
Nhánh git: d3-templates
Ước lượng: 1 ngày

> **Cập nhật 11/11/2026 (sau khi pull):** CRUD template đã có: `BE/controller/PipelineTemplateController.java`, `BE/service/PipelineTemplateService.java`, kiểm chu trình bằng `KahnDagService.validateTemplateGraph`, migration **V5** (thêm cột `slug` và seed các template mẫu), test `PipelineTemplateServiceTest`. Task này: đọc hiểu, vá phân quyền, kiểm clone khứ hồi.

> ⚡ **Chế độ sprint:** Claude làm hết các bước, kể cả 🧠; bỏ qua Bước 0 và mục "Dành cho Claude". Luồng làm: [SPRINT_2_NGAY.md](../SPRINT_2_NGAY.md) mục 2–3.
> - **Claude tự chạy bằng dòng lệnh:** user thường gọi POST → 403; admin → 201; xóa template hệ thống → 409.
> - **Dời về buổi kiểm chung (mục 7):** user thường thử tạo template trên giao diện → bị từ chối (bảng 7.2 dòng 9).
> - **Không làm trong sprint:** không có.

## Vì sao cần task này
Đọc code thấy:
1. **Ai cũng sửa, xóa được template**: `createTemplate`, `updateTemplate`, `deleteTemplate` không kiểm `system_role = ADMIN` (UC5 trong `system-overview.md` chỉ cho Admin).
2. Controller có `?currentUserId=` và `orElse(1L)`. Không đăng nhập vẫn tạo được template, và template bị ghi là do admin (user 1) tạo.
3. Template hệ thống (`is_system_standard = true`) cũng bị sửa, xóa như template thường.
4. Chưa có test chứng minh: tạo template → clone → dự án mới có đúng số phase, node, cạnh như template.

## Kiến thức phải nắm
Lưu đồ thị trong JSONB, slug, phân quyền cấp hệ thống (ADMIN), kiểm chu trình 2 tầng (phase và node), test khứ hồi (round-trip).

## Bước 0 — Tự đọc, không dùng AI
Đọc: integration map 10.3; `V5__seed_templates_and_add_slug.sql` (phần đầu); `PipelineTemplateController.java`, `PipelineTemplateService.java`, `validateTemplateGraph` trong `BE/service/engine/KahnDagService.java`; phần đọc graphData trong `BE/service/TemplateCloneService.java`; `GraphDataPayload` trong `FE/types/template.types.ts`.
Trả lời:
1. Chỉ dòng code của lỗ hổng 1 và 2.
2. `validateTemplateGraph` kiểm chu trình ở tầng nào: `phaseEdges`, `edges`, hay cả hai?
3. Template được tìm theo id hoặc slug. Vì sao cần slug?

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `wpe-backend/src/**`, `FE/**`, `docs/**`

## Được ghi
- `BE/controller/PipelineTemplateController.java`, `BE/service/PipelineTemplateService.java`
- `BE/service/TemplateCloneService.java` (chỉ phần đọc graphData, nếu test khứ hồi lộ lỗi)
- `BE/repository/PipelineTemplateRepository.java` (chỉ thêm method)
- `BE-test/service/PipelineTemplateServiceTest.java`, `BE-test/service/TemplateCloneServiceTest.java`
- `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md` (10.3), `docs/tasks/D-du-an/D3-template-backend.md`

## Đặc tả đã chốt
- Giữ nguyên các endpoint đang có (FE `HttpTemplateService` đã gọi): `GET/POST /templates`, `GET/PUT/DELETE /templates/{id}`, `POST /templates/validate`.
- `POST`, `PUT`, `DELETE`: chỉ user có `system_role = ADMIN`, kiểm **trong service** bằng `UserRepository` theo user hiện tại (chạy được cả với header debug lẫn JWT, không phải chờ A3). Không phải admin → 403 `ACCESS_DENIED`.
- Bỏ `orElse(1L)`: dùng `requireCurrentUserId()`. Tham số `?currentUserId=` bỏ ở X1 (cùng đợt với các controller khác).
- Template hệ thống (`is_system_standard = true`): chỉ admin sửa được, và **không cho xóa** → 409 `SYSTEM_TEMPLATE_LOCKED`.
- `GET` danh sách và chi tiết: mọi user đăng nhập đều xem được (để chọn template khi tạo dự án).
- Định dạng `graph_data` chuẩn là `GraphDataPayload` (`schemaVersion: 2`) của FE. `TemplateCloneService` phải đọc đúng định dạng này.

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 Viết test **đỏ** cho lỗ hổng 1 và 3 trước khi sửa.
3. 🤝 Sửa phân quyền, bỏ `orElse(1L)`, khóa template hệ thống; cho test xanh.
4. 🧠 Viết test khứ hồi: lấy một template seed trong V5 → clone → đếm phase, node, dependency của dự án mới bằng repository, so với graphData của template.
5. 🤝 Cập nhật integration map 10.3 theo endpoint thật.

## Tiêu chí xong
- [ ] Test lỗ hổng: fail trước khi sửa (ghi lại), pass sau khi sửa.
- [ ] Swagger: user thường (`X-Debug-User-Id: 2`) gọi POST → 403; admin (`1`) → 201; xóa template hệ thống → 409.
- [ ] Test khứ hồi pass.
- [ ] Toàn bộ test pass.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. Lưu template bằng JSONB khác lưu thành các bảng chuẩn hóa ở đâu? Vì sao chọn JSONB?
2. Template Studio trên FE đã kiểm chu trình, vì sao BE vẫn phải kiểm?
3. `schemaVersion` dùng để làm gì? Sau này đổi định dạng thì xử lý thế nào?

## Cấm
- Sửa file ngoài mục "Được ghi". File dùng chung thì báo nhóm trước (README mục 6).
- Sửa `KahnDagService` (của B). Cần thêm gì thì nhờ B.
- Sửa V5 (đã merge).
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
Sprint 12/11/2026, Claude chạy (Antigravity viết code, Claude kiểm).

`mvn -B test` sau khi sửa:
```
[INFO] Tests run: 167, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```
Test lỗ hổng chạy với `PipelineTemplateService` CŨ (trước khi sửa) → fail đúng chỗ:
```
[ERROR]   PipelineTemplateServiceTest.testCreateTemplateForbiddenForRegularUser ... expected: <ForbiddenException> but was: <NullPointerException>
[ERROR]   PipelineTemplateServiceTest.testUpdateTemplateForbiddenForRegularUser ... but was: <ResourceNotFoundException>
[ERROR]   PipelineTemplateServiceTest.testDeleteTemplateForbiddenForRegularUser ... but was: <ResourceNotFoundException>
[ERROR]   PipelineTemplateServiceTest.testDeleteSystemTemplateThrowsConflict ... Expected ConflictException to be thrown, but nothing was thrown.
[ERROR] Tests run: 19, Failures: 5, Errors: 3, Skipped: 0
```
Chạy thật trên backend local (header `X-Debug-User-Id`):
- user thường (2) POST `/templates` → 403 `ACCESS_DENIED`; không đăng nhập → 403.
- admin (1) POST → 201, `createdBy` = System Administrator.
- user thường PUT / DELETE template → 403.
- admin DELETE template hệ thống `tpl-sdlc` → 409 `SYSTEM_TEMPLATE_LOCKED`; admin DELETE template thường → 204.
- user thường GET danh sách → 200 (4 template).
- Khứ hồi: clone `tpl-sdlc` rồi đọc `/projects/{id}/graph` → 4 phase, 3 phaseEdges, 7 node, 3 dependency, khớp `graph_data` seed V5 (4 phase, 3 phaseEdges, 7 node, 3 cạnh). Test khứ hồi Mockito `shouldRoundTripTemplateGraph_countsMatchGraphData` cũng pass.

### Điều chưa chắc / cần nhóm quyết
- Tham số `?currentUserId=` vẫn còn ở POST/PUT/DELETE theo đặc tả (bỏ ở X1). Nghĩa là gọi `?currentUserId=1` vẫn mạo danh được admin cho tới khi X1 làm.
- Bước 5 (cập nhật integration map 10.3) chưa làm: endpoint không đổi, chỉ thêm quyền; nên ghi 403/409 vào map ở X1 hoặc sau.

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:** Template: chỉ ADMIN tạo/sửa/xóa (kiểm trong service bằng `system_role`), bỏ `orElse(1L)`, không cho xóa template hệ thống (409 `SYSTEM_TEMPLATE_LOCKED`), thêm test khứ hồi template → clone.
- **File chính đã sửa:** `PipelineTemplateService.java` (`requireAdmin`, `deleteTemplate`), `PipelineTemplateController.java`; test: `PipelineTemplateServiceTest`, `TemplateCloneServiceTest`.
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:** Phân quyền cấp hệ thống (ADMIN) khác phân quyền cấp dự án (OWNER) ở đâu; vì sao kiểm quyền trong service chứ không ở controller; test khứ hồi đếm những gì.
