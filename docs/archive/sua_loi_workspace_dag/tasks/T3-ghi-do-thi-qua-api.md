# T3 — Mọi thao tác sửa cây task đi qua API; khóa ô khi chỉ xem

Sửa lỗi: G7, G8, G11
Trạng thái: xong, chờ test tay
Cần có trước: không (ô Assignee chọn theo id cần T1 bước 6; làm T1 trước thì tốt hơn)
Mở khóa: T4

## Vì sao cần task này
Subtask tạo bằng (+) chỉ nằm trên trình duyệt (id `task-…`, mã WPE ngẫu nhiên): gắn ghost vào subtask báo "chưa được lưu", gắn vào task gốc thì subtask biến mất. Node Properties cho chọn trạng thái tùy ý và lưu chỉ trên trình duyệt. Người không phải chủ vẫn gõ được vào các ô. Chi tiết: `loi-dang-sua.md` mục G7, G8, G11.

## Quyết định đã chốt
- **Subtask = task thường** (chốt 14/11/2026): `POST /projects/{id}/nodes` (cùng phase) + `POST /projects/{id}/dependencies` (cha → con). BE, DB giữ nguyên.
- **Track** (node `isTrack` tạo bằng nút thêm track): cũng là task thường không có cha (`POST /nodes`), như "+ Add Root Task".
- **Trạng thái** không sửa trong Node Properties. Chỉ đổi qua Kanban/hành động theo state machine của BE (`UpdateNodeRequest` cũng không có trường `status`).

## Được đọc
- `wpe-frontend/src/**`
- `wpe-backend/src/main/java/com/pipeline/wpe/controller/WorkflowGraphController.java`, `service/WorkflowGraphService.java`, `dto/request/graph/**`
- `docs/archive/sua_loi_workspace_dag/**`, `docs/fix_loi_moi/FB3-subtask-ghost-node-goi-api.md`

## Được ghi
- `wpe-frontend/src/services/impl/http/graph.ts` (thêm `updateNode`, `deleteNode`, `deleteDependency` nếu chưa có)
- `wpe-frontend/src/services/impl/HttpWorkflowService.ts` (phần đồ thị), `wpe-frontend/src/services/contracts/IWorkflowService.ts`
- `wpe-frontend/src/services/MockWorkflowService.ts` (chỉ để khớp interface mới)
- `wpe-frontend/src/store/useWorkflowStore.ts` (action đồ thị)
- `wpe-frontend/src/components/mindmap/MindmapTree.tsx`, `MicroGraphTree.tsx`, `NodePropertiesModal.tsx`
- `wpe-frontend/src/components/workflow/MindmapDrawer.tsx`
- Test: `wpe-frontend/src/**/__tests__/**`
- `docs/archive/sua_loi_workspace_dag/loi-dang-sua.md`, `tasks/README.md`

## Việc cần làm
1. **API FE.** Trong `graph.ts`: `updateNode(nodeId, body: { title, description, joinPolicy, assignedUserId, dueDate, version })` → `PUT /nodes/{id}`; `deleteNode(nodeId)` → `DELETE /nodes/{id}`; `deleteDependency(projectId, parentId, childId)` → `DELETE /projects/{id}/dependencies`. Kiểm đúng body/query với controller BE trước khi viết.
2. **Store.** Thêm action (chỉ chế độ API, giống `addRootTask`):
   - `addChildTask(phaseId, parentId, title)`: `createNode` → `createDependency(parent, newId)` → `resetPhaseTree`. Lỗi bước 2 thì xóa node vừa tạo (`deleteNode`) rồi báo lỗi.
   - `addTrack(phaseId, title)`: `createNode` → `resetPhaseTree`.
   - `updateNodeInfo(phaseId, nodeId, patch)`: `updateNode` (gửi `version` đang giữ; 409 → báo "Task đã bị người khác sửa, tải lại") → `resetPhaseTree`.
   - `removeNode(phaseId, nodeId)`: `deleteNode` → `resetPhaseTree` (BE chỉ cho xóa LOCKED/TODO; lỗi thì báo).
   Viết test trước cho từng action (mock service): đúng thứ tự gọi API, lỗi thì không đổi cây.
3. **Canvas.** `MindmapTree.handleAddChild` và `addTrack`: ở chế độ API gọi action bước 2 (truyền qua prop như `onAddRootTask`), hiện hộp nhập tên trước khi tạo; không gọi `createNewBranchNode`/`onUpdateNodes`. Chế độ mock giữ cách cũ.
4. **Gộp node** (`MindmapDrawer` ~185–216): chế độ API làm bằng chuỗi `createNode` + `createDependency`; nếu quá phức tạp thì **ẩn** nút gộp ở chế độ API và ghi rõ trong `loi-dang-sua.md`.
5. **Node Properties (G8, phần lưu).** Bỏ ô sửa Status (tạm hiện nhãn trạng thái; bố cục mới, nút hành động và mở khóa sớm làm ở **T6**). Bỏ đoạn tự đặt tiến độ theo trạng thái. `onSave` gọi `updateNodeInfo`; Delete Node gọi `removeNode`. Assignee gửi `assignedUserId` (id thật từ T1, "Chưa giao" = `null`). Deadline gửi ISO.
6. **Chỉ xem (G11).** Khi `readOnly`: mọi input/select/textarea/date `disabled`, kiểu xám; tiêu đề "Chi tiết task"; dòng "Chỉ chủ dự án được sửa đồ thị" lên đầu hộp; ẩn Delete Node. Rà nút (+), kéo nối, Add Root Task, Add Ghost Node: ẩn hoặc `disabled` khi không có quyền.
7. Commit nhỏ theo bước.

