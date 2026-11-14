# T3 — Mọi thao tác sửa cây task đi qua API; khóa ô khi chỉ xem

Sửa lỗi: G7, G8, G11
Trạng thái: chờ làm
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
