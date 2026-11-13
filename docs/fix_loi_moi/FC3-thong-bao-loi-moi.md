# FC3 — Mời người vào dự án: người được mời không nhận thông báo, không có chỗ chấp nhận

Người làm: C
Trạng thái: chưa làm
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
