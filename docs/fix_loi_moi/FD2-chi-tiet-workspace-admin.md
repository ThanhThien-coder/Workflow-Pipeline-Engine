# FD2 — Quản lý workspace: "Xem chi tiết" hiện thông tin quản trị, không mở DAG

Người làm: D
Trạng thái: chưa làm
Lỗi xử lý: L21
Nhánh git: fix-fd2-chi-tiet-workspace
Làm trước: FA2 (cùng sửa `WorkspacesTab.tsx`, A merge trước)

> Viết tắt như FA1.

## Lỗi người dùng thấy
Ở tab Quản lý workspace, nút "Xem chi tiết" mở đồ thị DAG của dự án người khác (admin không nên xem nội dung task), mà hiện tại mở ra cũng không hiện gì.

## Nguyên nhân (đã đọc code)
- `FE/features/admin/tabs/WorkspacesTab.tsx` dòng 149: `onClick={() => onInspectPipeline(item.name)}`.
- `FE/features/admin/AdminPortalView.tsx` dòng 202: truyền `handleInspectPipeline`, hàm này điều hướng tới đồ thị theo **tên** dự án.
- Theo đặc tả (`docs/specs/system-overview.md`, Phân hệ 5): admin quản lý ở mức metadata, không xem nội dung task.

## Cách sửa (đã chốt)
1. **Backend** thêm vào `AdminStatsController` (file của D ở FD1): `GET /api/v1/admin/workspaces/{id}` (`ADMIN`) trả:
   - Tên, mô tả, trạng thái, ngày tạo, ngày cập nhật.
   - Owner: tên + email đã che (dùng lại hàm che email của FA2).
   - Thành viên: số lượng theo role (OWNER, MANAGER, COLLABORATOR, VIEWER), số lời mời đang chờ.
   - Cấu trúc: số phase, số task, số task theo trạng thái, % hoàn thành, số task trễ hạn.
   - Link khách: đang bật hay không, hạn đến khi nào (không trả token).
   - Hoạt động gần nhất: thời điểm cập nhật mới nhất trong các node.
   - **Không** trả tên task, mô tả task, URL artifact.
2. **Frontend**:
   - Đổi nút "Xem chi tiết" thành mở **drawer bên phải** ngay trong tab, hiện các mục trên theo nhóm (Tổng quan · Thành viên · Tiến độ · Chia sẻ). Trong drawer có nút "Lưu trữ" (dùng `archiveWorkspace` của FA2).
   - Xóa `onInspectPipeline`/`handleInspectPipeline` và điều hướng sang đồ thị.

## Được sửa
- `BE/controller/AdminStatsController.java`, `BE/service/admin/AdminStatsService.java`, `BE/dto/response/admin/stats/**`
- `BE-test/**/admin/AdminStats*`
- `FE/features/admin/tabs/WorkspacesTab.tsx` (phần giao diện), `FE/features/admin/components/WorkspaceDetailDrawer.tsx` (mới), `FE/features/admin/AdminPortalView.tsx` (chỉ bỏ `handleInspectPipeline`), `FE/types/admin-stats.types.ts`, `FE/services/admin/adminStats.ts`, test FE

## Test phải có
- `GET /admin/workspaces/1` với dữ liệu seed: số task đúng; JSON trả về **không** chứa chuỗi tên task nào của seed (vd "WPE-001" hay tiêu đề task).
- Dự án không tồn tại → 404. User thường → 403.
- Test FE: bấm "Xem chi tiết" mở drawer, không gọi điều hướng.

## Kiểm bằng tay
1. Admin → Workspaces → "Xem chi tiết" dự án mẫu: drawer hiện đủ 4 nhóm thông tin, đúng số liệu.
2. Không có cách nào từ drawer đi vào đồ thị dự án.

## Kết quả (Claude ghi, dán output thật)
