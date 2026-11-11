# B2 — API đồ thị và giai đoạn: kiểm thử, lưu vị trí phase, chặn dự án lưu trữ (Cụm 4.1, 4.2)

Người làm: B
Người review: C
Trạng thái: chưa làm
Cần có trước: B1
Cần trước bước frontend: không
Mở khóa: B5
Nhánh git: b2-graph-phases
Ước lượng: 1 ngày

> **Cập nhật 11/11/2026 (sau khi pull):** đã có `BE/controller/WorkflowGraphController.java`, `BE/service/WorkflowGraphService.java`, `BE/service/engine/PhaseProgressCalculator.java`, bảng `phase_dependency` (migration **V6** do Dev B viết) và test `WorkflowGraphServiceTest`, `PhaseProgressCalculatorTest`. Task này: đọc hiểu, kiểm thử, rồi làm 2 phần còn thiếu.

## Vì sao cần task này
Phần đọc đồ thị và quản lý phase đã chạy. Đọc code thấy còn thiếu:
1. **Vị trí phase trên canvas không được lưu**: `work_phase` không có cột tọa độ; `CreatePhaseRequest`, `UpdatePhaseRequest`, `PhaseResponse` không có trường vị trí. Kéo phase rồi F5 là mất. (FE đã có `updatePhasePosition` nhưng backend chưa có chỗ lưu.)
2. **Dự án `ARCHIVED` vẫn sửa được đồ thị** (theo `workflow-engine.md` 5.1, ARCHIVED là chỉ đọc).

## Kiến thức phải nắm
Quan hệ nhiều-nhiều tự tham chiếu (`phase_dependency`), migration Flyway thêm cột JSONB, DTO record, BFS kiểm tới được (dùng trong `addPhaseEdge`), lỗi N+1 query.

## Bước 0 — Tự đọc, không dùng AI
Đọc: integration map 4.1, 4.2; `docs/archive/dev_b/DEV_B_IMPLEMENTATION_GUIDE.md` mục 3–4.2; `V6__create_phase_dependency.sql`; trong `WorkflowGraphService.java` các hàm `getGraph`, `createPhase`, `updatePhase`, `deletePhase`, `connectPhases`, `disconnectPhases`, `addPhaseEdge`; `PhaseProgressCalculator.java`.
Trả lời:
1. `addPhaseEdge` chặn vòng giữa các phase bằng cách nào? Vì sao cách đó đúng mà không cần chạy Kahn cả đồ thị?
2. Vì sao vẫn giữ cột `work_phase.parent_phase_id` sau khi có bảng `phase_dependency`? `disconnectPhases` xử lý cột cũ thế nào?
3. `getGraph` chạy bao nhiêu câu SQL? Có bị N+1 không? (bật `spring.jpa.show-sql` trên máy bạn để đếm, không commit)

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `wpe-backend/src/**`, `FE/**`, `docs/**`

## Được ghi
- `wpe-backend/src/main/resources/db/migration/V9__work_phase_ui_metadata.sql` (số V9 đã cấp cho B)
- `BE/entity/WorkPhaseEntity.java`
- `BE/service/WorkflowGraphService.java` (phần phase và đọc đồ thị), `BE/controller/WorkflowGraphController.java`
- `BE/dto/request/graph/CreatePhaseRequest.java`, `UpdatePhaseRequest.java`, `BE/dto/response/graph/PhaseResponse.java`
- `BE-test/service/WorkflowGraphServiceTest.java`
- `docs/specs/database-schema.md` (WORK_PHASE, PHASE_DEPENDENCY), `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md` (4.1–4.2), `docs/tasks/B-do-thi/B2-api-do-thi-giai-doan.md`

## Đặc tả đã chốt
- Giữ nguyên các endpoint đang có (FE đã gọi): `GET /projects/{id}/graph`, `POST/PUT/DELETE /projects/{id}/phases`, `POST /projects/{id}/phases/connect`, `POST /projects/{id}/phases/disconnect`.
- V9: `ALTER TABLE work_phase ADD COLUMN ui_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;`
- `CreatePhaseRequest`, `UpdatePhaseRequest` thêm `Map<String, Object> uiMetadata` (tùy chọn). `PhaseResponse` thêm `uiMetadata`. Dạng dữ liệu: `{ "x": 280, "y": 140, "w": 250, "h": 220 }`.
- Mọi thao tác **ghi** trên dự án `ARCHIVED` → 409 `PROJECT_ARCHIVED` (nếu B3 chưa tạo exception này thì tạo mới, handler thêm ở cuối `GlobalExceptionHandler`).
- Cập nhật `database-schema.md`: bảng `phase_dependency` (V6) và cột mới (V9). Cập nhật integration map 4.1–4.2 theo endpoint thật (`phases/connect`, `phases/disconnect`).

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 Đọc `WorkflowGraphServiceTest`, lập bảng case đã có và case còn thiếu (phase nhiều cha, nối tạo vòng, xóa phase còn node, không phải owner, dự án ARCHIVED…).
3. 🧠 Tự viết V9. Claude review.
4. 🤝 Lưu `uiMetadata` cho phase, chặn ARCHIVED, bổ sung test.
5. 🤝 Cập nhật 2 file docs.

## Tiêu chí xong
- [ ] V9 chạy được trên DB đã có V1–V6 (dán log Flyway).
- [ ] `PUT /phases/{id}` với `uiMetadata` rồi `GET /graph` trả lại đúng tọa độ.
- [ ] Ghi đồ thị của dự án ARCHIVED → 409.
- [ ] Test pass, có case cho phase nhiều cha và nối tạo vòng.
- [ ] Ghi chép có số câu SQL đếm được của `GET graph`.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. Vì sao `phase_dependency` cần cả `UNIQUE` và `CHECK`?
2. Rule tính trạng thái phase trong `PhaseProgressCalculator`: phase có node LOCKED và TODO thì ra gì?
3. N+1 query là gì? `getGraph` có mắc không?

## Cấm
- Sửa file ngoài mục "Được ghi". File dùng chung thì báo nhóm trước (README mục 6).
- Sửa V1–V6.
- Đổi URL các endpoint đang có.
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
