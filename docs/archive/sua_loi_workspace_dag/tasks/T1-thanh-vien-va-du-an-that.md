# T1 — Thành viên và thông tin dự án lấy từ API thật

Sửa lỗi: G5, G9
Trạng thái: xong, chờ test tay
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

## Kết quả (14/11/2026)
Commit trên nhánh `fix/sua-loi-workspace-dag`:
- `b0ed466` getProjectMembers gọi `GET /projects/{id}/members` thật, bỏ khỏi `METHODS_STILL_MOCKED`.
- `a598447` khôi phục `services/impl/http/__tests__/members.test.ts` (commit trước lỡ ghi đè), test mới của T1 nằm ở `projectMembers.test.ts`.
- `f4521f3` slice `project` (`store/slices/projectSlice.ts`): tải thông tin dự án + thành viên một lần khi vào `/project/:id`. Thanh bên, thanh trên (tên người dùng, vai trò) dùng dữ liệu thật; `DEV_PERSONAS`/`simulatedRole` chỉ dùng khi `VITE_USE_MOCK=true`. Bỏ "Marketing Campaign Q4"/"ACTIVE" (thanh bên, MyTasksView). Đang tải → "Đang tải…", lỗi → "Không tải được dự án".
- `6ad7840` ô Người làm chọn theo id thành viên thật + "Chưa giao" (giữ người đã rời dự án nếu đang được giao); thẻ task hiện tên thay vì id (`utils/memberLookup.ts`).

Kiểm tra tự động: `npm run typecheck` sạch; `vitest run` 69 file / 474 test qua (thêm 13 test: `projectMembers`, `projectSlice`, `ProjectWorkspaceView`, `NodePropertiesModal.assignee`, `BranchCard.assignee`).

Tiêu chí grep: "Marketing Campaign Q4" chỉ còn ở `placeholder` của ô nhập tên trong Settings; `METHODS_STILL_MOCKED` chỉ còn `updateProjectSettings`.

Còn lại ngoài phạm vi T1 (chưa có task):
- `components/common/GlobalProfileMenu.tsx` dòng 19: mặc định `displayName = 'Alex Kim'`.
- `components/workspace/WorkspaceView.tsx` dòng 114–115: màn All Pipelines rơi về 'Alex Kim' / 'alex.kim@pipeline.engine' khi chưa có người dùng.
(`TaskCard`/`usePhaseKanban` → T4; `addMockAuditLog` trong artifact → T2.)

Lưu ý: lưu thông tin node lên server (tên, người làm…) vẫn chỉ ở trình duyệt cho tới T3.

Test tay: chờ người dùng.
