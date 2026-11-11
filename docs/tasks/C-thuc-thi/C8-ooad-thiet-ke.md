# C8 — Sơ đồ thiết kế OOAD: mảng Chạy task & Realtime (khớp code thật)

Người làm: C
Người review: D
Trạng thái: chưa làm
Cần có trước: C7, C2
Cần trước bước frontend: không
Mở khóa: X3
Nhánh git: c8-ooad-thiet-ke
Ước lượng: 1–1,5 ngày

## Vì sao cần task này
Mảng của C có cả lời gọi đồng bộ (REST) lẫn bất đồng bộ (RabbitMQ, SSE). Đây là chỗ dễ vẽ sai nhất và cũng hay bị hỏi nhất. Vẽ sau C1, C2 thì sơ đồ khớp code đã sửa (gửi sự kiện sau commit, nhiều tab).

> Hạn OOAD tới trước khi code xong: vẽ theo code hiện có cộng đặc tả C1, C2, đánh dấu "dự kiến" ở phần chưa code. Code xong thì cập nhật lại.

## Sản phẩm (lưu ở `docs/ooad/C-thuc-thi/`)
1. `seq-duyet-task.puml` — sequence "Owner duyệt task → task con tự mở khóa". Có các lifeline: `TaskDetailModal`, `usePhaseKanban`, `tasks.ts`, `NodeController`, `StateMachineService`, `NodeRepository`, `WorkflowEventPublisher`, RabbitMQ (`queue`), `WorkflowEventConsumer`, `SseEmitterService`, trình duyệt (EventSource). Thể hiện: message bất đồng bộ; gửi **sau commit**; `loop [mỗi task con]`; `alt [ALL_COMPLETED] / [ANY_COMPLETED]`; `opt [đủ điều kiện]`.
2. `seq-nop-bai.puml` — sequence "Nộp bài kèm minh chứng". Có `opt [có link]` và thông báo bất đồng bộ cho owner.
3. `comm-nop-bai.puml` — sơ đồ communication chuyển từ sơ đồ 2.
4. `class-thuc-thi.puml` — class diagram thiết kế: `NodeController`, `StateMachineService`, `WorkflowEventPublisher`, `WorkflowEventConsumer`, `SseEmitterService`, `RealtimeController`, `TaskOverdueScanner`, `NotificationController` (C3), `ArtifactController`/`ArtifactService`, các entity `NodeEntity`, `ArtifactEntity`, `NotificationEntity`, các enum `NodeStatus`, `JoinPolicy`, `ArtifactType`, và các record sự kiện (`TaskCompletedEvent`, `NotificationEvent`).
5. `state-task.puml` — **sơ đồ trạng thái task đầy đủ** (sơ đồ quan trọng nhất của dự án): LOCKED, TODO, IN_PROGRESS, REVIEW, DONE. Mỗi chuyển ghi dạng `sự kiện [điều kiện] / hành động`, ví dụ `approve [là Owner] / bắn TaskCompletedEvent`, `reject(lý do) [Owner và lý do không rỗng] / lưu rejectReason`, `forceUnlock [Owner]`, `autoUnlock [cha thỏa ALL/ANY]`. Tùy chọn nâng cao: vẽ `isOverdue` thành một vùng song song (orthogonal region).
6. `nhat-quan.md` — ma trận nhất quán: message → phương thức → `file:dòng`; và mỗi chuyển trạng thái → nhánh `if` tương ứng trong `StateMachineService.updateStatus`.

## Bước 0 — Tự đọc, không dùng AI
Đọc: cẩm nang mục 3.4, 3.5, 3.6, 3.7 và mục 4; code C1, C2 đã merge; ghi chép C1, C2 của chính bạn.
Trả lời:
1. Message tới RabbitMQ là đồng bộ hay bất đồng bộ? Vẽ mũi tên loại nào, vì sao?
2. Vì sao `WorkflowEventConsumer` không cần mũi tên trả về cho `StateMachineService.updateStatus`?
3. Sơ đồ state của bạn có trạng thái kết thúc không? DONE có phải trạng thái kết thúc không?

## Được đọc
- `docs/**`, `wpe-backend/src/**`, `wpe-frontend/src/**`

## Được ghi
- `docs/ooad/C-thuc-thi/**`, `docs/ooad/png/C-*.png`
- `docs/tasks/C-thuc-thi/C8-ooad-thiet-ke.md`

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 Vẽ tay sơ đồ 1, 4, 5 trước, nhìn code thật để vẽ (không dùng AI).
3. 🧠 Tự lập ma trận nhất quán. Message nào không có phương thức thật thì sửa sơ đồ, hoặc ghi lý do.
4. 🤝 Nhờ Claude soát lỗi ký hiệu và đối chiếu với code. Bạn tự sửa.
5. 🤝 Vẽ các sơ đồ còn lại, chép sang PlantUML, render, xuất PNG.
6. Mở PR. Người review (D) chọn ngẫu nhiên 5 message và dò tới code.

## Tiêu chí xong
- [ ] Đủ 6 sản phẩm, render được, có PNG.
- [ ] Người review dò 5 message ngẫu nhiên đều tìm thấy phương thức thật.
- [ ] Mỗi chuyển trạng thái trong sơ đồ state ứng với đúng một nhánh code, và mỗi nhánh code có trong sơ đồ.
- [ ] Checklist cẩm nang của từng sơ đồ đạt hết, hoặc mục nào không đạt thì có giải thích.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn tài liệu)
1. Vẽ lại trên bảng sơ đồ state của task trong 10 phút, đủ điều kiện và hành động.
2. Chỉ trên sequence 1: điểm nào là "sau commit"? Nếu gửi trước commit thì sơ đồ sẽ khác thế nào?
3. Nêu 2 mẫu thiết kế có trong sơ đồ class của bạn (gợi ý: Observer, Publish–Subscribe).

## Cấm
- Dùng AI vẽ bản đầu tiên của sơ đồ 1, 4, 5.
- Vẽ phương thức không có trong code mà không đánh dấu "dự kiến".
- Tự ghi trạng thái `xong`.

## Dành cho Claude (đọc trước khi làm)
Người dán file này đang **học vẽ sơ đồ thiết kế OOAD** khớp với code thật.
1. Không vẽ hộ bản đầu tiên của sơ đồ 1, 4, 5.
2. Khi soát: đối chiếu từng message và từng lớp với code trong repo (đọc file thật, không đoán). Chỉ ra chỗ lệch và để họ tự sửa.
3. Chấm theo checklist trong `docs/ooad/CAM_NANG_VE_SO_DO.md`.
4. Cuối buổi, hỏi họ 3 câu trong "Câu hỏi bảo vệ".

## Ghi chép của người làm
### Trả lời Bước 0

### Ảnh bản vẽ tay đầu tiên

### Ma trận nhất quán: các chỗ lệch đã tìm thấy và cách xử lý

### Lỗi Claude hoặc người review chỉ ra và cách mình sửa
