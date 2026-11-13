# FB3 — Subtask, node gộp, sửa/xóa node trong mindmap phải lưu qua API (ghost xóa mất subtask)

Người làm: B
Trạng thái: chưa làm
Lỗi xử lý: L15
Nhánh git: fix-fb3-subtask-api
Làm trước: không

> Viết tắt như FB1.

## Lỗi người dùng thấy
Trong mindmap của một phase: tạo subtask, sau đó thêm ghost node thì subtask biến mất. Có lúc thêm ghost thì không thêm subtask được nữa.

## Nguyên nhân (đã đọc code)
- Ở chế độ API, thêm **task gốc** và **ghost** đi qua API (`useWorkflowStore.addRootTask`, `attachGhostNode`, dòng ~270–282), sau đó gọi `resetPhaseTree(phaseId)` = đọc lại cây từ server.
- Nhưng các thao tác sau **chỉ sửa store** bằng `updateTree(...)`, không gọi API:
  - Tạo subtask / node con: qua `onUpdateNodes` → `updateTree` (`FE/components/workflow/MindmapDrawer.tsx` dòng ~366; `FE/components/mindmap/MicroGraphTree.tsx` dòng ~64–72).
  - Gộp nhiều node thành một node con (`MindmapDrawer.tsx` dòng ~185–216).
  - Lưu thuộc tính node trong `NodePropertiesModal` (`MindmapDrawer.tsx` dòng ~434–448).
- Vì vậy subtask chỉ tồn tại trong bộ nhớ trình duyệt. Thêm ghost → `resetPhaseTree` đọc lại server → subtask không có trên server nên mất.
- Backend đã có đủ API: `POST /projects/{id}/nodes`, `POST /projects/{id}/dependencies`, `DELETE /projects/{id}/dependencies`, `PUT /nodes/{id}`, `DELETE /nodes/{id}` (`WorkflowGraphController`). FE có sẵn `graph.ts` `createNode`, `createDependency`.

## Cách sửa (đã chốt)
Ở chế độ API (`graphWritesUseApi = true`), **mọi thay đổi đồ thị đi qua API rồi đọc lại cây**. Không còn sửa cây chỉ trong store.
1. Thêm action vào `useWorkflowStore` (cùng kiểu `addRootTask`):
   - `addChildTask(phaseId, parentId, title)`: `POST /nodes` (cùng phase) → `POST /dependencies` (parent → con mới) → `resetPhaseTree`.
   - `mergeIntoChild(phaseId, parentIds[], title)`: tạo node → tạo cạnh từ từng parent → `resetPhaseTree`.
   - `updateNode(phaseId, nodeId, fields)`: `PUT /nodes/{id}` (tiêu đề, mô tả, hạn, joinPolicy… theo các trường backend nhận) → `resetPhaseTree`. Người phụ trách **không** làm ở đây (FB4).
   - `deleteNode(phaseId, nodeId)`: `DELETE /nodes/{id}` → `resetPhaseTree`.
2. `MindmapDrawer`, `MicroGraphTree`, `NodePropertiesModal`: ở chế độ API gọi các action trên thay cho `updateTree`. Chế độ mock giữ nguyên.
3. Lỗi 422 (chu trình) mở modal chu trình như ghost đang làm; lỗi khác hiện toast. Không vẽ trước rồi gỡ.
4. Chỉ cập nhật cục bộ những thứ không phải dữ liệu (đang chọn node, đang mở modal).

## Được sửa
- `FE/store/useWorkflowStore.ts` (thêm action mới, không đổi action cũ)
- `FE/services/impl/http/graph.ts` (thêm hàm `updateNode`, `deleteNode` nếu chưa có), `FE/services/impl/HttpWorkflowService.ts` (thêm phương thức đồ thị tương ứng), `FE/services/contracts/IWorkflowService.ts` (thêm phương thức tùy chọn)
- `FE/components/workflow/MindmapDrawer.tsx`, `FE/components/mindmap/**`, test FE

## Test phải có
- Store: `addChildTask` gọi `createNode` rồi `createDependency` rồi đọc lại cây; sau đó `attachGhostNode` → subtask vẫn còn (vì cây đọc lại có subtask).
- `NodePropertiesModal` lưu ở chế độ API gọi `updateNode`, không gọi `updateTree`.

## Kiểm bằng tay
1. Phase bất kỳ: tạo task gốc → tạo 2 subtask → thêm ghost từ phase khác → cả 2 subtask còn.
2. F5 → vẫn còn đủ. Sửa tên subtask, F5 → tên mới. Xóa subtask, F5 → đã mất.

## Kết quả (Claude ghi, dán output thật)
