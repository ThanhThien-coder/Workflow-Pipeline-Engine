# C2 — Realtime SSE và RabbitMQ chắc chắn hơn

Người làm: C
Người review: D
Trạng thái: chờ kiểm
Cần có trước: C1
Cần trước bước frontend: không
Mở khóa: C3, C6, C8
Nhánh git: c2-realtime
Ước lượng: 1,5–2 ngày

> ⚡ **Chế độ sprint:** Claude làm hết các bước, kể cả 🧠; bỏ qua Bước 0 và mục "Dành cho Claude". Luồng làm: [SPRINT_2_NGAY.md](../SPRINT_2_NGAY.md) mục 2–3.
> - **Claude tự chạy bằng dòng lệnh:** gửi lời mời bằng API, xem message và log consumer; đếm bảng `notification` bằng SQL.
> - **Dời về buổi kiểm chung (mục 7):** mở 2 tab cùng user sarah, tab thứ 3 alex duyệt task (bảng 7.2 dòng 6).
> - **Không làm trong sprint:** không có.

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
Chế độ sprint: bỏ qua phần tự đọc; câu 1–2 trả lời bằng thực nghiệm thật (12/11/2026, trước khi sửa).
1. Routing key `wpe.notification.invitation_created` khớp binding `wpe.notification.#` → vào `wpe.notification.queue` (danh sách binding lúc đó chỉ có 3: `wpe.ai.diagnostics`, `wpe.notification.#`, `wpe.task.completed`).
2. alex mời admin vào dự án 1 (`POST /api/v1/projects/1/invitations` → 201). Log thật:
   ```
   INFO [nio-8080-exec-7] ProjectInvitationService: Created ProjectInvitation id=1 for project=1 invitee=1
   INFO [nio-8080-exec-7] WorkflowEventPublisher: Publishing InvitationCreatedEvent for Invitation ID: 1, Project: Core Banking Pipeline, Invitee: admin@pipeline.engine
   INFO [ntContainer#3-1] WorkflowEventConsumer: Processing NotificationEvent in background: Recipient=null, Title=null
   ```
   Message bị listener của queue thông báo đọc thành `NotificationEvent` rỗng rồi bỏ qua (vì `recipientUserId == null`). `handleInvitationCreated` không chạy. **Nghi ngờ trong task là đúng.** Bảng `notification` có 1 bản ghi lời mời do `ProjectInvitationService` tự lưu, nhưng admin không nhận realtime.
3. (Không thực nghiệm) SSE một chiều server → trình duyệt trên HTTP thường, tự kết nối lại, đủ cho đẩy thông báo; WebSocket hai chiều, cần khi client gửi liên tục (chat, chỉnh sửa chung).

