# B4 — Xuất bản dự án: kiểm thử và vá `publishPipeline` (Cụm 4.5)

Người làm: B
Người review: C
Trạng thái: chờ kiểm
Cần có trước: B3
Cần trước bước frontend: không
Mở khóa: B6, B8
Nhánh git: b4-publish
Ước lượng: 0,5–1 ngày

> **Cập nhật 11/11/2026 (sau khi pull):** `POST /projects/{id}/publish` đã có (`WorkflowGraphService.publishPipeline`): chạy Kahn, chuyển ACTIVE, mở khóa node gốc. Task này vá các chỗ chưa đúng đặc tả.

> ⚡ **Chế độ sprint:** Claude làm hết các bước, kể cả 🧠; bỏ qua Bước 0 và mục "Dành cho Claude". Luồng làm: [SPRINT_2_NGAY.md](../SPRINT_2_NGAY.md) mục 2–3.
> - **Claude tự chạy bằng dòng lệnh:** tạo chu trình bằng SQL rồi xuất bản → 422; dự án DRAFT → 200 và đối chiếu `unlockedTaskCount` bằng SQL; dự án ARCHIVED → 409.
> - **Dời về buổi kiểm chung (mục 7):** mở 2 tab, người phụ trách node gốc nhận `TASK_UNLOCKED` (bảng 7.2 dòng 8).
> - **Không làm trong sprint:** không có.

## Vì sao cần task này
Đọc code thấy:
1. Chỉ chặn khi dự án **đã** ACTIVE. Dự án `ARCHIVED`, `PAUSED`, `COMPLETED`… vẫn "xuất bản" được, và bị chuyển thẳng sang ACTIVE.
2. Lỗi "đã xuất bản" trả 400 (`IllegalArgumentException`), trong khi đây là xung đột trạng thái nên phải là 409.
3. Node gốc được mở khóa nhưng người phụ trách **không nhận** SSE `TASK_UNLOCKED` hay thông báo nào.
4. `cycleNodes` trả về gồm cả node đứng sau vòng (B1 đã sửa cách tính, B4 phải dùng kết quả mới).

## Kiến thức phải nắm
Transaction, gửi sự kiện sau khi commit (`TransactionSynchronization.afterCommit`), vòng đời dự án, tính lũy đẳng.

## Bước 0 — Tự đọc, không dùng AI
Đọc: integration map 4.5 và Chương III; `docs/specs/workflow-engine.md` mục 4 và 5.1; hàm `publishPipeline` trong `WorkflowGraphService.java`; `FE/components/settings/KahnCycleModal.tsx`.
Trả lời:
1. Mỗi cạnh đã được kiểm khi thêm (B3), vì sao xuất bản vẫn phải chạy Kahn cả dự án? (gợi ý: dữ liệu clone, seed, SQL gõ tay)
2. Chỉ ra dòng code của lỗi 1 và lỗi 3.
3. Vì sao SSE phải gửi **sau** khi commit?

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `wpe-backend/src/**`, `FE/**`, `docs/**`

## Được ghi
- `BE/service/WorkflowGraphService.java` (chỉ `publishPipeline`), `BE/dto/response/graph/PublishPipelineResponse.java`
- `BE-test/service/WorkflowGraphServiceTest.java`
- `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md` (4.5), `docs/specs/workflow-engine.md` (5.1), `docs/tasks/B-do-thi/B4-xuat-ban-du-an.md`

## Đặc tả đã chốt
- Chỉ xuất bản được từ `DRAFT` hoặc `PLANNING` (code tạo dự án đang đặt PLANNING; D1 sẽ đổi về DRAFT). Trạng thái khác → 409 `INVALID_PROJECT_STATUS`.
- Có chu trình → 422 `CYCLE_DETECTED`, `cycleNodes` = `cycleNodeCodes` theo cách tính mới của B1.
- Mỗi node vừa mở khóa có người phụ trách: gửi `SseEmitterService.sendToUser(assignee, "TASK_UNLOCKED", …)` và `WorkflowEventPublisher.publishNotification(…)`, **sau khi commit** (theo cách C1 chốt; nếu C1 chưa merge thì tự dùng `TransactionSynchronization.afterCommit` và báo C). Gọi hàm có sẵn, không sửa file của C.
- Giữ response `{ success, status, publishedAt, unlockedTaskCount }`.

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 Viết test **đỏ** cho lỗi 1–3 trước khi sửa.
3. 🤝 Sửa, cho test xanh.
4. 🧠 Tạo chu trình bằng SQL gõ tay trong DBeaver (vượt qua lớp kiểm của B3), rồi xuất bản → 422.
5. 🤝 Cập nhật docs.

