# C2 — Realtime SSE và RabbitMQ chắc chắn hơn

Người làm: C
Người review: D
Trạng thái: chưa làm
Cần có trước: C1
Cần trước bước frontend: không
Mở khóa: C3, C6, C8
Nhánh git: c2-realtime
Ước lượng: 1,5–2 ngày

## Vì sao cần task này
Đọc code thấy các vấn đề sau:
- `BE/service/event/SseEmitterService.java` giữ mỗi user **1 emitter** (`Map<Long, SseEmitter>`). Mở 2 tab thì tab đầu mất realtime. Khi tab cũ đóng, `onCompletion` gọi `remove(userId)` và có thể gỡ nhầm emitter của tab mới.
- Không có heartbeat, nên proxy hoặc trình duyệt có thể cắt kết nối mà không ai biết.
- SSE đang gửi thẳng `NotificationEntity`, trái quy tắc không đưa entity ra ngoài (`GEMINI.md` mục 6).
- Sự kiện lời mời (`InvitationCreatedEvent`, `InvitationAcceptedEvent`) được gửi với routing key `wpe.notification.invitation_*`, nên rơi vào hàng đợi notification, nơi listener nhận kiểu `NotificationEvent`. Hai hàm `handleInvitationCreated` và `handleInvitationAccepted` lại không có `@RabbitListener`. **Nghi là chúng không bao giờ chạy, cần kiểm chứng.**
- FE chỉ nghe `INIT`, `TASK_UNLOCKED`, `TASK_STATUS_CHANGED`, `NOTIFICATION_RECEIVED`, trong khi BE còn gửi `TASK_SUBMITTED`, `TASK_REJECTED`.

## Kiến thức phải nắm
SSE (`event`, `data`, `id`, `retry`), vòng đời `SseEmitter`, `ConcurrentHashMap` và `CopyOnWriteArraySet`; RabbitMQ: exchange, queue, routing key, mẫu `#` của topic exchange; `Jackson2JsonMessageConverter` và header `__TypeId__`; DLQ; tính lũy đẳng (idempotency).

## Bước 0 — Tự đọc, không dùng AI
Đọc: integration map 5.6, 5.7; `GEMINI.md` mục 5–6; `SseEmitterService.java`, `BE/controller/RealtimeController.java`, `BE/config/RabbitMQConfig.java`, `WorkflowEventPublisher.java`, `WorkflowEventConsumer.java`; chỗ publish trong `BE/service/ProjectInvitationService.java`; RabbitMQ dashboard `http://localhost:15672`.
Trả lời:
1. Routing key `wpe.notification.invitation_created` khớp binding nào, vào queue nào?
2. 🧠 Thực nghiệm: gửi một lời mời bằng Swagger, mở dashboard xem message đi đâu, consumer ghi log gì. Ghi kết quả thật.
3. SSE khác WebSocket ở đâu? Vì sao dự án chọn SSE?

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `wpe-backend/src/**`, `FE/**`, `docs/**`

## Được ghi
- `BE/service/event/**`, `BE/config/RabbitMQConfig.java`, `BE/controller/RealtimeController.java`
- `BE/dto/event/**`, `BE/dto/response/notification/**` (mới)
- `BE-test/service/event/**`, `BE-test/controller/RealtimeControllerTest.java`
- `docs/specs/workflow-engine.md` (mục 3.5), `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md` (5.7), `docs/tasks/C-thuc-thi/C2-realtime-rabbitmq.md`

## Đặc tả đã chốt
- Nhiều tab: đổi sang `Map<Long, Set<SseEmitter>>`. Khi đóng thì gỡ đúng emitter đó. `sendToUser` gửi tới mọi emitter của user. **Giữ nguyên chữ ký** `sendToUser(Long, String, Object)`, `broadcast`, `isUserConnected`, vì B và D đang gọi.
- Heartbeat: `@Scheduled(fixedRate = 25000)` gửi sự kiện `PING` tới mọi emitter; gửi lỗi thì gỡ emitter đó.
- Danh mục sự kiện chuẩn (ghi vào `workflow-engine.md` 3.5 và integration map 5.7): `INIT`, `PING`, `TASK_UNLOCKED`, `TASK_STATUS_CHANGED`, `TASK_SUBMITTED`, `TASK_REJECTED`, `NOTIFICATION_RECEIVED`.
  - Payload task là `KanbanTaskResponse`.
  - Payload thông báo là `NotificationResponse` (record mới: `id, title, message, linkUrl, isRead, createdAt`, `id` dạng chuỗi).
- Lời mời: người được mời phải nhận `NOTIFICATION_RECEIVED` realtime **đúng 1 lần**, và không có bản ghi notification bị trùng (`ProjectInvitationService` đã tự lưu notification). Cách chốt:
  - Đổi routing key lời mời sang `wpe.invitation.*`.
  - Thêm queue riêng `wpe.invitation.queue`.
  - Gắn `@RabbitListener` cho 2 hàm handle; 2 hàm này chỉ đẩy SSE, không lưu lại notification.
  - Báo D, vì việc này đụng luồng lời mời của D. Không sửa `ProjectInvitationService.java`.
- `handleTaskCompleted`: gặp `OptimisticLockingFailureException` thì để Spring retry (đã cấu hình 3 lần) và ghi log rõ. Phải lũy đẳng: cùng một sự kiện chạy 2 lần thì không mở khóa và không gửi thông báo 2 lần. Code hiện đã kiểm LOCKED; viết test chứng minh.
- `RealtimeController` vẫn nhận `?userId=` cho tới X1 (C bỏ ở X1).

## Việc cần làm
1. 🧠 Bước 0, gồm cả thực nghiệm.
2. 🧠 Viết bảng test case trước.
3. 🤝 Hỗ trợ nhiều tab, heartbeat, kèm test.
4. 🤝 Record `NotificationResponse`, đổi payload SSE.
5. 🤝 Sửa luồng sự kiện lời mời, kèm test.
6. 🧠 Mở 2 tab cùng user sarah; ở tab thứ 3 (alex, owner) duyệt task của sarah. Cả 2 tab phải nhận sự kiện. Ghi kết quả.

## Tiêu chí xong
- [ ] Test pass: nhiều emitter cho 1 user; gỡ đúng emitter; heartbeat gỡ emitter chết; consumer lũy đẳng.
- [ ] Thực nghiệm 2 tab chạy đúng (ghi kết quả).
- [ ] Mời thành viên thì người được mời nhận `NOTIFICATION_RECEIVED` realtime, và bảng `notification` không bị trùng (đếm bằng SQL).
- [ ] Docs đã có danh mục sự kiện.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. Vì sao dùng `CopyOnWriteArraySet` ở đây?
2. Backend chạy 2 instance thì map emitter nằm trong RAM gặp vấn đề gì? (gợi ý: cần pub/sub dùng chung)
3. DLQ dùng để làm gì? Khi nào một message rơi vào đó?

## Cấm
- Sửa file ngoài mục "Được ghi". File dùng chung thì báo nhóm trước (README mục 6).
- Đọc, in, commit `.env*`, khóa, mật khẩu thật, API key. Dùng `git add -f`.
- Đổi chữ ký các hàm public của `SseEmitterService` và `WorkflowEventPublisher`.
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
