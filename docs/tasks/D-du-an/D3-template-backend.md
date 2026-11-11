# D3 — Template Studio backend: CRUD template, kiểm chu trình, clone (Cụm 10.3)

Người làm: D
Người review: A
Trạng thái: chưa làm
Cần có trước: B1, D1
Cần trước bước frontend: không
Mở khóa: D4
Nhánh git: d3-templates
Ước lượng: 1,5 ngày

## Vì sao cần task này
`BE/controller/TemplateController.java` mới có `POST /{id}/clone`, chưa có thêm/sửa/xóa/xem template. Định dạng `graph_data` cũng chưa thống nhất: `TemplateCloneService` đang đọc lẫn nhiều kiểu khóa (`source/target`, `parentId/childId`, `subTitle`).

## Kiến thức phải nắm
Lưu đồ thị trong JSONB, version hóa schema dữ liệu (`schemaVersion`), kiểm chu trình 2 tầng (phase và node), phân quyền cấp hệ thống (ADMIN).

## Bước 0 — Tự đọc, không dùng AI
Đọc: integration map 10.3; trong `FE/types/template.types.ts` đọc `GraphDataPayload`, `TemplateSummaryDto`, `TemplateDetailDto`, `DagValidationResult`; `FE/services/template/ITemplateService.ts`, `FE/services/template/mockTemplateData.ts`; `BE/entity/PipelineTemplateEntity.java`; phần đọc graphData trong `BE/service/TemplateCloneService.java`; `BE-test/service/TemplateCloneServiceTest.java`.
Trả lời:
1. `graphData` có 2 tầng. Tầng nào cần kiểm chu trình: `phaseEdges`, `edges`, hay cả hai?
2. Template hệ thống (`is_system_standard`) thì ai được sửa, ai được xóa?
3. Clone xong, node nào LOCKED, node nào TODO?

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `wpe-backend/src/**`, `FE/**`, `docs/**`

## Được ghi
- `BE/controller/TemplateController.java`, `BE/service/template/**` (mới), `BE/service/TemplateCloneService.java` (phần đọc graphData)
- `BE/repository/PipelineTemplateRepository.java` (chỉ thêm method)
- `BE/dto/request/template/**`, `BE/dto/response/template/**` (mới)
- `BE-test/service/template/**` (mới), `BE-test/service/TemplateCloneServiceTest.java`
- `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md` (10.3), `docs/tasks/D-du-an/D3-template-backend.md`

## Đặc tả đã chốt
- Định dạng `graph_data` = `GraphDataPayload` (`schemaVersion: 2`) trong `FE/types/template.types.ts`, vì Template Studio trên FE là nơi tạo ra nó. `TemplateCloneService` phải đọc đúng định dạng này. Nếu DB đang có dữ liệu kiểu cũ thì vẫn giữ khả năng đọc, có test.
- `GET /api/v1/templates?category=&query=` → `TemplateSummaryDto[]`. Mọi user đăng nhập đều xem được, để chọn template khi tạo dự án.
- `GET /api/v1/templates/{id}` → `TemplateDetailDto`.
- `POST /api/v1/templates`, `PUT /api/v1/templates/{id}`, `DELETE /api/v1/templates/{id}`: chỉ user có `system_role = ADMIN`. Kiểm **trong service** bằng `system_role` của user hiện tại (đọc qua `UserRepository`). Cách này chạy được cả với header debug lẫn JWT, nên không phải chờ A3.
- Trước khi lưu, chạy `DagValidator` (B1) cho cả `phaseEdges` (tầng phase) và `edges` (tầng node). Có chu trình → 422 `CYCLE_DETECTED`, `cycleNodes` là id hoặc tiêu đề node.
- `POST /api/v1/templates/validate`, body là graphData → `DagValidationResult`. Chỉ kiểm, không lưu.
- Clone: `clone_count += 1`. Node không có cạnh vào → TODO, có cạnh vào → LOCKED (giữ logic hiện có). Dự án mới ở trạng thái DRAFT (D1).

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 Viết bảng test case trước.
3. 🤝 CRUD, validate, kèm test.
4. 🧠 Test "khứ hồi": tạo template từ JSON mẫu trong `mockTemplateData.ts` → clone → đếm phase, node, dependency của dự án mới bằng repository và so với template.
5. 🤝 Cập nhật integration map 10.3.

## Tiêu chí xong
- [ ] Test pass.
- [ ] Template có chu trình → 422. User thường gọi POST → 403.
- [ ] Test khứ hồi: số phase, node, cạnh của dự án clone khớp với template.
- [ ] Đã cập nhật integration map.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. Lưu template bằng JSONB khác lưu thành các bảng chuẩn hóa ở đâu? Vì sao chọn JSONB?
2. Template Studio trên FE đã kiểm chu trình, vì sao BE vẫn phải kiểm?
3. `schemaVersion` dùng để làm gì? Sau này đổi định dạng thì xử lý thế nào?

## Cấm
- Sửa file ngoài mục "Được ghi". File dùng chung thì báo nhóm trước (README mục 6).
- Đọc, in, commit `.env*`, khóa, mật khẩu thật, API key. Dùng `git add -f`.
- Sửa `DagValidator` (của B). Cần thêm gì thì nhờ B.
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