## Tiêu chí xong
- [x] Test lỗi 1–3: fail trước khi sửa, pass sau khi sửa.
- [x] Swagger: dự án DRAFT hợp lệ → 200, `unlockedTaskCount` đúng (đối chiếu SQL); dự án ARCHIVED → 409; có chu trình → 422. (Chạy bằng curl và psql, xem "Kết quả test".)
- [ ] Mở 2 tab: người phụ trách node gốc nhận `TASK_UNLOCKED` ngay sau khi owner xuất bản.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. Gửi SSE trước commit thì có thể sai thế nào?
2. `cycleNodeCodes` khác `blockedNodeCodes` thế nào?
3. Độ phức tạp của xuất bản tính theo số node và số cạnh?

## Cấm
- Sửa file ngoài mục "Được ghi". File dùng chung thì báo nhóm trước (README mục 6).
- Sửa `StateMachineService.java`, `SseEmitterService.java`, `WorkflowEventPublisher.java` (của C).
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
> Làm ở chế độ sprint ngày 12/11/2026, nhánh `b4-publish` tách từ main `5aa5b0b`. Phần này do Claude ghi.

**`WorkflowGraphService.java`** — chỉ sửa thân hàm `publishPipeline`, cộng 1 field `WorkflowEventPublisher eventPublisher` và 4 dòng import mà hàm này cần (không đụng hàm của B2, B3):
1. **Lỗi 1 và 2 (trạng thái):** gọi `ensureNotArchived(project)` có sẵn (ARCHIVED → 409 `PROJECT_ARCHIVED`), sau đó nếu trạng thái không phải `DRAFT`/`PLANNING` thì ném `ConflictException("INVALID_PROJECT_STATUS", …)` → 409. Bỏ `IllegalArgumentException` (400) cũ.
2. **Lỗi 3 (sự kiện):** mỗi node gốc vừa đổi `LOCKED` → `TODO` có người phụ trách sinh 1 SSE `TASK_UNLOCKED` và 1 `NotificationEvent` loại `TASK_READY` (cùng tiêu đề, `targetUrl` như `StateMachineService`). Các việc gửi được gom vào danh sách rồi đăng ký `TransactionSynchronization.afterCommit`, nên chỉ chạy sau khi commit. Không có transaction đang mở (unit test gọi thẳng) thì gửi ngay.
3. Mỗi lần gửi tự `try/catch`: dữ liệu đã commit, nên SSE hay RabbitMQ hỏng chỉ ghi log, không làm request trả 500.
4. Payload SSE (`nodeMapper.toKanbanTaskResponse`) được tạo **bên trong** `afterCommit`. Lần kiểm thật đầu tiên cho thấy tạo trước commit thì payload mang `version: 0` trong khi DB đã là 1 (client dùng version cũ sẽ bị 409 khi bấm bắt đầu). Đã thêm assert vào test, chạy thấy fail, rồi mới sửa.
5. `publishedAt` trong response và `project.updatedAt` dùng chung một mốc thời gian.
6. **Lỗi 4 (`cycleNodes`):** code đã dùng `result.cycleNodeCodes()` của B1 từ trước, không cần sửa. Thêm 1 test khóa lại hành vi này.

**`WorkflowGraphServiceTest.java`** — thêm `@Mock WorkflowEventPublisher` và 9 test (44 → 53).

**`PublishPipelineResponse.java`** — không sửa (giữ nguyên 4 trường theo đặc tả).

**Docs:** integration map 4.5 (luật trạng thái, 409, sự kiện sau commit, định nghĩa `cycleNodes` và `unlockedTaskCount`); `workflow-engine.md` 5.1 (luật xuất bản, thứ tự kiểm, độ phức tạp).

**Đã tự kiểm lại trên main mới (không tin ghi chú cũ):**
- `wpe-backend/mvnw` đã có (A1) → chạy test bằng `./mvnw -B test`.
- **C1 chưa merge** (không có nhánh `c1-*`, trong `src/main` không có `afterCommit` hay `@TransactionalEventListener`) → tự dùng `TransactionSynchronization.afterCommit`.
- `X-Debug-User-Id` vẫn dùng được khi request không có header `Authorization` (`CurrentUserProvider`).
- Dự án tạo mới giờ là `DRAFT` (D1): `POST /projects` trả dự án `DRAFT`.

