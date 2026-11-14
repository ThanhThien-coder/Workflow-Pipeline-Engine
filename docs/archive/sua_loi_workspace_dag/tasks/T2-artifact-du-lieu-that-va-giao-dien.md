# T2 — Artifact dữ liệu thật và drawer tông sáng

Sửa lỗi: G4, G6
Trạng thái: chờ làm
Cần có trước: không
Mở khóa: không

## Vì sao cần task này
Nút Artifacts hiện 5 (giả), bấm vào về 0; Settings → Project Resources hiện 5 link giả; thêm/xóa lỗi API không báo; drawer nền đen khó nhìn. Chi tiết: `loi-dang-sua.md` mục G4, G6.

## Được đọc
- `wpe-frontend/src/**`
- `wpe-backend/src/main/java/com/pipeline/wpe/controller/*Artifact*`, `dto/**`
- `docs/archive/sua_loi_workspace_dag/**`

## Được ghi
- `wpe-frontend/src/store/slices/artifactsSlice.ts`
- `wpe-frontend/src/components/workspace/WorkflowArtifactsDrawer.tsx`, `WorkflowArtifactsIsland.tsx`
- `wpe-frontend/src/hooks/useProjectArtifacts.ts`, `wpe-frontend/src/components/settings/ProjectResourcesSection.tsx`
- `wpe-frontend/src/components/workflow/MacroWorkflow.tsx` (chỉ gọi tải artifact khi mở dự án)
- `wpe-frontend/src/types/artifact.types.ts` (chỉ nếu dời `INITIAL_PROJECT_ARTIFACTS` về mock)
- Test: `wpe-frontend/src/**/__tests__/**`
- `docs/archive/sua_loi_workspace_dag/loi-dang-sua.md`, `tasks/README.md`

## Việc cần làm
1. **Slice.** `artifacts`: `items: []`, thêm `projectId: string | null`, `isLoading`, `error: string | null`. Bỏ `getInitialItems`, `localStorage`, `INITIAL_PROJECT_ARTIFACTS` khỏi slice (dữ liệu giả chỉ còn trong `MockWorkflowService`). Viết test trước: service trả `[]` → `items` là `[]` (không phải 5).
2. **`loadArtifacts(projectId)`.** Gọi `workflowService.getProjectArtifacts`; mảng rỗng là hợp lệ. Lỗi → `error`, `items` giữ `[]`. Đổi dự án → xóa `items` cũ trước khi tải.
3. **`addArtifact` / `removeArtifact`.** Thành `async`: `await` API, dùng artifact BE trả về (id thật) để thêm; xóa xong mới bỏ khỏi danh sách. Lỗi → ném lỗi để UI hiện toast, không đổi danh sách. Bỏ `.catch(() => {})`. Bỏ ghi audit giả `addMockAuditLog` ở chế độ API.
4. **Tải khi mở dự án.** `MacroWorkflow` gọi `loadArtifacts(projectId)` khi `projectId` đổi, để số trên nút đúng ngay. `WorkflowArtifactsDrawer` bỏ đoạn tự `fetch` + `useWorkflowStore.setState`, dùng `loadArtifacts`. Settings (`useProjectArtifacts`) giữ gọi `loadArtifacts`.
5. **Giao diện drawer (G6).** Thay toàn bộ nền `bg-slate-900/800…` bằng tông sáng như `ProjectResourcesSection`: nền trắng, viền `slate-200`, tiêu đề `slate-900`, chữ phụ `slate-500`, nút chính indigo/purple. Mỗi artifact một dòng: biểu tượng, tên, url rút gọn, ngày thêm, nút sao chép / mở tab mới / xóa (xóa chỉ khi có quyền). Có 3 trạng thái: đang tải, rỗng ("Chưa có tài nguyên nào"), lỗi (kèm nút thử lại).
6. Commit nhỏ: dữ liệu (bước 1–4) và giao diện (bước 5) tách commit.

## Tiêu chí xong
- Test mới cho slice (rỗng, lỗi, thêm, xóa) qua; typecheck 0 lỗi; vitest toàn bộ qua.
- `grep -rn "INITIAL_PROJECT_ARTIFACTS\|wpe_artifacts_" wpe-frontend/src --include=*.ts --include=*.tsx | grep -v __tests__` → chỉ còn trong `MockWorkflowService.ts` / `types`.
- `grep -n "bg-slate-9\|bg-slate-8" wpe-frontend/src/components/workspace/WorkflowArtifactsDrawer.tsx` → không còn.
- Test tay: dự án mới → nút Artifacts hiện **0**, Settings → Resources hiện trạng thái rỗng. Thêm 1 link → nút hiện 1, F5 vẫn 1, DB bảng `artifacts` có 1 dòng. Xóa → 0. Tắt backend rồi thêm → hiện lỗi, không thêm vào danh sách.
