# C8 — Sơ đồ thiết kế OOAD: mảng Chạy task & Realtime (khớp code thật)

Người làm: C
Người review: D
Trạng thái: chờ kiểm
Cần có trước: C7, C2
Cần trước bước frontend: không
Mở khóa: X3
Nhánh git: c8-ooad-thiet-ke
Ước lượng: 1–1,5 ngày

> ⚡ **Chế độ sprint:** Claude làm hết các bước, kể cả 🧠; bỏ qua Bước 0 và mục "Dành cho Claude". Luồng làm: [SPRINT_2_NGAY.md](../SPRINT_2_NGAY.md) mục 2–3.
> - **Claude tự chạy bằng dòng lệnh:** render các file `.puml` ra PNG.
> - **Dời về buổi kiểm chung (mục 7):** không có.
> - **Không làm trong sprint:** vẽ tay bản đầu trên giấy. Claude vẽ từ code thật; vòng hiểu là người làm giải thích lại 1 sơ đồ sequence (task số 7 thì 1 sơ đồ activity).

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
Chế độ sprint (12/11/2026 tối): Claude vẽ đủ 6 sản phẩm từ code thật, không có bản vẽ tay. Ma trận đầy đủ ở `docs/ooad/C-thuc-thi/nhat-quan.md`. Số dòng backend lấy theo main + C4 (#49), vì từ lúc C4 tách nhánh main không sửa file backend nào của mảng C.
- **Lifeline `tasks.ts` không có trong code:** lời gọi API task nằm ở `HttpWorkflowService.ts`, nên sơ đồ dùng lớp này.
- **Lifeline trình duyệt nhận `TASK_UNLOCKED`:** chỉ `MyTasksView` gọi `connectRealtime`, nên vẽ là "EventSource trong MyTasksView của người phụ trách task con".
- **Sơ đồ state:** ngoài `StateMachineService` còn 4 chỗ đổi trạng thái ở code mảng B (xuất bản dự án, sửa cạnh khóa/mở lại, tạo node, clone template) và 2 chỗ gỡ cờ trễ hạn (`updateNode`, `updateAssignment`). Đã vẽ đủ, ghi (B). Trạng thái đầu có 2 nhánh: node trong phase / có cạnh vào → LOCKED, còn lại → TODO. Lần dò đầu chỉ tìm `setStatus(NodeStatus.` nên sót 2 chỗ tạo node; tìm rộng thêm `.status(` và `NodeEntity.builder()` mới thấy.
- **"Nộp bài" có 2 nhánh code** (kéo thẻ qua `updateStatus` và nộp kèm link qua `submitTaskArtifact`), nên vẽ 2 chuyển IN_PROGRESS → REVIEW để mỗi chuyển ứng đúng một nhánh.
- **Vùng song song `isOverdue`:** smetana (bộ vẽ không cần Graphviz) không vẽ được nét chia vùng, máy không có Graphviz, nên vẽ 2 khối con cạnh nhau và ghi chú.
- **Giao diện không nghe `TASK_SUBMITTED`, `TASK_REJECTED`, `TASK_OVERDUE`:** ghi trên sơ đồ và ở nhat-quan mục 5 (việc của C6).

### Lỗi Claude hoặc người review chỉ ra và cách mình sửa
- Nhãn `opt [..]`, `loop [..]` gõ kèm ngoặc vuông bị PlantUML hiểu thành link → bỏ ngoặc (PlantUML tự thêm).
- Ảnh rộng hơn 4096 px bị PlantUML cắt (`seq-nop-bai` rộng 4098 px) → render với `-DPLANTUML_LIMIT_SIZE=16384`.
- **Lỗ hổng tìm thấy khi vẽ:** `NodeController` nhận `?currentUserId=` và mặc định user 2 khi không đăng nhập → ai cũng tự xưng Owner để duyệt bài được. Cùng kiểu D báo ở #49. Đã vá ở PR #56 (người làm yêu cầu). Ghi ở nhat-quan mục 5.

**Render:** `java -DPLANTUML_LIMIT_SIZE=16384 -jar ~/.vscode/extensions/jebbs.plantuml-2.18.1/plantuml.jar -charset UTF-8 -tpng`. Đã mở xem cả 6 ảnh: đủ chữ, không lỗi. PNG: `docs/ooad/png/C-state-task.png`, `C-seq-duyet-task.png`, `C-seq-nop-bai.png`, `C-comm-nop-bai.png`, `C-class-thuc-thi.png`, `C-class-thuc-thi-du-lieu.png`.

**Tự chấm theo cẩm nang mục 3:**
- Sequence 8/9 (cả 2 sơ đồ). Message RabbitMQ và SSE dùng mũi tên hở; điểm "sau commit" là dải `== Proxy @Transactional commit ==`. Chưa đạt "mỗi message là phương thức có trong class diagram của lớp nhận" cho message tới lớp giao diện (cùng lý do với mục Class bên dưới).
- Communication 5/5.
- Class 8/9. Chưa đạt "phương thức xuất hiện trong sequence đều có trong lớp tương ứng" cho phần giao diện (`usePhaseKanban`, `HttpWorkflowService`, `TaskDetailModal`): class diagram chỉ vẽ backend (giống B). Phương thức FE được dò bằng `file:dòng` trong nhat-quan.
- State 8/8.

**Mở PR theo yêu cầu người làm (12/11/2026). Người làm còn phải làm trước khi D merge:** vòng hiểu — giải thích lại 1 sơ đồ sequence (gợi ý `seq-duyet-task`: chỉ ra điểm "sau commit"). Nên merge sau C7 (#57).

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**