### Kết quả test (dán output thật, không chép tay)

**1. Test đỏ trước khi sửa** (`./mvnw -B -q test -Dtest=WorkflowGraphServiceTest`): 7 test mới fail, đúng vào lỗi 1–3.
```
[ERROR] Tests run: 53, Failures: 7, Errors: 0, Skipped: 0, Time elapsed: 3.953 s <<< FAILURE! -- in com.pipeline.wpe.service.WorkflowGraphServiceTest
[ERROR]   WorkflowGraphServiceTest.testPublishPipelineAlreadyActiveIsConflict:378 Unexpected exception type thrown, expected: <com.pipeline.wpe.exception.ConflictException> but was: <java.lang.IllegalArgumentException>
[ERROR]   WorkflowGraphServiceTest.testPublishPipelineNotifiesAssigneesOfUnlockedRoots:410 
[ERROR]   WorkflowGraphServiceTest.testPublishPipelineRejectsArchived:366 Expected com.pipeline.wpe.exception.ConflictException to be thrown, but nothing was thrown.
[ERROR]   WorkflowGraphServiceTest.testPublishPipelineRejectsNonDraftStatuses:351 Dự án PAUSED phải bị chặn xuất bản ==> Expected com.pipeline.wpe.exception.ConflictException to be thrown, but nothing was thrown.
[ERROR]   WorkflowGraphServiceTest.testPublishPipelineSendsEventsOnlyAfterCommit:438 expected: <1> but was: <0>
[ERROR]   WorkflowGraphServiceTest.testPublishPipelineSkipsRootsAlreadyTodo:477 
[ERROR]   WorkflowGraphServiceTest.testPublishPipelineSurvivesNotificationFailure:461 
```
Hai test mới **pass ngay từ đầu, không tái hiện lỗi nào**: `testPublishPipelineFromPlanning` (PLANNING vốn đã xuất bản được) và `testPublishPipelineCycleNodesExcludeDownstream` (lỗi 4 đã được B1 sửa ở `KahnDagService`, `publishPipeline` vốn đã dùng `cycleNodeCodes`). Tức lỗi 4 trong task không còn trên main; hai test này chỉ để giữ hành vi.

Test đỏ thứ hai (payload tạo trước commit, mang version cũ), sau khi thêm assert `verify(nodeMapper, never())`:
```
[ERROR] Tests run: 53, Failures: 1, Errors: 0, Skipped: 0, Time elapsed: 4.008 s <<< FAILURE! -- in com.pipeline.wpe.service.WorkflowGraphServiceTest
[ERROR]   WorkflowGraphServiceTest.testPublishPipelineSendsEventsOnlyAfterCommit:437 
```

**2. Sau khi sửa, chạy toàn bộ** (`./mvnw -B test`):
```
[INFO] Tests run: 53, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.368 s -- in com.pipeline.wpe.service.WorkflowGraphServiceTest
[WARNING] Tests run: 297, Failures: 0, Errors: 0, Skipped: 1
[INFO] BUILD SUCCESS
```
1 test skip là `SeedPasswordHashTest` (có sẵn trên main, không thuộc B4).

