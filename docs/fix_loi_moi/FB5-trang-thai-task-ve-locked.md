# FB5 — Đổi tab rồi quay lại, task bị về LOCKED

Người làm: B
Trạng thái: chưa làm
Lỗi xử lý: L14
Nhánh git: fix-fb5-trang-thai-task
Làm trước: FB3, FB4 (cùng sửa `usePhaseKanban.ts`, `MindmapDrawer.tsx`)

> Viết tắt như FB1.

## Lỗi người dùng thấy
Trong kanban của phase, kéo task sang trạng thái khác (vd Đang làm). Bấm sang tab khác rồi quay lại thì task trở về LOCKED.

## Nguyên nhân (đã đọc code)
- `FE/hooks/usePhaseKanban.ts` dòng ~118–119 và ~152–153: task có trạng thái `LOCKED` được **hiển thị thành `TODO`** (`matching.status === 'LOCKED' ? 'TODO' : ...`). Người dùng thấy task đang khóa như task làm được, kéo nó đi được.
- Cùng file, dòng ~208–262 (`moveTask`): cập nhật lạc quan vào state và cây (`updateTree`), rồi **chỉ gọi API khi `isSeededTask`** (task có trong danh sách lấy từ API). Task chỉ có trong cây (hoặc khớp theo `code`) thì không gọi API → chỉ đổi trên màn hình.
- Task LOCKED kéo sang IN_PROGRESS thì backend (máy trạng thái của C) phải từ chối; nếu không gọi API thì không ai báo lỗi.
- Đổi tab → đọc lại từ server → trạng thái thật là LOCKED.

## Cách sửa (đã chốt)
1. **Server là nguồn đúng duy nhất.** Bỏ việc đổi `LOCKED → TODO` khi hiển thị. Task LOCKED hiện với nhãn/biểu tượng khóa (cột "Chờ mở khóa" hoặc thẻ mờ trong cột To do, chọn cách ít sửa giao diện nhất) và **không kéo được**; tooltip "Task đang chờ task trước hoàn thành".
2. Mọi lần chuyển trạng thái đều gọi `workflowService.updateTaskStatus` (hoặc `submitTaskArtifact` khi cần minh chứng). Bỏ nhánh `isSeededTask` chỉ sửa cục bộ. Task không tìm thấy id thật thì báo lỗi, không đổi.
3. Sau khi API trả về: cập nhật kanban bằng task server trả; đồng bộ trạng thái node trong cây bằng `resetPhaseTree(phase.id)` (không tự `updateTree` lạc quan nữa, hoặc giữ lạc quan nhưng phải rollback khi lỗi và luôn đọc lại sau khi thành công).
4. Lỗi 409 (version), 422 (chuyển trạng thái không hợp lệ) → rollback và hiện message của backend.

## Được sửa
- `FE/hooks/usePhaseKanban.ts`, `FE/components/workflow/PhaseKanbanBoard.tsx`, `FE/components/kanban/**` (chỉ hiển thị trạng thái LOCKED, chặn kéo)
- `FE/domain/taskTransitions.ts` (nếu cần thêm luật LOCKED không kéo được)
- Test FE

## Test phải có
- Task LOCKED: hiển thị trạng thái `LOCKED`, không chuyển được (không gọi API).
- Chuyển TODO → IN_PROGRESS gọi `updateTaskStatus`; API lỗi thì trạng thái trở lại như cũ.
- Không còn chuỗi `=== 'LOCKED' ? 'TODO'` trong `usePhaseKanban.ts`.

## Kiểm bằng tay
1. Dự án đã xuất bản: task đầu (TODO) kéo sang Đang làm; sang tab Overview rồi quay lại Workflow → vẫn Đang làm.
2. Task phía sau đang LOCKED: không kéo được, có nhãn khóa.
3. Mở mindmap của phase: trạng thái node khớp kanban.

## Kết quả (Claude ghi, dán output thật)
