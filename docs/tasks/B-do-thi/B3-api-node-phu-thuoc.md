# B3 — API node, phụ thuộc và lưu tọa độ canvas (Cụm 4.3, 4.4)

Người làm: B
Người review: C
Trạng thái: chưa làm
Cần có trước: B2
Cần trước bước frontend: không
Mở khóa: B4, B5
Nhánh git: b3-nodes-deps
Ước lượng: 1,5 ngày

## Vì sao cần task này
Chưa có API thêm, sửa, xóa node, chưa có API nối và gỡ phụ thuộc, chưa có API lưu tọa độ. Có một bẫy cần biết: `NodeEntity` có `@Version`, nên mỗi lần `save()` (kể cả chỉ kéo thả đổi tọa độ) đều tăng `version`. Khi đó người khác đang thao tác Kanban sẽ bị 409 oan.

## Kiến thức phải nắm
Unique constraint và bắt `DataIntegrityViolationException`; optimistic locking khi sửa node; câu `UPDATE` trực tiếp (JPQL hoặc native) không đi qua `@Version`; validate input bằng `@Valid`; sinh mã node.

## Bước 0 — Tự đọc, không dùng AI
Đọc: integration map 4.3, 4.4; `docs/specs/workflow-engine.md` mục 3 (join policy, node độc lập) và 5.2; `BE/entity/NodeEntity.java`, `BE/entity/NodeDependencyEntity.java`; hàm `unlockDownstreamTasks` trong `BE/service/engine/StateMachineService.java` (chỉ đọc, file của C); `FE/components/mindmap/AddNodeToolbar.tsx`, `FE/components/mindmap/NodePropertiesModal.tsx`.
Trả lời:
1. Một node đang `TODO`, giờ được thêm một cha chưa DONE. Theo bạn nó phải thành gì? Xóa cạnh khiến node mất hết cha thì sao? So với đặc tả bên dưới.
2. Vì sao kiểm chu trình ngay lúc lưu cạnh, không đợi tới lúc xuất bản?
3. `code` là unique trong dự án (`uq_project_node_code`). Sinh mã thế nào để 2 người thêm node cùng lúc không bị trùng?

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `wpe-backend/src/**`, `FE/**`, `docs/**`

## Được ghi
- `BE/controller/GraphController.java`, `BE/service/graph/**`, `BE/dto/request/graph/**`, `BE/dto/response/graph/**`
- `BE/repository/NodeRepository.java`, `BE/repository/NodeDependencyRepository.java` (chỉ thêm method)
- `BE-test/**/graph/**`
- `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md` (4.3–4.4), `docs/tasks/B-do-thi/B3-api-node-phu-thuoc.md`

## Đặc tả đã chốt
- `POST /api/v1/projects/{id}/nodes`, body `{ phaseId?, code?, title, description?, joinPolicy?, assignedUserId?, dueDate?, estimatedHours?, uiMetadata? }` → 201.
  - `code` để trống thì tự sinh `WPE-` + (số lớn nhất hiện có + 1), đủ 3 chữ số, ví dụ `WPE-005`. Đụng unique → 409 `NODE_CODE_TAKEN`.
  - Node mới chưa có cha → `TODO`.
- `PUT /api/v1/nodes/{id}`, body `{ title?, description?, phaseId?, joinPolicy?, assignedUserId?, dueDate?, estimatedHours?, version }` → 200.
  - Sai `version` → 409 `OPTIMISTIC_LOCK_CONFLICT`.
  - `assignedUserId` phải là thành viên đang hoạt động, nếu không → 400 `ASSIGNEE_NOT_MEMBER`.
  - Dời `dueDate` sang tương lai → `isOverdue = false` (liên quan C5).
  - **Không** cho sửa `status` ở đây; trạng thái do máy trạng thái của C quản lý.
- `DELETE /api/v1/nodes/{id}` → 204, chỉ khi node đang LOCKED hoặc TODO. Node đang `IN_PROGRESS`, `REVIEW`, `DONE` → 409 `NODE_IN_USE`. Cạnh liên quan tự xóa theo cascade.
- `POST /api/v1/projects/{id}/dependencies`, body `{ parentNodeId, childNodeId }` → 201.
  - 2 node khác dự án → 400. Trùng → 409 `EDGE_EXISTS`. Tạo vòng → 422 `CYCLE_DETECTED`, `cycleNodes` là mã node.
  - Con đang `IN_PROGRESS` trở lên → 409 `NODE_IN_USE` (không thêm cha cho việc đang làm).
  - Thêm xong thì tính lại con theo `joinPolicy`: con đang `TODO` mà điều kiện hội tụ không còn thỏa → `LOCKED`.
- `DELETE /api/v1/projects/{id}/dependencies?parentNodeId=&childNodeId=` → 204. Xóa xong, nếu con đang `LOCKED` mà không còn cha hoặc điều kiện hội tụ đã thỏa → `TODO`, và gửi `TASK_UNLOCKED` qua `SseEmitterService.sendToUser` (gọi hàm có sẵn, không sửa file của C).
- `PATCH /api/v1/nodes/{id}/metadata`, body `{ position: { x, y }, width?, height?, color? }` → 200, ghi đè `ui_metadata` bằng **câu UPDATE trực tiếp, không làm tăng `version`**. Tọa độ không phải dữ liệu nghiệp vụ.
- Mọi thao tác ghi chỉ OWNER được làm. Dự án `ARCHIVED` → 409 `PROJECT_ARCHIVED`.

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 Viết trước ít nhất 14 test case dạng bảng.
3. 🤝 Code và test cho các endpoint node, dependency, metadata.
4. 🧠 Tự viết hàm "tính lại trạng thái con sau khi đổi cạnh". Đọc logic join trong `unlockDownstreamTasks` để làm cho giống, nhưng không sửa file đó.
5. 🧠 Viết test chứng minh `PATCH metadata` không làm đổi `version`.
6. Cập nhật integration map 4.3–4.4 (thêm `PUT/DELETE node`, `DELETE dependency`).

## Tiêu chí xong
- [ ] Test pass theo bảng ở bước 2.
- [ ] Swagger: thêm cạnh WPE-004 → WPE-001 (tạo vòng 1→2→3→4→1) → 422, `cycleNodes` có đủ 4 mã.
- [ ] Gọi `PATCH metadata` 2 lần: `version` không đổi (kiểm bằng SQL).
- [ ] Đã cập nhật integration map.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. Vì sao tọa độ không được làm tăng `version`? Kéo thả trong lúc người khác duyệt task thì chuyện gì xảy ra nếu có tăng?
2. Xóa cạnh có thể làm node tự mở khóa. Việc này có trùng trách nhiệm với C không? Ai gửi SSE?
3. Sinh mã node có race condition không? Xử lý thế nào (unique constraint và thử lại)?

## Cấm
- Sửa file ngoài mục "Được ghi". File dùng chung thì báo nhóm trước (README mục 6).
- Đọc, in, commit `.env*`, khóa, mật khẩu thật, API key. Dùng `git add -f`.
- Sửa `StateMachineService.java` (của C).
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
