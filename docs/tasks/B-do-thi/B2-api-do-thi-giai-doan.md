# B2 — API đồ thị: đọc toàn bộ đồ thị và quản lý giai đoạn (Cụm 4.1, 4.2)

Người làm: B
Người review: C
Trạng thái: chưa làm
Cần có trước: B1
Cần trước bước frontend: không
Mở khóa: B3
Nhánh git: b2-graph-phases
Ước lượng: 1,5 ngày

## Vì sao cần task này
- Canvas Macro/Mindmap trên FE đang chạy bằng mock. Backend chưa có API đồ thị nào.
- DB chỉ có `work_phase.parent_phase_id`, tức mỗi phase có tối đa 1 cha. Trong khi FE cho một phase nhiều cha (`parentPhaseIds`; mock có phase `p3` với 2 cha `p2a`, `p2b`) và cần lưu tọa độ x, y, w, h của phase.

## Kiến thức phải nắm
Quan hệ nhiều-nhiều tự tham chiếu, migration Flyway có chuyển dữ liệu cũ, JSONB, DTO record lồng nhau, lỗi N+1 query.

## Bước 0 — Tự đọc, không dùng AI
Đọc: integration map 4.1, 4.2; các bảng WORK_PHASE, NODE, NODE_DEPENDENCY trong `docs/specs/database-schema.md`; `BE/entity/WorkPhaseEntity.java`, `NodeEntity.java`, `NodeDependencyEntity.java` cùng các repository tương ứng; `MacroPhase` trong `FE/types/workflow.types.ts`; các hàm `getMacroPhases`, `getPhaseEdges`, `connectPhases`, `deletePhase` trong `FE/services/MockWorkflowService.ts`.
Trả lời:
1. Vì sao một cột `parent_phase_id` không biểu diễn được phase có 2 cha? Bảng mới giải quyết thế nào?
2. Xóa một phase thì node của phase đó ra sao (FK `ON DELETE SET NULL` trong V1)? Node "độc lập" (`phase_id` NULL, `workflow-engine.md` mục 3.3) nghĩa là gì?
3. Viết câu SQL lấy toàn bộ đồ thị một dự án trong tối đa 4 truy vấn (không N+1).

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `wpe-backend/src/**`, `FE/**`, `docs/**`

## Được ghi
- `wpe-backend/src/main/resources/db/migration/V7__phase_dependency_and_ui_metadata.sql` (số V7 đã cấp cho B)
- `BE/entity/PhaseDependencyEntity.java` (mới), `BE/entity/WorkPhaseEntity.java`
- `BE/repository/PhaseDependencyRepository.java` (mới); `WorkPhaseRepository.java`, `NodeRepository.java`, `NodeDependencyRepository.java` (chỉ thêm method)
- `BE/controller/GraphController.java` (mới), `BE/service/graph/**` (mới), `BE/dto/request/graph/**`, `BE/dto/response/graph/**` (mới)
- `BE-test/**/graph/**` (test mới)
- `docs/specs/database-schema.md` (WORK_PHASE và bảng mới), `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md` (4.1–4.2), `docs/tasks/B-do-thi/B2-api-do-thi-giai-doan.md`

## Đặc tả đã chốt
- V7:
  - Tạo bảng `phase_dependency (id BIGSERIAL PRIMARY KEY, project_id BIGINT NOT NULL REFERENCES project(id) ON DELETE CASCADE, parent_phase_id BIGINT NOT NULL REFERENCES work_phase(id) ON DELETE CASCADE, child_phase_id BIGINT NOT NULL REFERENCES work_phase(id) ON DELETE CASCADE, CONSTRAINT uq_phase_dependency UNIQUE (parent_phase_id, child_phase_id), CONSTRAINT chk_diff_phases CHECK (parent_phase_id <> child_phase_id))`.
  - Chuyển dữ liệu cũ: `INSERT INTO phase_dependency (project_id, parent_phase_id, child_phase_id) SELECT project_id, parent_phase_id, id FROM work_phase WHERE parent_phase_id IS NOT NULL;`
  - `ALTER TABLE work_phase ADD COLUMN ui_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;`
  - **Giữ** cột `parent_phase_id` (không xóa để khỏi vỡ code khác), nhưng code mới không dùng. Ghi chú điều này trong `database-schema.md`.
