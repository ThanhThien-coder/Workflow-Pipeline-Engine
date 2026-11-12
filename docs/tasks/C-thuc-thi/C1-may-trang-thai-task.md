# C1 — Máy trạng thái task: ma trận kiểm thử và sửa lỗi (Cụm 5.2–5.6)

Người làm: C
Người review: D
Trạng thái: chờ kiểm
Cần có trước: T0
Cần trước bước frontend: không
Mở khóa: C2, C4, C5
Nhánh git: c1-fsm
Ước lượng: 1,5–2 ngày

> ⚡ **Chế độ sprint:** Claude làm hết các bước, kể cả 🧠; bỏ qua Bước 0 và mục "Dành cho Claude". Luồng làm: [SPRINT_2_NGAY.md](../SPRINT_2_NGAY.md) mục 2–3.
> - **Claude tự chạy bằng dòng lệnh:** thực nghiệm "gửi trước commit" trước và sau khi sửa (`Thread.sleep` tạm, **không commit**); kịch bản Swagger của T0.
> - **Dời về buổi kiểm chung (mục 7):** alex duyệt task của sarah trên giao diện → WPE-004 tự mở khóa (bảng 7.2 dòng 6).
> - **Không làm trong sprint:** không có.

## Vì sao cần task này
`BE/service/engine/StateMachineService.java` là trái tim của hệ thống. Đã có 15 test, nhưng đọc code thấy còn 3 điểm nghi ngờ:
- `updateStatus` gọi `publishTaskCompleted` **bên trong** transaction, trước khi commit. Consumer có thể đọc dữ liệu cũ (task cha chưa DONE) và không mở khóa task con. **Cần chứng minh bằng thực nghiệm.**
- Dự án `ARCHIVED` (chỉ đọc, theo `workflow-engine.md` mục 5.1) vẫn đổi được trạng thái task.
- Force unlock chỉ đẩy SSE, không tạo thông báo, không ghi lại ai đã mở.

## Kiến thức phải nắm
Máy trạng thái hữu hạn (FSM), transaction và mức cô lập (isolation), `TransactionSynchronizationManager` / `TransactionSynchronization.afterCommit`, optimistic locking với `@Version`, kiểm thứ tự gọi bằng Mockito (`InOrder`).

## Bước 0 — Tự đọc, không dùng AI
Đọc: toàn bộ `docs/specs/workflow-engine.md`; integration map 5.2–5.6; `BE/service/engine/StateMachineService.java`; `BE-test/service/engine/StateMachineServiceTest.java`; `BE/service/event/WorkflowEventPublisher.java`, `BE/service/event/WorkflowEventConsumer.java`; hàm `evaluateTransition` trong `FE/domain/taskTransitions.ts`.
Trả lời:
1. 🧠 Vẽ tay sơ đồ trạng thái task, đủ sự kiện, điều kiện và hành động (bản nháp cho C8).
2. Kể theo dòng thời gian (t1, t2, …) kịch bản consumer chạy trước khi commit, dẫn tới task con không được mở khóa.
3. FE (`evaluateTransition`) và BE cùng kiểm luật chuyển trạng thái. Vì sao cần cả hai? Nếu hai bên lệch nhau thì người dùng thấy gì?

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `wpe-backend/src/**`, `FE/**`, `docs/**`

## Được ghi
- `BE/service/engine/StateMachineService.java`
- `BE/service/event/WorkflowEventPublisher.java`
- `BE/controller/NodeController.java` (chỉ khi cần)
- `BE-test/service/engine/**`, `BE-test/service/event/**`
- `docs/specs/workflow-engine.md`, `docs/tasks/C-thuc-thi/C1-may-trang-thai-task.md`

