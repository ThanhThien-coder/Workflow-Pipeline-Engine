# FN3 — Bảng task trong phase (Workflow) luôn tải task của dự án 1

Người làm: chưa chia (đề xuất: B, vì chung file với FB4)
Trạng thái: chờ nhóm xem
Lỗi xử lý: L27 (phát hiện khi kiểm tay 14/11)
Nhánh git: fix-fn3-kanban-projectid
Làm trước: nên gộp chung hoặc làm ngay sau FB4 (cùng sửa `usePhaseKanban.ts` và `MindmapDrawer.tsx`)

> Viết tắt như FN1.

## Lỗi người dùng thấy
- Vào tab Workflow của bất kỳ dự án nào: toast **"Failed to load phase tasks."**, bảng task trong phase trống hoặc sai.
- Network: `GET /api/v1/projects/1/my-tasks?userId=1`, `…userId=2`, `…3`, `…4` đều **403** ("Bạn không phải là thành viên của dự án này"), dù đang mở dự án 6.

## Nguyên nhân (đã đọc code)
- `FE/hooks/usePhaseKanban.ts` dòng ~24: tham số `projectId = '1'` (mặc định cứng).
- `FE/components/workflow/MindmapDrawer.tsx` dòng 99: gọi `usePhaseKanban(phase)`, **không truyền `projectId`**, nên luôn dùng `'1'`.
- `usePhaseKanban` dòng ~50–66: lấy danh sách thành viên (đang mock, userId 1–4, xem FB4) rồi gọi `getMyTasks(projectId, member.id)` cho từng người. Kết quả là 4 lời gọi vào dự án 1.
- FB4 sửa phần thành viên trong 2 file này nhưng **không nhắc lỗi `projectId`**.

## Cách sửa (đề xuất)
1. `usePhaseKanban`: bỏ giá trị mặc định `'1'`, bắt buộc truyền `projectId`. Thiếu `projectId` thì không gọi API.
2. `MindmapDrawer`: truyền `projectId` của route (lấy từ prop hoặc `useRouter`, xem `ProjectWorkspaceView` đang truyền xuống thế nào).
3. Nên đổi cách tải: thay vì gọi `my-tasks` cho từng thành viên, lấy task của phase từ `GET /projects/{id}/graph` (đã có node, `phaseId`, `assignedUserId`). Ít lời gọi hơn và không phụ thuộc danh sách thành viên. Nhóm chốt.
4. Một lời gọi lỗi thì hiện lỗi thật, không toast chung chung.

## Được sửa
- `FE/hooks/usePhaseKanban.ts`, `FE/components/workflow/MindmapDrawer.tsx` (chỉ phần truyền `projectId`), test FE
- Nếu làm bước 3: `FE/services/impl/HttpWorkflowService.ts` (chỉ phương thức mới hoặc sửa để lấy task theo phase)

## Test phải có
- `usePhaseKanban` với `projectId='6'` chỉ gọi API có `/projects/6/`, không có `/projects/1/` (trước khi sửa phải fail).
- `MindmapDrawer` truyền đúng `projectId` xuống hook.

## Kiểm bằng tay
1. Mở Workflow của một dự án đã publish (không phải dự án 1), mở một phase: thấy đúng task của phase, không có toast lỗi, Network không có `/projects/1/`.

## Kết quả (Claude ghi, dán output thật)
