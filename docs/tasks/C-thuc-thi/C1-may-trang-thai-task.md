# C1 — Máy trạng thái task: ma trận kiểm thử và sửa lỗi (Cụm 5.2–5.6)

Người làm: C
Người review: D
Trạng thái: chưa làm
Cần có trước: T0
Cần trước bước frontend: không
Mở khóa: C2, C4, C5
Nhánh git: c1-fsm
Ước lượng: 1,5–2 ngày

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

### Đã làm gì (file nào, vì sao)

### Kết quả test (dán output thật, không chép tay)

### Điều chưa chắc / cần nhóm quyết
