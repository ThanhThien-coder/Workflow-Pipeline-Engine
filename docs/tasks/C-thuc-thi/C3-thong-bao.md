# C3 — Thông báo: API và chuông thông báo realtime

Người làm: C
Người review: D
Trạng thái: chưa làm
Cần có trước: A2, C2
Cần trước bước frontend: không
Mở khóa: X1
Nhánh git: c3-notifications
Ước lượng: 1,5 ngày

## Vì sao cần task này
Backend đã lưu thông báo vào bảng `notification`, nhưng chưa có API để đọc. Chuông thông báo trên FE dùng `MockNotificationApi`.

## Kiến thức phải nắm
Phân trang (limit và cursor), đếm chưa đọc bằng index, gộp dữ liệu realtime với dữ liệu tải từ API (chống trùng), deep-link.

## Bước 0 — Tự đọc, không dùng AI
Đọc: `FE/services/contracts/INotificationService.ts`, `FE/types/notification.types.ts`, `FE/services/mock/MockWorkflowService.notification.ts`, `FE/components/common/NotificationBell.tsx`, `FE/views/NotificationsView.tsx`, `FE/store/useNotificationStore.ts`; `BE/entity/NotificationEntity.java`, `BE/repository/NotificationRepository.java`; phần deep-link lời mời trong integration map 5.7.
Trả lời:
1. `unreadCount` nên tính ở BE hay FE? Vì sao?
2. Deep-link `/workspace?action=open-invite-modal&invitationId=…` được FE xử lý ở đâu (chỉ file:dòng)?
3. Sự kiện realtime tới trước khi danh sách tải xong thì làm sao để không trùng, không thiếu?

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `wpe-backend/src/**`, `FE/**`, `docs/**`

## Được ghi
- `BE/controller/NotificationController.java` (mới), `BE/service/notification/**` (mới), `BE/repository/NotificationRepository.java` (chỉ thêm method), `BE/dto/response/notification/**`
- `BE-test/**/notification/**`
- `FE/services/impl/HttpNotificationService.ts` (mới), `FE/services/container.ts` (chỉ dòng `notificationService`)
- `FE/store/useNotificationStore.ts`, `FE/components/common/NotificationBell.tsx`, `FE/views/NotificationsView.tsx`, `FE/types/notification.types.ts`, test FE
- `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md` (thêm mục API thông báo), `docs/tasks/C-thuc-thi/C3-thong-bao.md`

## Đặc tả đã chốt
- `GET /api/v1/notifications?limit=20` → `{ items: NotificationResponse[], unreadCount }`. Mới nhất lên trước, chỉ của user hiện tại.
- `PATCH /api/v1/notifications/{id}/read` → `NotificationResponse`. Không phải của mình → 404, không để lộ là thông báo có tồn tại.
- `POST /api/v1/notifications/read-all` → 204.
- FE: `HttpNotificationService` (mới) theo `INotificationService`, nối vào `container.ts`. Sự kiện SSE `NOTIFICATION_RECEIVED` thêm vào đầu danh sách, tăng `unreadCount`, bỏ qua nếu trùng `id`.
- Bấm thông báo lời mời: giữ hành vi deep-link hiện có (mở `ProjectInviteAcceptModal`, không tải lại trang).

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 Viết bảng test case trước.
3. 🤝 BE và test.
4. 🤝 FE và test.
5. 🧠 Chạy thật: sarah nộp bài, chuông của alex phải tăng ngay. Bấm đọc. F5 vẫn đúng số chưa đọc.

## Tiêu chí xong
- [ ] Test BE: chỉ thấy thông báo của mình; đọc thông báo của người khác → 404; read-all.
- [ ] Test FE: thêm thông báo realtime không bị trùng.
- [ ] Kịch bản chạy thật ở bước 5 đúng (ghi kết quả).

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. Phân trang theo `limit` khác phân trang theo cursor thế nào? Khi nào cần cursor?
2. Vì sao trả 404 thay vì 403 khi đọc thông báo của người khác?
3. Index `idx_notification_user` giúp những truy vấn nào?

## Cấm
- Sửa file ngoài mục "Được ghi". File dùng chung thì báo nhóm trước (README mục 6).
- Đọc, in, commit `.env*`, khóa, mật khẩu thật, API key. Dùng `git add -f`.
- Tự ghi trạng thái `xong`. Chỉ người review ghi sau khi kiểm.

## Dành cho Claude (đọc trước khi làm)
Người dán file này là **người làm** task. Mục tiêu kép: task chạy đúng **và** người làm hiểu hết những gì đã làm.
1. Chưa sửa code vội. Yêu cầu người làm tóm tắt mục tiêu task và đọc câu trả lời Bước 0 của họ. Sai hoặc thiếu thì giải thích, rồi hỏi lại.
2. Bước 🧠: không viết hộ. Chỉ gợi ý, đặt câu hỏi dẫn dắt, chỉ chỗ sai.
3. Bước 🤝: làm từng phần nhỏ. Mỗi phần nói rõ sửa file nào, vì sao, chạy kiểm thế nào. Yêu cầu người làm tự chạy lệnh và đọc kết quả.
4. Chỉ sửa file trong "Được ghi". Cần đụng file khác, nhất là file dùng chung, thì dừng lại và nói lý do để người làm hỏi nhóm.
5. "Đặc tả đã chốt" là quyết định của nhóm, không tự đổi. Thấy đặc tả sai thì báo ra, không tự làm theo ý mình.
6. Không đọc hay in `.env*`, khóa, mật khẩu, API key.
7. Làm xong: hỏi người làm 3 câu trong "Câu hỏi bảo vệ", nhắc họ điền ghi chép bằng lời của họ, chỉ đổi trạng thái thành `chờ kiểm`.

## Ghi chép của người làm
> Viết bằng lời của bạn. Người review đọc phần này trước khi đọc code.

### Trả lời Bước 0

### Đã làm gì (file nào, vì sao)

### Kết quả test (dán output thật, không chép tay)

### Điều chưa chắc / cần nhóm quyết

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**
