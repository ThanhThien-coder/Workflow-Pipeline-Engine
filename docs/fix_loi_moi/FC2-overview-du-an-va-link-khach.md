# FC2 — Overview dự án dùng dữ liệu thật, sửa lỗi không sinh được link khách

Người làm: C
Trạng thái: chưa làm
Lỗi xử lý: L6, L7 (ảnh 2 và ảnh 3 trong `test sơ.md`)
Nhánh git: fix-fc2-overview-that
Làm trước: FC5 (dùng `fetchProjectActivity` cho Recent activity)

> Viết tắt như FC4.

## Lỗi người dùng thấy
- Overview của mọi dự án đều hiện "Marketing Campaign Q4", 24 nodes, 72%, biểu đồ tuần… (ảnh 2), là số giả.
- Bấm "Generate New Token" ở Guest link → "Failed to generate new link. Please try again." (ảnh 3).

## Nguyên nhân (đã đọc code)
- `FE/services/impl/HttpWorkflowService.ts` dòng 378–408, `getOverviewData`: lấy `base = this.mock.getOverviewData(projectId)` rồi chỉ ghép `guestAccess` và `feedbackQueue` thật. Mọi thứ khác là mock.
- Mock (`FE/services/mock/MockWorkflowService.overview.ts` dòng 15) có `project: { id: '1', name: 'Marketing Campaign Q4', role: 'OWNER', ... }`.
- `FE/store/slices/overviewSlice.ts` dòng ~79–89, `generateGuest`: gọi `generateGuestToken(data.project.id)` = **`'1'`** chứ không phải id dự án đang mở → `POST /projects/1/guest-token` → người dùng không phải owner dự án 1 → 403 → toast lỗi. (`toggleGuestAccess` cũng dùng `data.project.id`, cùng lỗi.)

## Cách sửa (đã chốt)
1. `getOverviewData(projectId)` dựng **toàn bộ** từ API thật, xóa khỏi `METHODS_STILL_MOCKED`:
   | Phần | Nguồn |
   | :--- | :--- |
   | `project` (id, tên, vai trò, trạng thái, cập nhật) | `fetchProjectSettings(projectId)` (`impl/http/projectSettings.ts`, đã có) |
   | Tổng node, % hoàn thành, số trễ hạn, số chờ duyệt, phân bố trạng thái | `GET /projects/{id}/graph` (đếm theo `status`, `isOverdue`/`dueDate`) |
   | Weekly velocity | số node DONE theo ngày trong 7 ngày gần nhất theo `updatedAt` của node (nếu response node không có `updatedAt` thì **ẩn** card và ghi chú, không vẽ số giả) |
   | Recent activity | `fetchProjectActivity(projectId, 10)` của FC5 |
   | AI insights | `GET /projects/{id}/ai-analysis` nếu trả được; lỗi/rỗng thì hiện trạng thái rỗng "Chưa có chẩn đoán", không dùng insight giả |
   | Guest link, góp ý | giữ như hiện tại (đã thật) |
2. `overviewSlice` dùng **`projectId` của route** cho `generateGuest`, `toggleGuestAccess`, `resolveFeedback`; không dùng `data.project.id` từ mock. Toast lỗi hiện message backend (vd "Chỉ chủ dự án mới tạo được link").
3. Không phải owner: nút tạo link bị vô hiệu với chú thích (đã có nhánh 403 ở `getOverviewData`, giữ).
4. Lỗi tải Overview → hiện lỗi, không rơi về mock.

## Được sửa
- `FE/services/impl/HttpWorkflowService.ts` (chỉ `getOverviewData`, `generateGuestToken`, `toggleGuestAccess`, dòng `getOverviewData` trong `METHODS_STILL_MOCKED`), `FE/services/impl/http/overview.ts` (mới, hàm tính số liệu)
- `FE/store/slices/overviewSlice.ts`, `FE/types/overview.types.ts` (chỉ thêm trường tùy chọn), `FE/components/overview/**`, `FE/views/OverviewView.tsx`, `FE/components/views/OverviewView.tsx`, `FE/components/popovers/GuestAccessPopover.tsx`
- Test FE

## Test phải có
- `getOverviewData('5')` trả `project.id === '5'` và tên thật; không gọi `mock.getOverviewData`.
- Hàm tính số liệu: đồ thị 4 node (2 DONE, 1 trễ hạn) → 50%, overdue 1.
- `generateGuest` gọi API với projectId của route (trước khi sửa phải fail vì gọi `'1'`).

## Kiểm bằng tay
1. alex mở dự án mẫu và một dự án mới tạo: Overview hiện đúng tên, số node, %, mỗi dự án khác nhau.
2. alex (owner) bấm tạo link khách → thành công, mở link ở tab ẩn danh thấy trang khách.
3. sarah (không phải owner) → nút tạo link bị vô hiệu, có chú thích.

## Kết quả (Claude ghi, dán output thật)
