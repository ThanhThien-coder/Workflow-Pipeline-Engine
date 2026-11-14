# FN2 — Mở thẳng URL dự án (hoặc F5): thanh bên hiện "Marketing Campaign Q4" và thành viên giả

Người làm: chưa chia (đề xuất: C)
Trạng thái: chờ nhóm xem
Lỗi xử lý: L26 (phát hiện khi kiểm tay 14/11; phần còn sót của L6)
Nhánh git: fix-fn2-thanh-ben-du-an
Làm trước: không. Nên làm sau FB4 nếu muốn dùng `getProjectMembers` thật.

> Viết tắt như FN1.

## Lỗi người dùng thấy
- Dán link `/project/6/overview` vào trình duyệt, hoặc đang ở trong dự án thì bấm F5:
  - Ô dự án ở thanh bên trái ghi **"Marketing Campaign Q4 · ACTIVE"**, trong khi nội dung Overview là dự án thật.
  - "Team collaborators" hiện avatar giả (AK, SC, ML, +1).
- Bấm từ Workspace vào dự án thì thanh bên đúng tên. Chỉ sai khi mở thẳng URL hoặc F5.

## Nguyên nhân (đã đọc code)
`FE/views/ProjectWorkspaceView.tsx`:
- Dòng 42: `projectName = … currentProject?.name || 'Marketing Campaign Q4'`; dòng 43: status rơi về `'ACTIVE'`. `currentProject` lấy từ `state.workspace.projects`, nhưng danh sách này **chỉ được tải ở `WorkspaceView`**. Mở thẳng URL thì danh sách rỗng, nên ra tên giả. `settings.settings` cũng chỉ có sau khi vào tab Settings.
- Dòng 36: `teamList` rơi về `DEV_PERSONAS` (người giả của chế độ dev) khi `settings.members` và `kanban.members` rỗng.
- Dòng 38 và 46: `activePersona = DEV_PERSONAS.find(...) || DEV_PERSONAS[0]` luôn có giá trị, nên trong `currentProjectRole = simulatedRole || settingsRole || overviewRole || activePersona.role || currentProject?.role`, giá trị `currentProject.role` **không bao giờ được dùng**. Vai trò có thể sai ở tab chưa tải settings/overview (vd Workflow, My Tasks).
- `FE/views/MyTasksView.tsx` dòng 110: cũng rơi về `'Marketing Campaign Q4'`.

## Cách sửa (đề xuất)
1. `ProjectWorkspaceView` khi mount (và khi `projectId` đổi): nếu `workspace.projects` chưa có dự án này thì tải thông tin dự án. Gọi `fetchProjectSettings(projectId)` hoặc `workspace.fetchProjects()`, chọn một và ghi lý do. Trong lúc tải hiện "Đang tải…" ở ô dự án, **bỏ chuỗi cứng** `'Marketing Campaign Q4'` và `'ACTIVE'`. Tải lỗi thì hiện lỗi, không hiện tên giả.
2. `teamList`: ở chế độ API thì lấy thành viên thật (`getProjectMembersDetailed(projectId)`, đã gọi API thật). Chỉ dùng `DEV_PERSONAS` khi `isMockMode`.
3. `currentProjectRole`: trong chế độ API thì bỏ `activePersona.role` khỏi chuỗi ưu tiên, dùng `settingsRole || overviewRole || currentProject.role`. Chưa biết thì coi như quyền thấp nhất (ẩn nút của owner), không mặc định `'OWNER'`.
4. `MyTasksView` dòng 110: bỏ chuỗi cứng, dùng tên đã tải ở bước 1.

## Được sửa
- `FE/views/ProjectWorkspaceView.tsx`, `FE/views/MyTasksView.tsx` (chỉ dòng tên dự án), `FE/store/slices/workspaceSlice.ts` (chỉ thêm hàm tải một dự án nếu cần), test FE

## Test phải có
- Render `ProjectWorkspaceView` với `projectId='6'`, store workspace rỗng, service trả dự án "Du an Mau FC5": thanh bên hiện "Du an Mau FC5", không có "Marketing Campaign Q4" (trước khi sửa phải fail).
- Chế độ API: team list không chứa người trong `DEV_PERSONAS`.
- Vai trò: không có settings và overview, `currentProject.role = 'COLLABORATOR'` thì không hiện nút chỉ dành cho owner.

## Kiểm bằng tay
1. Đăng nhập, dán thẳng `/project/{id}/overview`: thanh bên đúng tên và trạng thái, team đúng người thật.
2. Ở tab Workflow hoặc My Tasks, bấm F5: tên vẫn đúng.
3. Thành viên không phải owner mở thẳng URL: không thấy nút chỉ dành cho owner.

## Kết quả (Claude ghi, dán output thật)
