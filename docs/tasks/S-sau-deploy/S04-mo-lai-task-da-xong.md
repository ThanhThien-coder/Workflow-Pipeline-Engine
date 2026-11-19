# S04 — Mở lại task đã Done (làm sai muốn làm lại), xử lý artifact cũ

Người làm: Người 2 (gói Nghiệp vụ backend)
Người review: Thiện
Trạng thái: chưa làm
Cần có trước: không (Bước 0 cần Thiện chốt 1 câu)
Mở khóa: không
Nhánh git: s04-mo-lai-task
Ước lượng: 1–1,5 ngày

## Vì sao cần task này (lỗi gốc #22)
Hiện DONE là trạng thái cuối: frontend (`FE/domain/taskTransitions.ts`) và backend (`StateMachineService.updateStatus`) đều chặn mọi thay đổi. Task đã duyệt Done mà phát hiện làm sai thì không mở lại được. Câu hỏi đi kèm: artifact (minh chứng) đã nộp cho lần trước thì xử lý sao?

## Đang làm gì (tóm tắt cho người đọc)
1. Thêm thao tác **Reopen**: chỉ Owner hoặc Manager, bắt buộc nhập lý do. Task về **In Progress**, giao lại đúng người làm cũ, xóa thời điểm hoàn thành, ghi thời điểm mở lại.
2. Task phía sau đang **To Do** mà nay không còn đủ điều kiện mở khóa thì khóa lại (**Locked**). Task phía sau đã bắt đầu thì xử lý theo câu Thiện chốt ở Bước 0.
3. **Artifact cũ giữ nguyên** (vẫn trong kho, vẫn gắn task) và được đánh dấu "Before reopen". Lần nộp sau thêm artifact mới.

## Bước 0 — Thiện chốt trước khi code
Task phía sau (task con) **đã bắt đầu** (In Progress, Review hoặc Done) thì:
- **(a)** chặn mở lại: báo lỗi kèm danh sách task con đó;
- **(b)** vẫn cho mở lại, chỉ hiện cảnh báo danh sách trước khi xác nhận, task con giữ nguyên. *(Đề xuất: b)*

Ghi lựa chọn vào đây: `Thiện chốt: ___`

Rồi người làm tự đọc `BE/service/engine/StateMachineService.java` (hàm `updateStatus`, `unlockDownstreamTasks`) và `BE/service/WorkflowGraphService.java` (hàm `recomputeNodeStatus`). Trả lời: khi task cha về lại In Progress, task con TODO dùng luật nào để biết có phải khóa lại không?

## Được đọc
- `wpe-backend/src/**`, `wpe-frontend/src/**`, `docs/specs/workflow-engine.md`

## Được ghi
> `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`
- `wpe-backend/src/main/resources/db/migration/V22__node_reopened_at.sql` (MỚI; nếu `V22` đã có người dùng thì lấy số kế tiếp sau khi pull)
- `BE/entity/NodeEntity.java` (thêm `reopenedAt`), `BE/dto/response/node/KanbanTaskResponse.java`, `BE/dto/response/graph/GraphNodeResponse.java` (thêm field cuối), `BE/mapper/NodeMapper.java`
- `BE/service/engine/StateMachineService.java` (thêm hàm reopen; không đổi luật hiện có)
- `BE/controller/NodeController.java` (2 endpoint mới), DTO mới trong `BE/dto/request/node/`, `BE/dto/response/node/`
- `FE/components/kanban/TaskDetailModal.tsx`, `FE/components/kanban/ReopenTaskModal.tsx` (MỚI), `FE/services/contracts/IWorkflowService.ts` (thêm hàm tùy chọn `reopenTask?`, `getReopenImpact?`), `FE/services/impl/HttpWorkflowService.ts`, `FE/types/kanban.types.ts` (thêm `reopenedAt?`), `FE/hooks/usePhaseKanban.ts` (thêm hàm `reopenTask`), `FE/store/slices/kanbanSlice.ts` (thêm `reopenTask`), `FE/views/MyTasksView.tsx` (nối prop)
- `FE/components/settings/rolePermissions.ts` (thêm dòng "Reopen a done task": Owner, Manager)
- Test liên quan, `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md`, `docs/specs/workflow-engine.md` (thêm bước chuyển DONE → IN_PROGRESS qua Reopen)
- File task này

## Đặc tả đã chốt
- **Migration**: `ALTER TABLE node ADD COLUMN reopened_at TIMESTAMPTZ NULL;`
- **`GET /api/v1/nodes/{id}/reopen-impact`**: Owner hoặc Manager của dự án. Trả về:
  ```json
  { "taskCode": "WPE-004", "children": [ { "id": "12", "code": "WPE-007", "title": "...", "status": "TODO", "willRelock": true } ] }
  ```
  - `children` là các task con trực tiếp.
  - `willRelock = true` khi con đang TODO, không được mở khóa sớm (`forceUnlockedAt` null), và sau khi cha không còn DONE thì điều kiện hội tụ (ALL/ANY) không còn thỏa.
