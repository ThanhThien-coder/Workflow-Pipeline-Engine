# FC3 — Mời người vào dự án: người được mời không nhận thông báo, không có chỗ chấp nhận

Người làm: C
Trạng thái: chờ kiểm
Lỗi xử lý: L10
Nhánh git: fix-fc3-thong-bao
Làm trước: không

> Viết tắt như FC4.

## Lỗi người dùng thấy
alex mời meomeo vào dự án. meomeo đăng nhập: chuông không có thông báo, không thấy lời mời ở đâu để chấp nhận.

## Nguyên nhân (đã đọc code)
- Backend **đã lưu** thông báo: `BE/service/ProjectInvitationService.java` dòng ~121–132 tạo `NotificationEntity` cho người được mời với `linkUrl = "/workspace?action=open-invite-modal&invitationId={id}"`, rồi gửi sự kiện RabbitMQ → SSE.
- Nhưng **không có API đọc thông báo** (không có `NotificationController`; xem danh sách endpoint, chỉ có `NotificationRepository`).
- FE: `FE/services/container.ts` `notificationService: new MockNotificationApi()`, luôn mock. Chuông (`FE/components/common/NotificationBell.tsx`) và `FE/views/NotificationsView.tsx` hiện thông báo giả.
- Phần chấp nhận đã có sẵn: `FE/App.tsx` dòng 29–44 bắt deep link `?action=open-invite-modal&invitationId=` và mở `ProjectInviteAcceptModal`; backend có `GET /invitations/{id}`, `POST /invitations/{id}/accept`, `/reject`. Chỉ thiếu đường để người dùng **đi tới** deep link đó.

## Cách sửa (đã chốt)
1. **Backend** `BE/controller/NotificationController.java` (mới), user hiện tại lấy từ `CurrentUserProvider.requireCurrentUserId()`:
   - `GET /api/v1/notifications?unreadOnly=false&limit=30` → danh sách của chính user, mới nhất trước (id, title, message, linkUrl, isRead, createdAt).
   - `GET /api/v1/notifications/unread-count`.
   - `PATCH /api/v1/notifications/{id}/read` (chỉ thông báo của chính mình, của người khác → 404).
   - `PATCH /api/v1/notifications/read-all`.
2. **Frontend**:
   - `FE/services/impl/HttpNotificationService.ts` (mới) cài `INotificationService` bằng các API trên. `container.ts`: `notificationService: isMock ? new MockNotificationApi() : new HttpNotificationService()`.
   - Chuông: tải số chưa đọc khi đăng nhập; nhận SSE `NOTIFICATION_RECEIVED` (hoặc sự kiện lời mời đang có) thì tải lại. Không có SSE thì tải lại khi mở chuông.
   - Bấm một thông báo: đánh dấu đã đọc rồi `navigate(linkUrl)`. Với lời mời, `linkUrl` mở `ProjectInviteAcceptModal` (đã có).
   - Chấp nhận xong: tải lại danh sách dự án ở Workspace để dự án mới hiện ra.
3. Kiểm trường hợp lời mời đã hết hạn/đã thu hồi: modal hiện lý do, không lỗi trắng.

## Được sửa
- `BE/controller/NotificationController.java` (mới), `BE/service/NotificationService.java` (mới), `BE/dto/response/notification/**` (mới), `BE/repository/NotificationRepository.java` (chỉ thêm method)
- `BE-test/**/Notification*` (mới)
- `FE/services/impl/HttpNotificationService.ts` (mới), `FE/services/container.ts` (chỉ dòng `notificationService`), `FE/store/useNotificationStore.ts`, `FE/components/common/NotificationBell.tsx`, `FE/views/NotificationsView.tsx`, `FE/types/notification.types.ts` (chỉ thêm trường nếu cần), `FE/components/workspace/ProjectInviteAcceptModal.tsx` (chỉ phần tải lại danh sách, báo lỗi), test FE

## Test phải có
- BE: alex mời meomeo → `GET /notifications` của meomeo có 1 thông báo có `linkUrl` chứa `invitationId`; sarah không thấy thông báo đó; đánh dấu đọc thông báo của người khác → 404.
- FE: bấm thông báo lời mời gọi `markRead` rồi điều hướng tới `linkUrl`.

## Kiểm bằng tay
1. alex mời meomeo. meomeo đăng nhập → chuông có số 1.
2. Bấm thông báo → mở hộp chấp nhận lời mời → Chấp nhận → dự án hiện trong Workspace của meomeo; chuông về 0.
3. Nếu meomeo đang mở app sẵn lúc alex mời → chuông tăng ngay (SSE) hoặc khi mở chuông.

## Kết quả (Claude ghi, dán output thật)

**File đã sửa**
- BE (mới): `BE/controller/NotificationController.java` (`GET /api/v1/notifications?unreadOnly&limit`, `GET /unread-count`, `PATCH /{id}/read`, `PATCH /read-all`; user lấy từ `CurrentUserProvider.requireCurrentUserId()`), `BE/service/NotificationService.java` (limit mặc định 30, tối đa 200; đọc thông báo của người khác → `ResourceNotFoundException` 404), `BE/dto/response/notification/UnreadCountResponse.java`.
- BE: `BE/repository/NotificationRepository.java` (thêm `findByIdAndUserId`).
- FE (mới): `FE/services/impl/HttpNotificationService.ts` (list/markAsRead/markAllAsRead, đổi `linkUrl` thành `targetPath`).
- FE: `FE/services/container.ts` (chỉ dòng `notificationService`), `FE/store/useNotificationStore.ts` (thêm `receiveRealtime`), `FE/components/common/NotificationBell.tsx` (tải khi đăng nhập, nghe SSE `NOTIFICATION_RECEIVED`, vẫn giữ tải lại 60 giây/lần; bấm → `markRead` rồi `navigate(linkUrl)`), `FE/views/NotificationsView.tsx`, `FE/types/notification.types.ts` (thêm `title`, `message`, `linkUrl` tùy chọn), `FE/components/workspace/ProjectInviteAcceptModal.tsx` (chấp nhận/từ chối xong tải lại thông báo; lời mời hết hạn/thu hồi hiện lý do).

**Test đã thêm**
- BE: `NotificationServiceTest` (4 test; alex mời meomeo qua `ProjectInvitationService` thật → meomeo có 1 thông báo chứa `invitationId`, sarah không thấy; đánh dấu đọc của người khác → 404…), `NotificationControllerTest` (5 test).
- FE: `components/common/__tests__/NotificationBell.test.tsx` (bấm thông báo lời mời → `markRead` rồi điều hướng tới `linkUrl`; SSE tới thì tải lại), `services/impl/__tests__/HttpNotificationService.test.ts` (3 test), thêm 1 test "lời mời bị thu hồi" trong `ProjectInviteAcceptModal.test.tsx`.

**Output test thật** (13/11/2026)
- Trước khi sửa (hoàn lại 6 file FE nguồn): `NotificationBell.test.tsx` 2 failed. BE: lớp mới nên test không biên dịch được trên code cũ.
- Sau khi sửa:
```text
./mvnw test   → 443 test, Failures 0, Errors 0, Skipped 1 (NotificationControllerTest 5/5, NotificationServiceTest 4/4)
npm run typecheck → tsc -b, exit 0
npm test      → Test Files 49 passed (49) | Tests 367 passed (367)
```