### Đã làm gì (file nào, vì sao)
Làm theo chế độ sprint ngày 12/11/2026, nhánh `c2-realtime` **tách từ `c1-fsm`** (C1 đang chờ D review ở PR #35, chưa merge).
- `BE/service/event/SseEmitterService.java`: `Map<Long, Set<SseEmitter>>` (`CopyOnWriteArraySet`), thêm emitter trong `compute` để nguyên tử với việc gỡ; `onCompletion/onTimeout/onError` và gửi lỗi chỉ gỡ đúng emitter đó; `sendToUser`, `broadcast` gửi tới mọi tab; `sendHeartbeat()` `@Scheduled(fixedRate = 25000)` gửi `PING`. Chữ ký `subscribe`, `sendToUser`, `broadcast`, `isUserConnected` giữ nguyên. Thêm `protected createEmitter()` để test thay emitter giả.
- `BE/dto/response/notification/NotificationResponse.java` (mới): `id` (chuỗi), `title`, `message`, `linkUrl`, `isRead`, `createdAt`, có `from(NotificationEntity)`. C3 dùng lại cho API chuông.
- `BE/service/event/WorkflowEventConsumer.java`: SSE `NOTIFICATION_RECEIVED` gửi `NotificationResponse` thay vì entity; `handleTaskCompleted` bắt riêng `OptimisticLockingFailureException`, log `warn` rồi ném lại để retry; bỏ 2 hàm lời mời (chuyển sang lớp mới).
- `BE/service/event/InvitationEventConsumer.java` (mới): `@RabbitListener(queues = wpe.invitation.queue)` ở mức lớp, `@RabbitHandler` cho `handleInvitationCreated` và `handleInvitationAccepted`. Lời mời mới: tìm thông báo đã lưu theo deep-link, đẩy `NOTIFICATION_RECEIVED` 1 lần, không lưu thêm. Chấp nhận lời mời: chỉ ghi log.
- `BE/config/RabbitMQConfig.java`: queue `wpe.invitation.queue` (có DLQ), binding `wpe.invitation.#`, hằng `ROUTING_KEY_INVITATION_CREATED/ACCEPTED`.
- `BE/service/event/WorkflowEventPublisher.java`: lời mời gửi `wpe.invitation.created` / `wpe.invitation.accepted`. Chữ ký giữ nguyên.
- Không sửa `ProjectInvitationService.java`, không sửa FE.
- Docs: `workflow-engine.md` 3.5 (nhiều tab, heartbeat, danh mục sự kiện, queue lời mời, lũy đẳng), integration map 5.7.

**Bảng test case** (viết trước, file test ở `BE-test/service/event/`):

| # | Tình huống | Mong đợi | Test |
| :- | :--- | :--- | :--- |
| 1 | Mở tab | Tab nhận `INIT`, user đang kết nối | `SseEmitterServiceTest.subscribe_sendsInit` |
| 2 | 1 user 2 tab, `sendToUser` | Cả 2 tab nhận | `twoTabs_bothReceive` |
| 3 | Tab cũ đóng sau khi tab mới mở | Chỉ gỡ tab cũ, tab mới vẫn nhận | `closingOldTab_keepsNewTab` |
| 4 | Timeout 1 tab, lỗi tab còn lại | Gỡ từng cái; hết tab thì không còn kết nối | `timeoutAndError_removeOnlyThatEmitter` |
| 5 | Gửi lỗi ở 1 tab | Chỉ gỡ tab lỗi | `sendFails_removesOnlyBrokenTab` |
| 6 | Heartbeat | `PING` tới mọi emitter mọi user | `heartbeat_pingsEveryEmitter` |
| 7 | Heartbeat gặp emitter chết | Gỡ emitter chết | `heartbeat_removesDeadEmitters` |
| 8 | Lịch heartbeat | `@Scheduled(fixedRate = 25000)` | `heartbeat_isScheduledEvery25Seconds` |
| 9 | `broadcast` | Mọi tab mọi user | `broadcast_reachesEveryTab` |
| 10 | User chưa kết nối | Bỏ qua, không lỗi | `sendToUser_notConnected_noError` |
| 11 | Thông báo mới | Lưu 1 bản ghi, SSE payload `NotificationResponse` | `WorkflowEventConsumerTest.handleNotification_pushesNotificationResponse` |
| 12 | Xung đột version khi mở khóa | Ném lại để retry | `handleTaskCompleted_optimisticLock_rethrowsForRetry` |
| 13 | Cùng `TaskCompletedEvent` chạy 2 lần | Mở khóa và thông báo 1 lần | `handleTaskCompleted_twice_unlocksAndNotifiesOnce` |
| 14 | Lời mời mới | SSE 1 lần bằng bản ghi đã lưu, không lưu thêm | `InvitationEventConsumerTest.created_pushesSavedNotificationOnce_withoutSaving` |
| 15 | Lời mời mới, không thấy bản ghi | Không SSE, không tự tạo | `created_notificationMissing_noPushNoSave` |
| 16 | Chấp nhận lời mời | Không lưu, không SSE | `accepted_noSaveNoPush` |
| 17 | Lớp nghe đúng queue, 2 `@RabbitHandler` | Đúng | `listensOnInvitationQueue` |
| 18 | Queue/binding lời mời | `wpe.invitation.queue`, `wpe.invitation.#`, có DLQ | `RabbitMQConfigTest.invitationQueue_boundWithInvitationPattern` |
| 19 | Routing key lời mời | Không còn dưới `wpe.notification.` | `invitationRoutingKeys_outsideNotificationPattern` |
| 20 | Converter đọc lại kiểu sự kiện lời mời từ `__TypeId__` | Đúng kiểu | `converter_restoresInvitationEventTypes` |
| 21–22 | Publisher gửi lời mời | `wpe.invitation.created` / `.accepted` | `WorkflowEventPublisherTest.publishInvitation*` |

### Kết quả test (dán output thật, không chép tay)
**1. Trước khi sửa** (đã có khung rỗng cho lớp mới để test biên dịch được):
```
[ERROR]   InvitationEventConsumerTest.created_pushesSavedNotificationOnce_withoutSaving:67
[ERROR]   InvitationEventConsumerTest.listensOnInvitationQueue:97
[ERROR]   SseEmitterServiceTest.broadcast_reachesEveryTab:192
[ERROR]   SseEmitterServiceTest.closingOldTab_keepsNewTab:112
[ERROR]   SseEmitterServiceTest.heartbeat_isScheduledEvery25Seconds:178
[ERROR]   SseEmitterServiceTest.heartbeat_pingsEveryEmitter:153
[ERROR]   SseEmitterServiceTest.heartbeat_removesDeadEmitters:170
[ERROR]   SseEmitterServiceTest.timeoutAndError_removeOnlyThatEmitter:123
[ERROR]   SseEmitterServiceTest.twoTabs_bothReceive:98
[ERROR]   WorkflowEventConsumerTest.handleNotification_pushesNotificationResponse:77
[ERROR]   WorkflowEventPublisherTest.publishInvitationAccepted_usesInvitationRoutingKey:130
[ERROR]   WorkflowEventPublisherTest.publishInvitationCreated_usesInvitationRoutingKey:119
[ERROR]   InvitationEventConsumerTest.created_notificationMissing_noPushNoSave » UnnecessaryStubbing
[ERROR] Tests run: 28, Failures: 12, Errors: 1, Skipped: 0
```
Pass ngay từ đầu (hành vi đã đúng sẵn): lũy đẳng (#13), ném lại khi xung đột version (#12), converter (#20), gửi lỗi 1 tab (#5, pass vì map cũ chỉ còn tab mới), queue/binding (#18, viết cùng lúc với test).

**2. Sau khi sửa:** `SseEmitterServiceTest` 10/10, `WorkflowEventConsumerTest` 3/3, `InvitationEventConsumerTest` 4/4, `RabbitMQConfigTest` 3/3, `WorkflowEventPublisherTest` 8/8, `RealtimeControllerTest` 1/1. Toàn bộ backend (`./mvnw test`): `Tests run=357, Failures=0, Errors=0, Skipped=1`. Sau khi C1 (#35) và #33, #34, #36, #37, #38 vào main, đã rebase nhánh lên main mới (không xung đột) và chạy lại: `Tests run=411, Failures=0, Errors=0, Skipped=1`.

**3. Chạy thật (backend bật từ code C2):**
```
Queue: wpe.invitation.queue (1 consumer), binding wpe.workflow.exchange -> wpe.invitation.queue : wpe.invitation.#

Lời mời: mở SSE cho admin (userId=1), alex mời admin -> HTTP 201
  INFO [ntContainer#0-1] InvitationEventConsumer: Processing InvitationCreatedEvent: Invitation ID=2, Project=Core Banking Pipeline, Invitee=1
  INFO [ntContainer#0-1] SseEmitterService: Đã bắn SSE event [NOTIFICATION_RECEIVED] tới User ID [1] (1 tab)
SSE admin nhận: 1 INIT, 1 NOTIFICATION_RECEIVED, 1 PING
data:{"id":"11","title":"Lời mời tham gia dự án: Core Banking Pipeline","message":"Alex Kim đã mời bạn ...","linkUrl":"/workspace?action=open-invite-modal&invitationId...
Bảng notification của admin: 1 bản ghi   (không trùng)

2 tab sarah + 1 tab alex (curl giữ kết nối 35 giây); sarah bắt đầu WPE-003 (200), nộp bài (200), alex duyệt (200):
== sarah-tab1: INIT TASK_STATUS_CHANGED PING TASK_STATUS_CHANGED PING
== sarah-tab2: INIT TASK_STATUS_CHANGED PING TASK_STATUS_CHANGED PING
== alex-tab3:  INIT TASK_STATUS_CHANGED TASK_SUBMITTED NOTIFICATION_RECEIVED PING TASK_UNLOCKED NOTIFICATION_RECEIVED PING
DB: WPE-003=DONE, WPE-004=TODO
```
Cả 2 tab của sarah nhận cùng sự kiện; heartbeat `PING` tới đều. Sau thực nghiệm đã trả DB về dữ liệu seed (WPE-003 TODO v0, WPE-004 LOCKED v0, 1 thông báo, 0 lời mời).

**Dời về buổi kiểm chung (SPRINT 7.2 dòng 6):** mở 2 tab trình duyệt thật cùng user sarah, tab thứ 3 alex duyệt. Ở trên đã giả lập bằng `curl`.

### Điều chưa chắc / cần nhóm quyết
- **Lệch nhỏ so với đặc tả, cần D/nhóm đồng ý:** đặc tả ghi "gắn `@RabbitListener` cho 2 hàm handle". Hai hàm cùng nghe một queue nên mình dùng `@RabbitListener` ở mức lớp và `@RabbitHandler` cho từng hàm, đặt trong lớp mới `InvitationEventConsumer`. Gắn `@RabbitListener` riêng cho từng hàm trên cùng queue thì 2 consumer giành message của nhau, lời mời mới có thể rơi vào hàm "đã chấp nhận".
- **Báo D:** luồng lời mời đổi routing key sang `wpe.invitation.*` và có queue riêng. Không sửa `ProjectInvitationService.java`. `handleInvitationAccepted` chỉ ghi log vì đặc tả chưa có thông báo cho người mời.
- **Đặc tả thiếu 1 sự kiện:** code còn gửi `TASK_OVERDUE` (`TaskOverdueScanner`, payload `KanbanTaskResponse`), không có trong 7 sự kiện đã chốt. Đã thêm vào danh mục ở 2 file docs để khớp code. Bộ quét gửi SSE này bên trong `@Transactional` nên vẫn trước commit; để C5 xem.
- FE chưa nghe `TASK_SUBMITTED`, `TASK_REJECTED`, `TASK_OVERDUE`, `PING` (FE không thuộc C2; nối ở C6, chuông ở C3). `PING` không có listener thì trình duyệt bỏ qua, không lỗi.
- Map emitter nằm trong RAM: chạy nhiều instance backend thì cần pub/sub dùng chung.
- Payload `KanbanTaskResponse` trong SSE vẫn có thể mang `version` cũ (đã ghi ở PR #35 của C1, chờ nhóm quyết sửa ở C1 hay C2).
- Nhánh ban đầu tách từ `c1-fsm`; C1 đã merge (#35) nên đã rebase lên main mới.

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**