## Đặc tả đã chốt
- Ma trận chuẩn lấy từ `workflow-engine.md` (đoạn `evaluateTransition`) và integration map 5.2–5.5. Mỗi ô (trạng thái hiện tại × trạng thái đích × vai trò: owner / người phụ trách / thành viên khác) phải có kết quả mong đợi.
- **Gửi sự kiện sau khi commit**: trong `WorkflowEventPublisher`, nếu đang ở trong transaction thì đăng ký `TransactionSynchronization.afterCommit` rồi mới `convertAndSend`; không có transaction thì gửi ngay. Giữ nguyên chữ ký mọi hàm `publish*`, vì B và D đang gọi. SSE trong `StateMachineService` cũng gửi sau khi commit.
- Dự án `ARCHIVED`: mọi thao tác đổi trạng thái, nộp bài, force unlock → 409 `PROJECT_ARCHIVED`.
- Force unlock: thêm `publishNotification` cho người phụ trách ("Tác vụ … được Chủ dự án mở khóa sớm"); log mức `info` ghi userId người mở.
- Không đổi API và format response hiện có (FE đang dùng).

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 Lập ma trận (bảng markdown) ít nhất 25 ô trong ghi chép, đánh dấu ô nào đã có test.
3. 🤝 Viết test cho các ô còn thiếu (dùng `@ParameterizedTest` nếu hợp).
4. 🧠 **Thực nghiệm lỗi "gửi trước commit"**: thêm tạm `Thread.sleep(2000)` trong `updateStatus` ngay sau lời gọi publish (chỉ trên máy bạn, **không commit**). Duyệt WPE-003 bằng Swagger như ở T0, xem WPE-004 có mở khóa không. Ghi kết quả thật.
5. 🤝 Sửa theo cách after-commit. Lặp lại thực nghiệm: lần này phải mở khóa được.
6. 🤝 Chặn dự án ARCHIVED, thêm thông báo cho force unlock, kèm test.
7. Cập nhật `workflow-engine.md`: mục gửi sau commit, mục ARCHIVED.

## Tiêu chí xong
- [ ] `./mvnw test` pass. Ma trận ít nhất 25 ô, ô nào cũng có test.
- [ ] Ghi chép có kết quả thực nghiệm trước và sau khi sửa (log hoặc response thật).
- [ ] Có test kiểm rằng `rabbitTemplate.convertAndSend` chưa được gọi trước khi transaction commit.
- [ ] Kịch bản Swagger của T0 vẫn chạy đúng.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. `afterCommit` chạy ở thread nào? Nếu RabbitMQ chết đúng lúc đó thì có mất sự kiện không? Hướng khắc phục là gì (gợi ý: outbox pattern)?
2. Vì sao thêm `@Transactional` ở consumer không giải quyết được lỗi này?
3. Hai task cha cùng DONE một lúc cùng mở khóa một task con: `@Version` làm gì, và retry của RabbitMQ giúp gì?

## Cấm
- Sửa file ngoài mục "Được ghi". File dùng chung thì báo nhóm trước (README mục 6).
- Đọc, in, commit `.env*`, khóa, mật khẩu thật, API key. Dùng `git add -f`.
- Commit đoạn `Thread.sleep` dùng cho thực nghiệm.
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
(Chế độ sprint: bỏ qua Bước 0, làm ở giai đoạn Học lại.)

### Đã làm gì (file nào, vì sao)
Làm theo chế độ sprint ngày 12/11/2026, nhánh `c1-fsm`.
- `BE/service/event/WorkflowEventPublisher.java`: thêm `sendAfterCommit`, mọi hàm `publish*` đi qua hàm này. Đang trong transaction thì đăng ký một `TransactionSynchronization`, chỉ `convertAndSend` ở `afterCompletion(STATUS_COMMITTED)`; rollback thì không gửi; không có transaction thì gửi ngay. Dùng `afterCompletion` chứ không dùng `afterCommit` để vẫn gửi được khi publish bị gọi từ bên trong `afterCommit` của code khác (xem kết quả test mục 6). RabbitMQ lỗi sau commit thì chỉ ghi log `ERROR`, không làm request đã commit trả lỗi. Chữ ký các hàm `publish*` giữ nguyên.
- `BE/service/engine/StateMachineService.java`:
  - `ensureNotArchived`: `updateStatus`, `submitTaskArtifact`, `forceUnlock` trả 409 `PROJECT_ARCHIVED` khi dự án ARCHIVED. Dùng lại `ConflictException("PROJECT_ARCHIVED", …)` giống phần đồ thị của B.
  - Hàm `afterCommit(Runnable)`: mọi SSE (`TASK_STATUS_CHANGED`, `TASK_REJECTED`, `TASK_SUBMITTED`, `TASK_UNLOCKED`) gửi sau commit, cùng cách `afterCompletion(STATUS_COMMITTED)` như publisher.
  - `forceUnlock`: log `info` ghi userId người mở; gửi `publishNotification` loại `FORCE_UNLOCKED` ("… được Chủ dự án mở khóa sớm") cho người phụ trách.
