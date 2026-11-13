# FB4 — Giao task cho thành viên thật (bỏ danh sách thành viên giả)

Người làm: B
Trạng thái: chưa làm
Lỗi xử lý: L13
Nhánh git: fix-fb4-thanh-vien-that
Làm trước: không. Kiểm bằng tay cần meomeo đã là thành viên (chấp nhận lời mời bằng Swagger `POST /invitations/{id}/accept` nếu FC3 chưa xong).

> Viết tắt như FB1.

## Lỗi người dùng thấy
Danh sách người để giao task là tên giả (Sarah, Marcus, Jamie…). Thành viên thật như meomeo không có, nên không giao task được và không test được luồng làm task.

## Nguyên nhân (đã đọc code)
- `FE/services/impl/HttpWorkflowService.ts` dòng 56 và 182–183: `getProjectMembers` vẫn nằm trong `METHODS_STILL_MOCKED`, trả mock.
- `FE/hooks/usePhaseKanban.ts` dòng ~121–125: đổi tên người phụ trách sang id bằng chuỗi cứng (`'Sarah' → '2'`, `'Marcus' → '3'`, `'Jamie' → '4'`).
- `FE/components/mindmap/NodePropertiesModal.tsx` dòng 29–55: chọn người phụ trách theo **tên**, lưu chỉ sửa store (xem FB3).
- Backend đã có: `GET /api/v1/projects/{projectId}/members` (`ProjectMemberController`), `PATCH /api/v1/nodes/{id}/assignment` (`NodeAssignmentController`). FE đã có `FE/services/impl/http/members.ts`, `FE/services/impl/http/assignment.ts`.

## Cách sửa (đã chốt)
1. `getProjectMembers(projectId)` gọi `GET /projects/{id}/members` (dùng lại `members.ts`), trả `UserSummary[]` gồm **cả owner**. Nếu API thành viên không trả owner thì ghép thêm owner từ `GET /projects/{id}`. Xóa khỏi `METHODS_STILL_MOCKED`. Chỉ lấy thành viên đang hiệu lực, bỏ VIEWER nếu backend không cho giao task cho VIEWER (kiểm `NodeAssignmentService`).
2. Người phụ trách xử lý theo **userId**, không theo tên:
   - `NodePropertiesModal` dropdown dùng `members` (id + tên hiển thị), giá trị là `userId`; "Chưa giao" = `null`.
   - Lưu: đổi người phụ trách thì gọi `PATCH /nodes/{id}/assignment` rồi đọc lại cây (`resetPhaseTree`) và danh sách task kanban.
   - Xóa đoạn đổi tên cứng `Sarah/Marcus/Jamie` trong `usePhaseKanban.ts`; lấy `assignedUserId` từ dữ liệu API.
3. Lỗi 403/409/422 từ API giao task hiện toast với message của backend.

## Được sửa
- `FE/services/impl/HttpWorkflowService.ts` (chỉ `getProjectMembers`, `updateTaskAssignment` nếu cần, dòng `getProjectMembers` trong `METHODS_STILL_MOCKED`)
- `FE/services/impl/http/members.ts`, `FE/services/impl/http/assignment.ts`
- `FE/hooks/usePhaseKanban.ts`, `FE/components/mindmap/NodePropertiesModal.tsx`, `FE/components/workflow/MindmapDrawer.tsx` (chỉ phần truyền members, lưu người phụ trách), `FE/store/slices/kanbanSlice.ts` (chỉ `loadMembers` nếu cần)
- Test FE

## Test phải có
- `getProjectMembers` gọi đúng endpoint, có owner, không còn trong danh sách mock.
- Chọn người phụ trách gọi `PATCH /nodes/{id}/assignment` với đúng `userId`.
- Không còn chuỗi `'Marcus'`, `'Jamie'` trong `usePhaseKanban.ts`.

## Kiểm bằng tay
1. alex mời meomeo, meomeo chấp nhận.
2. alex mở một task → dropdown người phụ trách có alex, sarah, meomeo (đúng thành viên dự án).
3. Giao task cho meomeo, F5 → vẫn là meomeo. Đăng nhập meomeo → My Tasks thấy task đó.

## Kết quả (Claude ghi, dán output thật)
