# S07 — Chốt quyền Viewer (chỉ xem thật sự) và thêm test API cho công cụ demo

Người làm: Người 2 (gói Nghiệp vụ backend)
Người review: Thiện
Trạng thái: chưa làm
Cần có trước: không (Bước 0 cần Thiện chốt 1 câu)
Mở khóa: không
Nhánh git: s07-viewer-chi-xem
Ước lượng: 0,5 ngày

## Vì sao cần task này (điểm sót sau TASK_68–74)
1. **Viewer chưa thật sự "chỉ xem".**
   - Khi chuyển trạng thái task, backend (`StateMachineService.updateStatus`, `submitTaskArtifact`) chỉ kiểm "có phải người được giao" hoặc "có phải chủ dự án". Viewer được giao task thì vẫn tự bắt đầu, nộp bài được.
   - Owner/Manager vẫn giao task được cho Viewer (`NodeAssignmentService`, `WorkflowGraphService.updateNode`).
   - Bảng quyền trong Settings (`rolePermissions.ts`) đang để dấu (*) "cần chốt".
2. **Công cụ demo** (`DemoToolsController`, TASK_68) mới có test ở tầng service, chưa có test tầng controller (đường dẫn, đọc body, mã lỗi HTTP).

## Đang làm gì (tóm tắt cho người đọc)
1. Theo lựa chọn của Thiện, Viewer không nhận task và không đổi trạng thái task. Khi một người bị hạ xuống Viewer, các task chưa xong của họ được gỡ người làm (giống khi bị xóa khỏi dự án).
2. Ô chọn người làm ở giao diện không liệt kê Viewer.
3. Viết test WebMvc cho `DemoToolsController`.

## Bước 0 — Thiện chốt
Viewer có được làm task được giao không?
- **(a)** Không: Viewer chỉ xem; chặn giao task cho Viewer, chặn Viewer đổi trạng thái; hạ xuống Viewer thì gỡ task chưa xong. *(Đề xuất)*
- **(b)** Có: giữ như hiện tại, chỉ sửa bảng quyền cho rõ "Viewer làm được task được giao".

`Thiện chốt: (a) Viewer chỉ xem (19/11)` (chọn b thì chỉ làm mục 4, 5 của Việc cần làm và sửa dòng bảng quyền)

## Được đọc
- `wpe-backend/src/**`, `wpe-frontend/src/**`

## Được ghi
> `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`
- `BE/service/engine/StateMachineService.java` (thêm 1 kiểm tra quyền), `BE/service/NodeAssignmentService.java`, `BE/service/WorkflowGraphService.java` (chỉ phần kiểm người được giao trong `updateNode`), `BE/service/ProjectMemberService.java` (nhánh hạ vai trò xuống VIEWER)
- `FE/components/kanban/TaskDetailModal.tsx` và `FE/components/mindmap/NodePropertiesModal.tsx` (chỉ lọc danh sách người làm), `FE/components/settings/rolePermissions.ts`
- `wpe-backend/src/test/java/com/pipeline/wpe/controller/DemoToolsControllerTest.java` (MỚI) và test liên quan
- `docs/specs/system-overview.md` hoặc chỗ đang ghi ma trận quyền (nếu có), file task này

## Đặc tả đã chốt (cho lựa chọn a)
- `StateMachineService.updateStatus` và `submitTaskArtifact`: người gọi là thành viên vai trò `VIEWER` (và không phải chủ dự án) → 403 `ACCESS_DENIED` "Viewers can't change task status." Kiểm **trước** các luật khác.
- Giao task (`NodeAssignmentService`, `WorkflowGraphService.updateNode` khi đổi `assignedUserId`): người được giao là `VIEWER` → 400 `ASSIGNEE_IS_VIEWER` "Viewers can't be assigned tasks."
- `ProjectMemberService.updateRole` sang `VIEWER`: gỡ người làm khỏi các task chưa DONE của người đó (giống `removeMember`). Response đổi vai trò giữ nguyên dạng; số task bị gỡ ghi vào log.
- Frontend: ô chọn người làm loại thành viên `projectRole === 'VIEWER'`; bảng quyền dòng "Start, return or submit a task" cột Viewer thành "–", bỏ chú thích (*).
- **Test `DemoToolsController`** (`@WebMvcTest`, mock `DemoToolsService` và `CurrentUserProvider` như các controller test khác):
  - `GET /api/v1/demo/status` → 200 `{enabled}`;
  - service ném `ResourceNotFoundException` → 404;
  - ném `ForbiddenException` → 403;
  - `force-status` body `{"status":"WRONG"}` → 400;
  - `make-overdue` → 200 có `isOverdue`;
  - không token → 401 (nếu WebMvc test hiện có cách kiểm 401).

## Việc cần làm
1. 🧠 Bước 0.
2. 🤝 Backend: 3 kiểm tra + gỡ task khi hạ vai trò, test từng nhánh.
3. 🤝 Frontend: lọc người làm, sửa bảng quyền, test.
4. 🤝 `DemoToolsControllerTest`.
5. Chạy toàn bộ test.

## Tiêu chí xong
- [ ] `./mvnw -q test` và `npx vitest run` (ổ `C:` hoa) xanh, `npx tsc -b` sạch.
- [ ] Kiểm tay (lựa chọn a):
  - đổi sarah sang VIEWER → task chưa xong của sarah thành Unassigned;
  - ô chọn người làm không có sarah;
  - gọi API đổi trạng thái bằng token sarah → 403.

## Câu hỏi bảo vệ
1. Vì sao kiểm quyền ở backend là bắt buộc dù giao diện đã ẩn nút?
2. Hạ một người xuống Viewer thì task đang làm của họ đi đâu?

## Cấm
- Đổi luật chuyển trạng thái khác. Đọc `.env*`. Tự ghi `xong`.

## Dành cho Claude (đọc trước khi làm)
- Đọc `docs/tasks/S-sau-deploy/README.md` mục 3–5. Dòng "Thiện chốt" trống thì hỏi, không tự chọn.
- Xem `BE-test/controller/` để viết WebMvc test theo đúng mẫu đang dùng (cách mock user, security).
- Làm xong: ghi chép, `chờ kiểm`, hỏi 2 câu bảo vệ.

## Ghi chép của người làm