- Test mới: `BE-test/service/event/WorkflowEventPublisherTest.java` (6 test), `BE-test/service/engine/StateMachineServiceMatrixTest.java` (40 test). 15 test cũ trong `StateMachineServiceTest` giữ nguyên. Test transaction chạy bằng `BE-test/service/event/NoOpTransactionManager.java`: không có DB nhưng đi đúng quy trình commit/rollback thật của Spring.
- `docs/specs/workflow-engine.md`: mục 3.4 (force unlock), mục mới 3.6 (gửi sau commit, hạn chế khi RabbitMQ lỗi), mục 5.1 (ARCHIVED chỉ đọc).
- Không sửa `NodeController` (không cần).

**Ma trận chuyển trạng thái** (O = Owner, A = người phụ trách, M = thành viên khác; ✔ = có test):

| # | Thao tác | O | A | M | Test |
| :- | :--- | :--- | :--- | :--- | :- |
| 1 | TODO → IN_PROGRESS | 200 | 200 | 403 | ✔ |
| 2 | IN_PROGRESS → TODO (hủy nhận) | 200 | 200 | 403 | ✔ |
| 3 | IN_PROGRESS → REVIEW | 200 | 200 | 403 | ✔ |
| 4 | REVIEW → DONE (duyệt) | 200 + TaskCompletedEvent | 403 | 403 | ✔ |
| 5 | REVIEW → IN_PROGRESS có lý do (từ chối) | 200 + SSE TASK_REJECTED | 403 | 403 | ✔ |
| 6 | REVIEW → IN_PROGRESS không lý do | 400 | — | — | ✔ (test cũ) |
| 7 | LOCKED → TODO / IN_PROGRESS | 400 | — | — | ✔ |
| 8 | TODO → REVIEW / DONE / LOCKED | 400 | — | — | ✔ |
| 9 | IN_PROGRESS → DONE / LOCKED | 400 | — | — | ✔ |
| 10 | REVIEW → TODO / LOCKED | 400 | — | — | ✔ |
| 11 | DONE → bất kỳ | 400 | — | — | ✔ |
| 12 | Trạng thái đích không tồn tại | 400 | — | — | ✔ |
| 13 | Sai `version` | (chưa test) | 409 | — | ✔ ô A (test cũ) |
| 14 | Nộp bài khi IN_PROGRESS | (chưa test) | 200 | 403 | ✔ ô A, M |
| 15 | Nộp bài khi không IN_PROGRESS | — | 400 | — | ✔ |
| 16 | Force unlock khi LOCKED | 200 + thông báo | 403 | 403 | ✔ |
| 17 | Force unlock khi không LOCKED | 400 | — | — | ✔ |
| 18 | Mọi thao tác trên dự án ARCHIVED | 409 `PROJECT_ARCHIVED` | 409 | — | ✔ |

Hàng 7–11 gồm 11 cặp (từ, đến), chạy bằng Owner để chắc chắn bị chặn vì luồng sai chứ không phải vì sai quyền. Tổng cộng **38 ô có test**. 2 ô chưa có test riêng: Owner gửi sai `version` (hàng 13) và Owner tự nộp bài (hàng 14); code xử lý Owner giống người phụ trách ở cả hai chỗ.

### Kết quả test (dán output thật, không chép tay)
**1. Test tái hiện lỗi, chạy trước khi sửa** (`./mvnw test -Dtest='WorkflowEventPublisherTest,StateMachineServiceMatrixTest'`):
```
[ERROR]   StateMachineServiceMatrixTest$ArchivedProject.approve_rejected:307
[ERROR]   StateMachineServiceMatrixTest$ArchivedProject.forceUnlock_rejected:333
[ERROR]   StateMachineServiceMatrixTest$ArchivedProject.submit_rejected:322
[ERROR]   StateMachineServiceMatrixTest$ArchivedProject.updateStatus_rejected:294
[ERROR]   StateMachineServiceMatrixTest.forceUnlock_notifiesAssignee:352
[ERROR]   StateMachineServiceMatrixTest.forceUnlock_sseWaitsForCommit:395
[ERROR]   StateMachineServiceMatrixTest.updateStatus_sseWaitsForCommit:382
[ERROR]   WorkflowEventPublisherTest.publishNotification_insideTransaction_waitsForCommit:108
[ERROR]   WorkflowEventPublisherTest.publishTaskCompleted_insideTransaction_waitsForCommit:84
[ERROR]   WorkflowEventPublisherTest.publishTaskCompleted_rolledBack_neverSends:99
[ERROR]   WorkflowEventPublisherTest.publishTaskCompleted_brokerFailsAfterCommit_doesNotThrow:122 » Amqp broker down
[ERROR] Tests run: 44, Failures: 10, Errors: 1, Skipped: 0
```
11 test fail đúng các lỗi của task; 33 ô ma trận còn lại pass vì đó là hành vi đang đúng.