## Tiêu chí xong
- Test mới cho các action store + `NodePropertiesModal` chế độ chỉ xem (mọi ô `disabled`) qua; typecheck 0 lỗi; vitest toàn bộ qua.
- `grep -n "createNewBranchNode" wpe-frontend/src/components/mindmap/MindmapTree.tsx` → chỉ còn trong nhánh mock.
- Test tay (chủ dự án): thêm 2 subtask dưới một task → F5 vẫn còn, có mã WPE thật, DB `node` có 2 dòng mới và `node_dependency` có cạnh cha → con. Gắn ghost vào subtask → thành công. Gắn ghost vào task gốc → subtask **không** mất. Sửa tên/assignee/deadline/join logic → F5 vẫn giữ. Không còn ô Status để sửa.
- Test tay (thành viên không phải chủ): mở Node Properties → không gõ/chọn được ô nào; không thấy nút (+), Add Root Task, Add Ghost Node, Delete Node.

## Kết quả (14/11/2026)
Commit trên nhánh `fix/sua-loi-workspace-dag`:
- `a0d826b` (BE) `UpdateNodeRequest` thêm `clearAssignee`, `clearDueDate`: trước đây không có cách bỏ người phụ trách / hạn chót (null = giữ nguyên). Giữ constructor 8 tham số cũ cho tương thích. 2 test mới trong `WorkflowGraphServiceTest`.
- `aa9c63a` (FE service + mapper) `graph.ts` thêm `updateNode`, `deleteNode`; `HttpWorkflowService` thêm `addChildTask` (POST /nodes + POST /dependencies từ từng cha; nối lỗi thì xóa node vừa tạo), `updateTaskNode` (PUT kèm version đang giữ), `deleteTaskNode`. **Mapper `toPhaseTree` vẽ cạnh cùng phase**: task con treo dưới task cha (trước đây mọi task treo dưới root nên subtask đã lưu vẫn hiện phẳng).
- `84848c7` (FE store) action `addChildTask`, `updateNodeInfo`, `removeNode` (gọi API rồi đọc lại cây). `selectCanEditGraph` lấy vai trò cả từ thông tin dự án tải lúc vào dự án (slice `project` của T1): thành viên không phải owner bị khóa ngay, không cần vào tab Settings trước (nguyên nhân gốc của G11).
- `5db1482` (FE giao diện):
  - (+) trên task → hộp "Thêm subtask" → API. Chọn ≥ 2 task → "Tạo task hội tụ" → API (1 node + dây từ mọi task đã chọn).
  - Nhấp đúp đổi tên trên thẻ giờ lưu được (API; chế độ mock sửa cây). Trước đây tên mới bị bỏ ở cả hai chế độ.
  - Xóa task (nút trên thẻ, Delete Node) → `DELETE /nodes/{id}`. Chỉ xóa task đó; task con của nó lên làm task gốc (backend không xóa dây chuyền).
  - Node Properties: bỏ ô chọn Status và đoạn tự đặt tiến độ (chỉ còn nhãn trạng thái); Save → `PUT /nodes/{id}` (tên, mô tả, join logic, người làm theo id, hạn chót; "Chưa giao"/xóa ngày → clear). Chỉ xem: mọi ô bị khóa (`fieldset disabled`), tiêu đề "Chi tiết task", dòng báo lên đầu, ẩn Save/Delete.
  - `AddRootTaskModal` nhận `heading`/`description`/`placeholder` để dùng lại.

Kiểm tra tự động: FE `npm run typecheck` sạch, `vitest run` 73 file / 499 test qua (thêm 25 test). BE `./mvnw test` 612 test, BUILD SUCCESS.

Kiểm thử API thật (backend đã khởi động lại): tạo task cha + con, POST dependency 201, PUT giao người + hạn chót (version 0→1), PUT `clearAssignee`/`clearDueDate` → cả hai null, graph có cạnh cha → con, DELETE task 204. Dự án nháp đã xóa.

Ghi chú phát hiện thêm (chưa sửa):
- `components/workflow/PhaseDetailGraphView.tsx` + `components/mindmap/MicroGraphTree.tsx` không còn được dùng ở đâu (code chết, vẫn ghi cây cục bộ).
- Header drawer phase ghi cứng "Marketing Q4 › Workflow › …" (`MindmapDrawer.tsx`), cùng loại lỗi tên giả G5.
- BE `WorkflowGraphController`: khi không có người gọi, `currentUserProvider.getCurrentUserId().orElse(2L)` (rơi về user 2) — nên kiểm lại cấu hình bảo mật có chặn request không đăng nhập hay không.

Test tay: chờ người dùng.
