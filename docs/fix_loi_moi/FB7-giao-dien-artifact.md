# FB7 — Giao diện artifact tối, khó đọc

Người làm: B (C nhận giúp nếu xong việc sớm)
Trạng thái: chưa làm
Lỗi xử lý: L11
Nhánh git: fix-fb7-giao-dien-artifact
Làm trước: FB6 (cùng file drawer; FB6 sửa dữ liệu, task này sửa giao diện)

> Viết tắt như FB1.

## Lỗi người dùng thấy
Drawer/island artifact trong màn Workflow nền tối, chữ tối, gần như không đọc được.

## Nguyên nhân
Style của `FE/components/workspace/WorkflowArtifactsDrawer.tsx` và `WorkflowArtifactsIsland.tsx` dùng tông tối, lệch với phần còn lại của app (nền trắng, chữ `slate`, nhấn `indigo`). Claude mở 2 file để xác định đúng các class gây tối (nền `bg-slate-9xx`/`bg-black`/màu hex tối, chữ cùng tông).

## Cách sửa (đã chốt)
1. Đổi sang tông sáng giống các panel khác (tham khảo `FE/components/settings/ProjectResourcesSection.tsx` và `MindmapDrawer.tsx`): nền trắng, viền `slate-200`, tiêu đề `slate-900`, chữ phụ `slate-500`, nút chính `indigo`.
2. Mỗi artifact là 1 dòng: biểu tượng theo loại (link, file, repo…), tên, task gắn với nó (mã task), người nộp, thời gian (dùng `utils/relativeTime.ts`), nút mở link (tab mới), nút sao chép, nút xóa (chỉ người có quyền).
3. Có trạng thái rỗng ("Chưa có tài nguyên nào"), trạng thái đang tải, trạng thái lỗi.
4. Độ tương phản chữ/nền đạt tối thiểu 4.5:1. Không đổi logic dữ liệu của FB6.

## Được sửa
- `FE/components/workspace/WorkflowArtifactsDrawer.tsx`, `FE/components/workspace/WorkflowArtifactsIsland.tsx` (chỉ phần giao diện)
- `FE/utils/artifactLabel.ts` (nếu cần nhãn loại), test FE (snapshot/hiển thị nếu có)

## Test phải có
- `npm run typecheck && npm test` pass (test hiện có của drawer không vỡ).

## Kiểm bằng tay
1. Mở drawer artifact ở dự án có artifact: đọc rõ mọi chữ, đúng tông với app.
2. Dự án không có artifact: thấy trạng thái rỗng.
3. Bấm mở link, sao chép, xóa đều hoạt động.

## Kết quả (Claude ghi, dán output thật)