- `GET /api/v1/projects/{id}/graph` (thành viên, dùng `verifyProjectMemberOrOwner`) trả về:
  `{ phases: [{ id, name, sub, accent, orderIndex, parentPhaseIds, uiMetadata, status, pct }], phaseEdges: [[parentId, childId]], nodes: [{ id, phaseId, code, title, status, joinPolicy, assignedUserId, dueDate, version, uiMetadata }], dependencies: [{ parentNodeId, childNodeId }] }`. Mọi id dạng chuỗi.
  - `pct` = số node DONE / tổng số node của phase, làm tròn ra phần trăm.
  - `status` của phase: không có node → `TODO`; mọi node DONE → `COMPLETED`; mọi node LOCKED → `LOCKED`; có ít nhất 1 node IN_PROGRESS, REVIEW hoặc DONE → `IN_PROGRESS`; còn lại → `TODO`.
- `POST /api/v1/projects/{id}/phases`, body `{ name, sub?, accent?, parentPhaseId?, orderIndex?, uiMetadata? }` → 201. Có `parentPhaseId` thì tạo luôn cạnh phase.
- `PUT /api/v1/projects/{id}/phases/{phaseId}`, body `{ name?, sub?, accent?, orderIndex?, uiMetadata? }` → 200.
- `DELETE /api/v1/projects/{id}/phases/{phaseId}` → 204. Node của phase đó chuyển thành độc lập (`phase_id = NULL`); cạnh phase tự xóa theo cascade.
- `POST /api/v1/projects/{id}/phase-edges`, body `{ parentPhaseId, childPhaseId }` → 201. Trùng → 409 `EDGE_EXISTS`. Tạo vòng giữa các phase (kiểm bằng `DagValidator.wouldCreateCycle`) → 422 `CYCLE_DETECTED`, `cycleNodes` là tên phase.
- `DELETE /api/v1/projects/{id}/phase-edges?parentPhaseId=&childPhaseId=` → 204.
- Mọi thao tác ghi chỉ OWNER được làm (`verifyProjectOwner`, UC10). Dự án `ARCHIVED` → 409 `PROJECT_ARCHIVED`.
- Lỗi chu trình dùng `CycleDetectedException(message, cycleNodes)` có sẵn. Cần sửa handler cũ thì báo A.

## Việc cần làm
1. 🧠 Bước 0. 🧠 Tự viết V7, Claude review.
2. 🧠 Viết trước ít nhất 10 test case dạng bảng: đọc đồ thị seed; phase nhiều cha; tạo, sửa, xóa phase; xóa phase còn node; cạnh trùng; cạnh tạo vòng; không phải owner; dự án ARCHIVED…
3. 🤝 Entity, repository, service, controller, DTO và test.
4. 🧠 Đếm số câu SQL khi gọi `GET graph`: bật `spring.jpa.show-sql` trên máy bạn (không commit) và ghi số đếm được.
5. Cập nhật `database-schema.md` và integration map 4.1–4.2 (thêm `phase-edges`, `PUT phase`).

## Tiêu chí xong
- [ ] V7 chạy được trên DB có sẵn (dán log Flyway).
- [ ] `GET /api/v1/projects/1/graph` trả 3 phase, 4 node, 3 dependency của seed. `phaseEdges` của seed rỗng, vì seed không có `parent_phase_id`. Đối chiếu bằng SQL trong DBeaver.
- [ ] Test BE pass theo bảng ở bước 2. `GET graph` dùng tối đa 5 câu SQL (ghi số thật).
- [ ] Đã cập nhật integration map và `database-schema.md`.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. Vì sao giữ cột `parent_phase_id` thay vì xóa?
2. Áp quy tắc tính status phase: phase có node LOCKED và node TODO thì ra gì, vì sao?
3. N+1 query là gì? Bạn tránh nó thế nào trong `GET graph`?

## Cấm
- Sửa file ngoài mục "Được ghi". File dùng chung thì báo nhóm trước (README mục 6).
- Đọc, in, commit `.env*`, khóa, mật khẩu thật, API key. Dùng `git add -f`.
- Sửa migration đã có (V1–V4, và migration người khác đã merge).
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