**2. Sau khi sửa, toàn bộ test backend** (`./mvnw test`, không còn `Thread.sleep`, trước khi rebase lên main mới — xem mục 6 cho số cuối): `Tests run=324, Failures=0, Errors=0, Skipped=1` (test skip là test có sẵn).
```
StateMachineServiceTest        Tests run: 15, Failures: 0, Errors: 0, Skipped: 0
StateMachineServiceMatrixTest  Tests run: 39, Failures: 0, Errors: 0, Skipped: 0
WorkflowEventPublisherTest     Tests run: 5, Failures: 0, Errors: 0, Skipped: 0
```

**3. Thực nghiệm "gửi trước commit"** (kịch bản Swagger của T0 chạy bằng `curl` + header `X-Debug-User-Id`; thêm tạm `Thread.sleep(2000)` ngay sau `publishTaskCompleted`, không commit):
```
Trước khi sửa:
3) alex (2) PATCH /nodes/3/status DONE version=2 -> HTTP 200 (mất 2131 ms)
Sau 3 giây: WPE-003=DONE(v3), WPE-004=LOCKED(v0)
  12:22:19.825 [nio-8080-exec-5] Publishing TaskCompletedEvent for Task ID: 3, Code: WPE-003
  12:22:19.836 [ntContainer#0-1] Engine executing downstream check for parentTaskId: 3
Sau khi sửa (vẫn sleep 2 giây):
3) alex (2) PATCH /nodes/3/status DONE version=2 -> HTTP 200 (mất 2140 ms)
Sau 3 giây: WPE-003=DONE(v3), WPE-004=TODO(v1)
  12:25:32.853 [nio-8080-exec-5] Publishing TaskCompletedEvent for Task ID: 3, Code: WPE-003
  12:25:34.882 [ntContainer#2-1] Engine executing downstream check for parentTaskId: 3
  12:25:34.882 [ntContainer#2-1] Mở khóa thành công node con ID: 4, Code: WPE-004 từ LOCKED -> TODO
```
Trước khi sửa, consumer chạy sau publish 11 ms, khi transaction còn mở, nên đọc thấy WPE-003 chưa DONE. Sau khi sửa, consumer chạy sau commit (khoảng 2 giây sau) và mở khóa được.

**4. Kịch bản T0 với code cuối (không sleep):** 3 bước đều HTTP 200, duyệt mất 126 ms, WPE-004 `LOCKED → TODO`, `GET /projects/1/my-tasks?userId=2` có WPE-004 ở TODO.

**5. ARCHIVED qua API thật:** alex chuyển dự án 1 sang ARCHIVED → sarah `PATCH /nodes/3/status` → `409 {"error":"PROJECT_ARCHIVED",…}`; alex `POST /nodes/4/force-unlock` → `409 PROJECT_ARCHIVED`; WPE-003 không đổi. Chuyển dự án về ACTIVE thì bình thường.

Sau mỗi thực nghiệm đã khôi phục DB local về đúng dữ liệu seed (WPE-003 TODO v0, WPE-004 LOCKED v0, dự án ACTIVE, xóa thông báo sinh ra trong thực nghiệm).