**3. Kiểm thật bằng curl và psql** (backend cổng 8081, `--spring.jpa.show-sql=true`, không commit cấu hình). Dùng một dự án thử tạo mới qua API (alex = 2 là owner), 1 phase, 4 node: T1 (gốc, sarah = 3), T2 (gốc, không ai phụ trách), T3 (con của T1, sarah), T4 (không thuộc phase, sarah). Output lần chạy sau khi sửa xong:
```
== 1. Tao du an moi (alex = 2)
HTTP 201
projectId=4, status luc tao = DRAFT
Node truoc khi xuat ban (code|status|assignee):
T1|LOCKED|3
T2|LOCKED|
T3|LOCKED|3
T4|TODO|3
== 3. API chan vong: noi T3 -> T1 qua API
{"timestamp":"2026-11-12T02:30:21.459288600Z","status":422,"error":"CYCLE_DETECTED","message":"Không thể nối: tạo chu trình lặp phụ thuộc giữa các công việc.","path":"/api/v1/projects/4/dependencies","cycleNodes":["T1","T3"]}
HTTP 422
== 4. Chen canh T3 -> T1 bang SQL (vuot lop kiem cua B3), roi xuat ban
INSERT 0 1
{"timestamp":"2026-11-12T02:30:22.464523300Z","status":422,"error":"CYCLE_DETECTED","message":"Phát hiện chu trình lặp phụ thuộc trong đồ thị quy trình. Không thể xuất bản.","path":"/api/v1/projects/4/publish","cycleNodes":["T1","T3"]}
HTTP 422
status sau 422 = DRAFT
DELETE 1
Da xoa canh tao vong. So canh con lai: 1
== 5. Doi sang ARCHIVED bang SQL roi xuat ban
UPDATE 1
{"timestamp":"2026-11-12T02:30:24.336729400Z","status":409,"error":"PROJECT_ARCHIVED","message":"Dự án đã được lưu trữ, chỉ có thể xem. Không thể chỉnh sửa đồ thị.","path":"/api/v1/projects/4/publish"}
HTTP 409
== 6. Doi sang PAUSED bang SQL roi xuat ban
UPDATE 1
{"timestamp":"2026-11-12T02:30:24.879166Z","status":409,"error":"INVALID_PROJECT_STATUS","message":"Chỉ xuất bản được dự án đang ở trạng thái DRAFT hoặc PLANNING. Trạng thái hiện tại: PAUSED.","path":"/api/v1/projects/4/publish"}
HTTP 409
UPDATE 1
Da tra status ve DRAFT; node LOCKED = 3
== 7. sarah (3) khong phai owner thu xuat ban
{"timestamp":"2026-11-12T02:30:26.473926400Z","status":403,"error":"ACCESS_DENIED","message":"Chỉ Chủ dự án (Project Owner) mới có quyền thực hiện hành động này.","path":"/api/v1/projects/4/publish"}
HTTP 403
== 8. sarah mo SSE, alex xuat ban
SQL du doan unlockedTaskCount (node goc dang LOCKED) = 2
{"success":true,"status":"ACTIVE","publishedAt":"2026-11-12T02:30:29.763737900Z","unlockedTaskCount":2}
HTTP 200
Sau khi xuat ban: status = ACTIVE
T1|TODO|3
T2|TODO|
T3|LOCKED|3
T4|TODO|3
-- SSE sarah nhan duoc:
event:INIT
data:Connected successfully to Workflow Pipeline Real-time Stream

event:TASK_UNLOCKED
data:{"id":"11","phaseId":"5","code":"T1","title":"Goc cua sarah","description":null,"status":"TODO","assignedUserId":"3","joinPolicy":"ALL_COMPLETED","rejectReason":null,"dueDate":null,"isOverdue":false,"version":1,"uiMetadata":{"width":220,"height":90,"position":{"x":200,"y":150}},"artifacts":null}

event:NOTIFICATION_RECEIVED
data:{"id":2,"userId":3,"title":"Tác vụ sẵn sàng thực hiện","message":"Dự án đã được xuất bản. Tác vụ T1 (Goc cua sarah) đã mở khóa, bạn có thể bắt đầu!","linkUrl":"/projects/4/tasks","isRead":false,"createdAt":"2026-11-12T02:30:29.837429Z"}

== 9. Xuat ban lan 2
{"timestamp":"2026-11-12T02:30:38.898269900Z","status":409,"error":"INVALID_PROJECT_STATUS","message":"Chỉ xuất bản được dự án đang ở trạng thái DRAFT hoặc PLANNING. Trạng thái hiện tại: ACTIVE.","path":"/api/v1/projects/4/publish"}
HTTP 409
```
Đối chiếu:
- `unlockedTaskCount` = 2 khớp SQL đếm node gốc đang `LOCKED` trước khi xuất bản (T1, T2). T4 là node gốc nhưng đã `TODO` từ lúc tạo nên không tính (xem "Điều chưa chắc" 2).
- sarah nhận đúng 1 `TASK_UNLOCKED` (T1). T2 không có người phụ trách, T3 còn `LOCKED`, T4 không đổi trạng thái nên không có sự kiện.
- `version` trong payload = 1, khớp DB (`select code, version from node` → `T1|1`). Lần chạy đầu (trước khi sửa điểm 4 ở trên) payload mang `"version":0` trong khi DB là 1.
- Thứ tự trong log backend: dòng `Project #4 published successfully` (760) → 6 câu `update` của Hibernate cho `project` và `node` (761–818, chạy lúc commit) → `Đã bắn SSE event [TASK_UNLOCKED] tới User ID [3]` (819) → `Publishing NotificationEvent` (820). Tức sự kiện đi sau khi dữ liệu đã ghi.