- **`POST /api/v1/nodes/{id}/reopen`** body `{ "reason": "...", "version": 7 }`:
  - Quyền: Owner hoặc Manager (403 `ACCESS_DENIED`). Dự án ARCHIVED → 409 `PROJECT_ARCHIVED`. Task không DONE → 409 `TASK_NOT_DONE`. `reason` rỗng → 400. Sai version → 409 `OPTIMISTIC_LOCK_CONFLICT` (như các API khác).
  - Nếu Thiện chọn (a) và có con đã bắt đầu: 409 `CHILD_TASKS_STARTED`, message kèm mã các task con.
  - Kết quả:
    - task: `status = IN_PROGRESS`, `completedAt = null`, `reopenedAt = now`, `rejectReason = reason`;
    - task con TODO có `willRelock` → LOCKED; task con khác giữ nguyên;
    - thông báo cho người làm (title "Task reopened");
    - SSE `TASK_STATUS_CHANGED` cho người làm và người duyệt, `notifyTasksChanged(..., "REOPENED")` (dùng overload có `actorUserId` nếu S01 đã xong).
  - Trả `KanbanTaskResponse` mới (có `reopenedAt`).
- **Artifact**: không xóa, không đổi `isInRepository`. Frontend hiện nhãn "Before reopen" cho artifact có `uploadedAt < reopenedAt`.
- **Velocity, %**: tự đúng vì tính từ `status` / `completedAt`; ghi chú vào báo cáo.
- **Frontend**:
  - `TaskDetailModal`: task DONE và người xem là Owner/Manager thì hiện nút **Reopen task**.
  - Bấm nút mở `ReopenTaskModal`: gọi `reopen-impact`, liệt kê task con (ghi rõ con nào sẽ bị khóa lại, con nào đã bắt đầu), ô lý do bắt buộc, nút Reopen.
  - Thành công thì cập nhật thẻ, đồ thị tự đồng bộ qua `resetPhaseTree`.
  - Task IN_PROGRESS có `reopenedAt` hiện băng "Reopened: <lý do>" thay cho "Changes requested".
- Kéo thẻ từ cột Done vẫn bị chặn; câu báo đổi thành "This task is Done. Use “Reopen task” in its details to reopen it."

## Việc cần làm
1. 🧠 Bước 0 (cần Thiện chốt a/b).
2. 🤝 Migration + entity + response (thêm field cuối, giữ constructor cũ).
3. 🤝 Service `reopenImpact`, `reopen` + test:
   - đủ các mã lỗi;
   - con TODO bị khóa lại, con ANY_COMPLETED còn cha khác DONE thì không khóa;
   - con được mở khóa sớm thì không khóa;
   - nhánh (a) hoặc (b) theo lựa chọn.
4. 🤝 Controller + WebMvc test (401/403/200).
5. 🤝 Frontend: service, hook, slice, `TaskDetailModal`, `ReopenTaskModal`, nhãn "Before reopen", băng "Reopened" + test.
6. Cập nhật tài liệu.

## Tiêu chí xong
- [ ] `./mvnw -q test` và `npx vitest run` (ổ `C:` hoa) xanh, `npx tsc -b` sạch.
- [ ] Kiểm tay trên stack thử (README mục 4), dùng công cụ demo **Complete all tasks in phase** để có task DONE:
  - Owner mở lại task cha → task về In Progress, task con TODO về Locked.
  - Người làm nhận thông báo.
  - Artifact cũ vẫn còn, có nhãn "Before reopen".
  - Collaborator không thấy nút Reopen; gọi API trực tiếp → 403.

## Câu hỏi bảo vệ
1. Vì sao không cho kéo thẻ từ Done mà phải qua nút Reopen có lý do?
2. Task con dùng OR-join (ANY_COMPLETED) có bị khóa lại khi 1 cha mở lại không? Vì sao?
3. Vì sao giữ artifact cũ thay vì xóa?

## Cấm
- Đổi luật chuyển trạng thái hiện có (TODO/IN_PROGRESS/REVIEW/DONE) ngoài thao tác Reopen mới.
- Sửa migration cũ. Đọc `.env*`. Tự ghi `xong`.

## Dành cho Claude (đọc trước khi làm)
- Đọc `docs/tasks/S-sau-deploy/README.md` mục 3–5. Test frontend chạy từ `C:\...` viết hoa.
- Nếu dòng "Thiện chốt" ở Bước 0 còn trống: DỪNG, hỏi người làm lựa chọn (a) hay (b), không tự chọn.
- Kiểm migration lớn nhất hiện có trước khi đặt tên file (`ls wpe-backend/src/main/resources/db/migration`).
- Làm theo thứ tự, test sau mỗi bước. Làm xong: ghi chép, `chờ kiểm`, hỏi 3 câu bảo vệ.

## Ghi chép của người làm