**6. Rebase lên `main` mới (đã có B4 `publishPipeline`):** B4 gọi `eventPublisher.publishNotification` từ **bên trong** `afterCommit` của nó. Bản C1 đầu dùng `afterCommit` nên đăng ký thêm một `afterCommit` lúc Spring đã lấy xong danh sách cần gọi → thông báo `TASK_READY` khi xuất bản dự án **mất lặng lẽ**. Đã thêm test dùng quy trình commit thật của Spring (`NoOpTransactionManager`), chạy với code cũ:
```
[ERROR] com.pipeline.wpe.service.event.WorkflowEventPublisherTest.publishNotification_calledFromAnotherAfterCommit_stillSends -- Time elapsed: 0.033 s <<< FAILURE!
Wanted but not invoked:
Actually, there were zero interactions with this mock.
[ERROR] Tests run: 6, Failures: 1, Errors: 0, Skipped: 0
```
Sửa: chuyển sang `afterCompletion(STATUS_COMMITTED)` (Spring cũng cài `@TransactionalEventListener(AFTER_COMMIT)` theo cách này). Sau khi sửa, toàn bộ test backend: `Tests run=335, Failures=0, Errors=0, Skipped=1`.
```
WorkflowEventPublisherTest     Tests run: 6, Failures: 0, Errors: 0, Skipped: 0
StateMachineServiceMatrixTest  Tests run: 40, Failures: 0, Errors: 0, Skipped: 0
StateMachineServiceTest        Tests run: 15, Failures: 0, Errors: 0, Skipped: 0
WorkflowGraphServiceTest       Tests run: 53, Failures: 0, Errors: 0, Skipped: 0
```
**Chạy thật lại với bản `afterCompletion` (backend bật từ code cuối, sau rebase):**
```
Kịch bản T0:
Trước: WPE-003=TODO(v0), WPE-004=LOCKED(v0)
1) sarah (3) PATCH /nodes/3/status IN_PROGRESS version=0 -> HTTP 200
2) sarah (3) POST /nodes/3/submit version=1 -> HTTP 200
3) alex (2) PATCH /nodes/3/status DONE version=2 -> HTTP 200 (mất 74 ms)
Sau 3 giây: WPE-003=DONE(v3), WPE-004=TODO(v1)
  [nio-8080-exec-7] Publishing TaskCompletedEvent for Task ID: 3, Code: WPE-003 in Project: 1
  [ntContainer#1-1] Engine executing downstream check for parentTaskId: 3
  [ntContainer#1-1] Mở khóa thành công node con ID: 4, Code: WPE-004 từ LOCKED -> TODO
Bảng notification có thêm: "Tác vụ chờ nghiệm thu" (cho alex) và "Tác vụ sẵn sàng thực hiện" (WPE-004, cho alex).

Xuất bản (B4): tạo tạm dự án DRAFT id 2, 1 phase, 1 node WPE-001 LOCKED giao cho alex
POST /projects/2/publish -> {"success":true,"status":"ACTIVE",...,"unlockedTaskCount":1}
Node: WPE-001 TODO v1
notification mới: 9 | user 2 | Tác vụ sẵn sàng thực hiện | Dự án đã được xuất bản. Tác vụ WPE-001 (Task thu) đã mở khóa, bạn có thể bắt đầu!
  [nio-8080-exec-4] Publishing NotificationEvent for User ID: 2, Type: TASK_READY
  [ntContainer#3-1] Saved notification ID: 9 for user: 2
```
Sau đó đã xóa dự án tạm và trả DB về dữ liệu seed.

**Phát hiện thêm khi chạy thật (chưa sửa, có từ trước C1):** sarah `PATCH /nodes/3/status` IN_PROGRESS với `version=0` → response trả `"version":0` trong khi DB đã là `v1`. Payload SSE `TASK_STATUS_CHANGED` dùng chính object này nên cũng mang version cũ. Lý do: response được tạo trước khi Hibernate flush (version chỉ tăng lúc flush). B đã báo cùng lỗi ở PR #31. Chờ nhóm quyết sửa trong C1 hay C2.

**Dời về buổi kiểm chung (SPRINT mục 7.2 dòng 6):** alex duyệt task của sarah trên giao diện → WPE-004 tự mở khóa.