**Đã dọn sau khi kiểm:** xóa cạnh tạo vòng chèn bằng SQL; trả trạng thái dự án thử về `DRAFT` sau bước ARCHIVED/PAUSED; cuối cùng xóa hẳn 2 dự án thử (id 3 và 4, tên "B4 kiem xuat ban", của 2 lần chạy) cùng node, cạnh, phase của chúng, và 2 dòng `notification` (id 1, 2) sinh ra khi kiểm. DB còn đúng 2 dự án như trước (`1|ACTIVE|Core Banking Pipeline`, `2|PLANNING|a`), bảng `notification` rỗng như trước. Đã tắt tiến trình backend ở cổng 8081. Dữ liệu dự án mẫu id 1 không bị đụng.

Ghi chú môi trường: lần khởi động đầu Flyway chạy V8 theo kiểu out-of-order (`Migrating schema "public" to version "8 - fix invitation unique" [out of order]`), không báo lỗi validate nên **không** phải `docker compose down -v`.

**Chưa làm (cần trình duyệt, dời về buổi kiểm chung):** tiêu chí "mở 2 tab" (bảng 7.2 dòng 8). Phần backend của nó đã kiểm bằng curl ở bước 8, nhưng chưa ai xem giao diện có hiện task mới hay không.

### Điều chưa chắc / cần nhóm quyết
1. **Báo C: C1 chưa merge, B4 tự dùng `TransactionSynchronization.afterCommit`** ngay trong `publishPipeline`. Khi C1 chốt cách gửi sau commit chung thì nên đổi chỗ này theo cho thống nhất. Hai chỗ khác vẫn gửi SSE **trước** commit và B4 không được sửa: `recomputeNodeStatus` (B3) và `StateMachineService.unlockDownstreamTasks` (C). Hai chỗ đó nhiều khả năng cũng dính lỗi payload mang `version` cũ như B4 gặp ở lần kiểm đầu (chưa kiểm thật, chỉ suy từ cùng cách viết).
2. **`unlockedTaskCount` không bằng "số task gốc sẵn sàng làm".** Nó chỉ đếm node đổi `LOCKED` → `TODO` trong lần xuất bản. Node gốc đã `TODO` từ trước thì không tính và người phụ trách **không** nhận `TASK_UNLOCKED` lúc xuất bản. Có 2 đường dẫn tới việc này khi dự án còn DRAFT: (a) node không thuộc phase được tạo ra đã là `TODO` (`createNode`); (b) gỡ cạnh làm node `LOCKED` hết cha thành `TODO` (điểm B3 để lại). Kiểm thật: dự án thử có 3 node gốc (T1, T2, T4) nhưng `unlockedTaskCount` = 2 vì T4 đã `TODO`. Con số không sai theo định nghĩa "vừa mở khóa", nhưng nếu giao diện hiển thị "đã mở N task" thì sẽ thấp hơn số task thật sự làm được. Với đường (b), người phụ trách còn nhận `TASK_UNLOCKED` ngay lúc gỡ cạnh, khi dự án chưa xuất bản. Gốc vấn đề là node được phép `TODO` trong dự án DRAFT; nhóm cần quyết: giữ mọi node `LOCKED` cho tới khi xuất bản (sửa ở code B3 và `createNode`), hay chấp nhận như hiện tại. B4 không tự sửa code B3.
3. **ARCHIVED trả `PROJECT_ARCHIVED`, không phải `INVALID_PROJECT_STATUS`.** Đặc tả ghi "trạng thái khác → 409 `INVALID_PROJECT_STATUS`". B4 dùng lại `ensureNotArchived` để cùng mã với mọi API ghi khác trong file (B2, B3). Vẫn là 409. Nếu nhóm muốn đúng từng chữ đặc tả thì bỏ 1 dòng `ensureNotArchived(project)` trong `publishPipeline`.
4. **Thêm field ngoài thân hàm.** Đặc tả bắt gọi `WorkflowEventPublisher.publishNotification` nhưng service chưa inject class này, nên phải thêm 1 field `eventPublisher` và import (giống cách B3 thêm `SseEmitterService`). Không sửa file của C.
5. **Thông báo dùng loại `TASK_READY`** và tiêu đề giống `StateMachineService` để chuông thông báo hiện cùng kiểu. Đặc tả không ghi loại nào; C xem có cần loại riêng cho xuất bản không.
6. **Chưa kiểm trường hợp RabbitMQ tắt trên máy thật** (chỉ có unit test `testPublishPipelineSurvivesNotificationFailure`).

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**
