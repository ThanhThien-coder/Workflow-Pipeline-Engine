# T1 — Thành viên và thông tin dự án lấy từ API thật

Sửa lỗi: G5, G9
Trạng thái: đang làm
Cần có trước: không
Mở khóa: T4

## Vì sao cần task này
Ở chế độ API, thanh bên hiện 4 người giả và tên "Marketing Campaign Q4 · ACTIVE"; ô Assignee trong Node Properties liệt kê người giả, thiếu chủ dự án thật. Nguyên nhân chi tiết: `loi-dang-sua.md` mục G5, G9.

## Được đọc
- `wpe-frontend/src/**`
- `wpe-backend/src/main/java/com/pipeline/wpe/controller/ProjectMemberController.java`, `controller/ProjectController.java`, `dto/**`
- `docs/archive/sua_loi_workspace_dag/**`, `docs/fix_loi_moi/FN2-thanh-ben-du-an-ten-va-thanh-vien-gia.md`

## Được ghi
- `wpe-frontend/src/services/impl/HttpWorkflowService.ts` (chỉ `getProjectMembers`, `METHODS_STILL_MOCKED`)
- `wpe-frontend/src/views/ProjectWorkspaceView.tsx`
- `wpe-frontend/src/views/MyTasksView.tsx` (chỉ phần tên dự án)
- `wpe-frontend/src/components/mindmap/NodePropertiesModal.tsx` (chỉ ô Assignee)
- `wpe-frontend/src/store/**` (nếu cần chỗ giữ thông tin dự án + thành viên đang mở)
- Test: `wpe-frontend/src/**/__tests__/**`
- `docs/archive/sua_loi_workspace_dag/loi-dang-sua.md`, `tasks/README.md`

## Việc cần làm
1. **Thành viên thật.** `HttpWorkflowService.getProjectMembers(projectId)`: gọi `membersApi.listMembers(projectId)` (đã gọi `GET /api/v1/projects/{id}/members` thật) rồi đổi sang `UserSummary` (`id = userId`, `name = fullName || username`, `initials`, `avatarUrl`, `projectRole = role`). Bỏ `'getProjectMembers'` khỏi `METHODS_STILL_MOCKED`. Viết test trước: gọi `getProjectMembers('19')` thì `fetch` tới `/projects/19/members` và trả đúng người.
2. **Một nguồn dữ liệu dự án đang mở.** Khi vào `/project/:id/*`, `ProjectWorkspaceView` tải **một lần** `GET /projects/{id}` (tên, trạng thái, vai trò) và `getProjectMembers(id)`, lưu vào store (một slice/field `currentProject` + `currentProjectMembers`). Đang tải → khung chờ; lỗi → hiện lỗi, không hiện dữ liệu giả.
3. **Thanh bên.** `teamMembers` lấy từ danh sách thành viên ở bước 2. Tên + trạng thái lấy từ dự án ở bước 2. Xóa fallback `DEV_PERSONAS`, `'Marketing Campaign Q4'`, `'ACTIVE'` ở chế độ API.
4. **Vai trò.** `currentProjectRole` lấy từ dự án/thành viên thật. `DEV_PERSONAS` / `activePersona` / `simulatedRole` chỉ áp dụng khi chế độ mock (`VITE_USE_MOCK=true`).
5. **`MyTasksView`.** Bỏ `'Marketing Campaign Q4'`, dùng tên từ bước 2.
6. **Assignee trong Node Properties.** Xóa danh sách cứng `['Alex Kim', …]`. Danh sách = thành viên thật (bước 1), chọn theo **id** (`value = userId`, hiện tên), thêm lựa chọn "Chưa giao" (`null`). Phần lưu lên server làm ở T3 (`assignedUserId`).
7. Commit nhỏ theo từng bước (skill `commit-nho`).

## Tiêu chí xong
- Test mới cho `getProjectMembers` qua; `npm run typecheck` 0 lỗi; `npx vitest run` toàn bộ qua.
- `grep -rn "Marketing Campaign Q4" wpe-frontend/src --include=*.tsx | grep -v __tests__ | grep -v mock` → không còn kết quả.
- `METHODS_STILL_MOCKED` không còn `getProjectMembers`.
- Test tay (dự án chỉ có chủ "a"): F5 thẳng `/project/{id}/workflow` → thanh bên hiện đúng tên + trạng thái thật, Team Collaborators = 1 người là "a". Ô Assignee chỉ có "a" và "Chưa giao". Mời thêm 1 người → hiện 2.