### Điều chưa chắc / cần nhóm quyết
- **RabbitMQ lỗi đúng lúc sau commit thì sự kiện bị mất** (chỉ có log `ERROR`). Muốn không mất cần outbox pattern; chưa làm, đã ghi ở `workflow-engine.md` mục 3.6.
- Task đã DONE trong dự án ARCHIVED vẫn trả 400 "đã hoàn tất", không phải 409, vì kiểm DONE chạy trước khi tải dự án. Vẫn bị chặn, chỉ khác mã lỗi. Giữ thứ tự này để không đổi hành vi mà test cũ đang kiểm.
- **Cho B (B4):** `publish*` giờ tự gửi sau commit. Code B4 hiện tự bọc `publishNotification` trong `afterCommit` của nó; vẫn chạy đúng (mục 6), nhưng có thể gọi thẳng `publishNotification` cho gọn — B quyết. Ngoài ra `SseEmitterService.sendToUser` gọi trực tiếp từ `WorkflowGraphService` (B3, B4) vẫn gửi ngay lúc gọi; muốn gửi sau commit thì phía B tự bọc (C2 có thể xem xét đưa vào `SseEmitterService`).
- Thông báo `FORCE_UNLOCKED` mới chỉ được **lưu vào bảng `notification`**, chưa hiện trên chuông: FE vẫn dùng `MockNotificationApi` (`FE/services/container.ts`) và BE chưa có API đọc thông báo. Việc nối chuông với API thật và nghe SSE `NOTIFICATION_RECEIVED` là của C3. Kiểm C1 thì xem bảng `notification` bằng SQL, không xem chuông.

## C1b — Bổ sung vai trò Manager vào ma trận (sau PR #33, 12/11/2026)
**Vì sao:** PR #33 (D, vai trò MANAGER) cho Manager duyệt và từ chối bài. Ma trận C1 chỉ có Owner / người phụ trách / thành viên khác nên thiếu cột Manager. Nhóm yêu cầu: "C bổ sung ô Manager vào bộ test ma trận của C1". Ghi ở đây vì `tien-do.mjs` chỉ nhận mã task dạng `C1`, `C2`.

**Đã làm:** chỉ thêm test và docs, không sửa code (hành vi đã có từ #33).
- `BE-test/service/engine/StateMachineServiceMatrixTest.java`: thêm vai trò `MANAGER` (thành viên `MANAGER` còn hoạt động) và `REMOVED_MANAGER` (không còn bản ghi `project_member` hoạt động); người phụ trách và thành viên khác được giả lập là `COLLABORATOR` hoạt động. Thêm 7 ô vào ma trận tham số và lớp `@Nested ManagerRole` 7 test.
- `docs/specs/workflow-engine.md` mục 1 và 2.1: luật duyệt/từ chối có Manager, đoạn "Vai trò Manager", cảnh báo lệch FE/BE.

**Cột Manager** (M = Manager còn hoạt động, RM = Manager đã bị gỡ):

| Thao tác | M | RM | Test |
| :--- | :--- | :--- | :- |
| REVIEW → DONE (duyệt) | 200 + `TaskCompletedEvent` (`completedByUserId` = Manager), SSE tới người phụ trách và Owner sau commit | 403 | ✔ |
| REVIEW → IN_PROGRESS có lý do (từ chối) | 200 + thông báo `REJECTED` cho người phụ trách | 403 | ✔ |
| REVIEW → IN_PROGRESS thiếu lý do | 400 | — | ✔ |
| TODO → IN_PROGRESS, IN_PROGRESS → TODO, IN_PROGRESS → REVIEW | 403 (không phụ trách) | — | ✔ |
| Nộp bài kèm minh chứng | 403 | — | ✔ |
| Force unlock | 403 (vẫn chỉ Owner) | — | ✔ |
| Duyệt trên dự án ARCHIVED | 409 `PROJECT_ARCHIVED` | — | ✔ |

**Kết quả test:** `StateMachineServiceMatrixTest` 54 test (40 cũ + 14 mới), `StateMachineServiceTest` 17 test, đều pass. 14 test mới **pass ngay từ đầu** vì #33 đã cài đúng hành vi; vai trò của chúng là khóa hành vi đó lại.

**Điều chưa chắc / cần báo nhóm:**
- **Lệch FE/BE:** `wpe-frontend/src/domain/taskTransitions.ts` (`evaluateTransition`) vẫn chỉ cho `OWNER` duyệt/từ chối; #33 không sửa file này. Manager bấm duyệt trên giao diện sẽ bị chặn dù backend cho phép. Ngoài phạm vi C1 (FE), cần D hoặc C6 sửa.
- Sơ đồ C7 (use case, đặc tả Duyệt/Từ chối) cũng phải thêm Manager.

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**
