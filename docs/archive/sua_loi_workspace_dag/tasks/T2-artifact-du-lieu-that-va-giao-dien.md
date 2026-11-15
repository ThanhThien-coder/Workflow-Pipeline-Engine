# T2 — Artifact dữ liệu thật và drawer tông sáng

Sửa lỗi: G4, G6
Trạng thái: xong, chờ test tay
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

## Kết quả (14/11/2026)
Commit trên nhánh `fix/sua-loi-workspace-dag`:
- `1af82f4` (G4) `artifactsSlice` viết lại: khởi tạo rỗng, có `projectId`, `status`, `error`; dữ liệu chỉ từ service (chế độ mock vẫn có 5 link mẫu trong `MockWorkflowService`). Mảng rỗng là kết quả hợp lệ; lỗi thì báo, không rơi về dữ liệu giả; đổi dự án xóa danh sách cũ và bỏ kết quả về muộn. `addArtifact`/`removeArtifact` chờ API xong mới đổi danh sách (id thật), lỗi thì ném. Bỏ `localStorage` và nhật ký giả `addMockAuditLog` (xóa luôn khỏi `settingsSlice` vì không còn ai dùng). `MacroWorkflow` tải artifact khi mở dự án (số trên nút đúng ngay); drawer đọc lại khi mở, bỏ đoạn tự gọi API + `setState`; có trạng thái lỗi + "Thử lại". Settings → Resources có trạng thái đang tải / lỗi / rỗng, xóa có báo lỗi.
- `20f5f43` (G6) **Nguyên nhân thật khác phân tích ban đầu**: drawer vốn là tông sáng (`bg-white/95`); các nền `slate-900/800` đều nằm sau tiền tố `dark:`. `tailwind.config.js` không khai báo `darkMode` nên Tailwind 3 mặc định `media`: máy bật chế độ tối của Windows thì các lớp `dark:` có hiệu lực, chỉ 5 file có lớp này (drawer Artifacts, hộp thêm task, thanh thêm node…) bị đen giữa app sáng. Sửa: `darkMode: 'class'` (app không bao giờ gắn class `dark`), và gỡ hết lớp `dark:` khỏi `WorkflowArtifactsDrawer`. Đã khởi động lại dev server và kiểm CSS phát ra: không còn `prefers-color-scheme: dark`.

Kiểm tra tự động: `npm run typecheck` sạch; `vitest run` 73 file / 504 test qua (test slice cũ kiểm dữ liệu giả + localStorage + nhật ký giả được thay bằng 9 test theo hành vi mới; thêm 1 test trạng thái lỗi của drawer).

Tiêu chí grep: `INITIAL_PROJECT_ARTIFACTS` chỉ còn ở `MockWorkflowService.ts` và `types`; không còn `wpe_artifacts_`. Trong drawer chỉ còn `bg-slate-900` là nền biểu tượng GitHub (logo đen trên nền sáng, cố ý).

Kiểm thử API thật: dự án mới → `GET /artifacts` trả `[]`; thêm → có trong danh sách; xóa 204 → `[]`. Dự án nháp đã xóa.

Test tay: chờ người dùng.
