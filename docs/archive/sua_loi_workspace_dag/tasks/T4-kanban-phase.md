# T4 — Kanban của phase hiện đúng người làm, đúng trạng thái

Sửa lỗi: G10
Trạng thái: chờ làm
Cần có trước: T1 (thành viên thật), T3 (subtask có trên server)
Mở khóa: không

## Vì sao cần task này
Kanban của phase: task chưa giao hiện "Alex Kim", task LOCKED nằm ở To Do, có thẻ subtask tạm với mã WPE ngẫu nhiên đổi mỗi lần mở. Chi tiết: `loi-dang-sua.md` mục G10.

## Quyết định đã chốt (14/11/2026)
- **Task LOCKED có cột riêng "🔒 Đang khóa"**, đứng đầu bảng (trước To Do): Đang khóa · To Do · In Progress · In Review · Done. Thẻ trong cột này có dòng "Chờ k/n task trước" và **không kéo được**; cột này cũng **không nhận thả** (không kéo task về LOCKED). Task được chủ dự án mở khóa sớm (T6) rời cột này sang To Do.

## Được đọc
- `wpe-frontend/src/**`
- `wpe-backend/src/main/java/com/pipeline/wpe/controller/NodeController.java`, `controller/WorkflowGraphController.java`, `dto/**`
- `docs/archive/sua_loi_workspace_dag/**`

## Được ghi
- `wpe-frontend/src/hooks/usePhaseKanban.ts`
- `wpe-frontend/src/components/kanban/TaskCard.tsx`, `PhaseKanbanBoard.tsx`
- Test: `wpe-frontend/src/**/__tests__/**`
- `docs/archive/sua_loi_workspace_dag/loi-dang-sua.md`, `tasks/README.md`

## Việc cần làm
1. **Nguồn task.** `usePhaseKanban`: lấy task của phase từ cây đã tải từ server (`GET /projects/{id}/graph`, các node thuộc phase, không phải ghost/track) thay vì gọi `getMyTasks` cho từng thành viên. Bỏ phần trộn node cục bộ và mã `WPE-<random>`. Bỏ đoạn đổi tên → id bằng so chữ ("Sarah" → '2'…), dùng `assignedUserId` thật. Viết test trước: cây có 3 node (1 chưa giao, 1 LOCKED) → hook trả đúng 3 task, đúng `assignedUserId`, đúng trạng thái.
2. **Cột Đang khóa.** Giữ nguyên `LOCKED` trong dữ liệu (không đổi thành `TODO`). `PhaseKanbanBoard`: `COLUMNS = ['LOCKED', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']`, thêm cấu hình màu cho cột LOCKED (xám, biểu tượng khóa). Thẻ LOCKED không `draggable`; cột LOCKED không nhận `drop`. Thanh đếm phía trên thêm "k Đang khóa". Bảng 5 cột phải vừa drawer: cho cuộn ngang trong vùng bảng nếu hẹp, không vỡ bố cục.
3. **Người làm.** `TaskCard`: chưa giao (`assignedUserId` rỗng hoặc không có trong danh sách thành viên) → hiện "Chưa giao" + avatar trống. Bỏ fallback `actor`, `DEFAULT_MEMBERS`, chữ viết tắt mặc định `'AK'`.
4. Kéo thả đổi trạng thái giữ nguyên luồng hiện có (gọi API state machine), lỗi thì trả thẻ về chỗ cũ và báo.
5. Commit nhỏ theo bước.

## Tiêu chí xong
- Test mới cho `usePhaseKanban` và `TaskCard` (chưa giao, LOCKED) qua; typecheck 0 lỗi; vitest toàn bộ qua.
- `grep -n "includes('Sarah')\|includes('Marcus')\|Math.random" wpe-frontend/src/hooks/usePhaseKanban.ts` → không còn.
- Test tay: phase có task chưa giao → thẻ hiện "Chưa giao". Giao cho "a" ở Node Properties → Kanban hiện "a". Dự án DRAFT: mọi task nằm ở cột "Đang khóa", không kéo được, không thả được task khác vào cột này. Publish → task gốc hết khóa, kéo được sang In Progress. Mở lại Kanban nhiều lần → mã WPE không đổi, không có thẻ trùng.
