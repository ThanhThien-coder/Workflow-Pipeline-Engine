# FB6 — Artifact và Project resources dùng dữ liệu thật (F5 hiện số 5)

Người làm: B
Trạng thái: chưa làm
Lỗi xử lý: L9, L12
Nhánh git: fix-fb6-artifact-that
Làm trước: không

> Viết tắt như FB1.

## Lỗi người dùng thấy
- F5 trang dự án: nút artifact hiện số **5**; bấm vào thì danh sách "reset" về đúng.
- Settings → Project resources hiện tài nguyên giả.

## Nguyên nhân (đã đọc code)
- `FE/store/slices/artifactsSlice.ts`:
  - Dòng ~47: state khởi tạo `items: getInitialItems('1')` → không có localStorage thì trả `INITIAL_PROJECT_ARTIFACTS` (**5 mục giả**). Đây là số 5 lúc F5.
  - `loadArtifacts` (dòng ~50–73): API trả **mảng rỗng** hoặc lỗi thì rơi về `getInitialItems(projectId)` = localStorage hoặc mock. Dự án thật chưa có artifact vẫn hiện mock.
  - `addArtifact` / `removeArtifact`: thêm vào store và **localStorage** trước, gọi API sau (không chờ, không rollback).
- `FE/components/workspace/WorkflowArtifactsIsland.tsx` dòng 17–20: đếm `artifacts.items.length` từ store.
- `FE/components/settings/ProjectResourcesSection.tsx` dùng `useProjectArtifacts` nên cũng hiện mock.
- `FE/hooks/useProjectArtifacts.ts`: mặc định `projectId = '1'`.
- Backend đã có `ArtifactController` dưới `/api/v1/projects/{projectId}/artifacts` (GET danh sách, POST, DELETE, PATCH `/repository`).

## Cách sửa (đã chốt)
1. Ở chế độ API: state khởi tạo `items: []`, thêm `loadedProjectId` và `isLoading`. Không đọc/ghi localStorage, không dùng `INITIAL_PROJECT_ARTIFACTS` (mock giữ nguyên hành vi cũ).
2. `loadArtifacts(projectId)`: đặt `isLoading`, xóa items của dự án cũ; API trả gì hiện đúng thế (rỗng thì rỗng). Lỗi → `error` + toast, không rơi về mock.
3. `addArtifact`/`removeArtifact`: gọi API, thành công mới cập nhật store (hoặc đọc lại danh sách). Lỗi → toast.
4. Island chỉ hiện số khi đã tải xong dự án hiện tại (`loadedProjectId === projectId`), đang tải thì hiện chấm/spinner.
5. Bỏ mặc định `projectId = '1'` trong `useProjectArtifacts` và `ProjectResourcesSection`: bắt buộc truyền `projectId` từ route.

## Được sửa
- `FE/store/slices/artifactsSlice.ts`, `FE/hooks/useProjectArtifacts.ts`
- `FE/components/workspace/WorkflowArtifactsIsland.tsx`, `FE/components/workspace/WorkflowArtifactsDrawer.tsx` (chỉ phần dữ liệu, giao diện để FB7), `FE/components/settings/ProjectResourcesSection.tsx` (chỉ phần dữ liệu)
- `FE/services/impl/HttpWorkflowService.ts` (chỉ các phương thức artifact nếu cần sửa)
- Test FE (sửa cả `WorkflowArtifacts.test.tsx` nếu đang dựa vào 5 mục giả)

## Test phải có
- Chế độ API: store khởi tạo không có mục nào; `loadArtifacts` với API trả `[]` → `items` rỗng (trước khi sửa phải fail vì ra 5 mục).
- API lỗi → không có mục mock.
- Đổi dự án → danh sách của dự án cũ bị xóa trước khi tải.

## Kiểm bằng tay
1. Dự án mới chưa có artifact: F5 → nút artifact không hiện số 5; mở ra trống, có trạng thái rỗng.
2. Thêm 1 artifact → số thành 1, F5 vẫn 1. Settings → Project resources hiện đúng 1 mục đó.
3. Dự án mẫu: số artifact khớp DB.

## Kết quả (Claude ghi, dán output thật)
