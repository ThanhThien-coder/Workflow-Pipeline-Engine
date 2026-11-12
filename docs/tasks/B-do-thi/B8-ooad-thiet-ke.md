# B8 — Sơ đồ thiết kế OOAD: mảng Thiết kế quy trình DAG (khớp code thật)

Người làm: B
Người review: C
Trạng thái: chờ kiểm
Cần có trước: B7, B4
Cần trước bước frontend: không
Mở khóa: X3
Nhánh git: b8-ooad-thiet-ke
Ước lượng: 1–1,5 ngày

> ⚡ **Chế độ sprint:** Claude làm hết các bước, kể cả 🧠; bỏ qua Bước 0 và mục "Dành cho Claude". Luồng làm: [SPRINT_2_NGAY.md](../SPRINT_2_NGAY.md) mục 2–3.
> - **Claude tự chạy bằng dòng lệnh:** render các file `.puml` ra PNG.
> - **Dời về buổi kiểm chung (mục 7):** không có.
> - **Không làm trong sprint:** vẽ tay bản đầu trên giấy. Claude vẽ từ code thật; vòng hiểu là người làm giải thích lại 1 sơ đồ sequence (task số 7 thì 1 sơ đồ activity).

## Vì sao cần task này
Sơ đồ thiết kế trả lời câu hỏi "hệ thống làm việc đó **bằng những lớp nào, gọi nhau ra sao**". Vẽ sau khi B2–B4 đã có code thì sơ đồ khớp code, bạn hiểu luồng thật và trả lời được khi bị hỏi.

> Hạn OOAD tới trước khi code xong: vẽ theo đặc tả trong B2–B4, đánh dấu "dự kiến" ở phần chưa code. Code xong thì cập nhật lại.

## Sản phẩm (lưu ở `docs/ooad/B-do-thi/`)
1. `seq-noi-phu-thuoc.puml` — sequence "Nối phụ thuộc", từ component Mindmap → store → `graph.ts` → `WorkflowGraphController` → `WorkflowGraphService` → `KahnDagService` → repository. Có `alt [tạo vòng] → 422` và `[trùng cạnh] → 409`.
2. `seq-xuat-ban.puml` — sequence "Xuất bản dự án". Có `loop` Kahn, `alt [có chu trình] → 422 / [hợp lệ] → ACTIVE`, `loop` mở khóa node gốc, và message bất đồng bộ tới `SseEmitterService` sau khi commit.
3. `comm-xuat-ban.puml` — sơ đồ communication chuyển từ sơ đồ 2.
4. `class-do-thi.puml` — class diagram thiết kế: controller, service của mảng đồ thị, `KahnDagService` cùng record `ProjectKahnResult`, `PhaseProgressCalculator`, các entity `WorkPhaseEntity`, `PhaseDependencyEntity` (V6), `NodeEntity`, `NodeDependencyEntity`, các repository, DTO, enum `JoinPolicy`. Có visibility, kiểu, bội số, và ký hiệu đúng cho lớp tiện ích tĩnh (`PhaseProgressCalculator`).
5. `state-du-an.puml` — vòng đời dự án: DRAFT/PLANNING → ACTIVE `[Kahn hợp lệ] / mở khóa node gốc`; ACTIVE ⇄ PAUSED; ACTIVE → COMPLETED; → ARCHIVED; ARCHIVED → ACTIVE (khôi phục); INACTIVE (theo đặc tả). Chuyển trạng thái nào **chưa có code** thì ghi note "chưa cài".
6. `object-seed.puml` — sơ đồ đối tượng cho dữ liệu seed (WPE-001…004 và 3 phase), vẽ 2 ảnh chụp: in-degree trước khi chạy Kahn và sau bước đầu tiên.
7. `nhat-quan.md` — ma trận nhất quán: message → phương thức → `file:dòng`.

## Bước 0 — Tự đọc, không dùng AI
Đọc: cẩm nang mục 3.4, 3.5, 3.6, 3.7, 3.11 và mục 4; code B1–B4 đã merge; ghi chép B1–B4 của chính bạn.
Trả lời:
1. Trong sequence, `KahnDagService` là bean Spring còn `PhaseProgressCalculator.compute` là hàm tĩnh: vẽ lifeline cho hai loại này khác nhau thế nào?
2. Sơ đồ đối tượng khác class diagram ở đâu? Vì sao nó giúp giải thích Kahn?
3. Trạng thái INACTIVE (không hoạt động 30 ngày) do ai kích hoạt? Có cần một actor "Bộ hẹn giờ" không?

## Được đọc
- `docs/**`, `wpe-backend/src/**`, `wpe-frontend/src/**`

## Được ghi
- `docs/ooad/B-do-thi/**`, `docs/ooad/png/B-*.png`
- `docs/tasks/B-do-thi/B8-ooad-thiet-ke.md`

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 Vẽ tay sơ đồ 2, 4, 5 trước, nhìn code thật để vẽ (không dùng AI).
3. 🧠 Tự lập ma trận nhất quán. Message nào không có phương thức thật thì sửa sơ đồ, hoặc ghi lý do.
4. 🤝 Nhờ Claude soát lỗi ký hiệu và đối chiếu với code. Bạn tự sửa.
5. 🤝 Vẽ các sơ đồ còn lại, chép sang PlantUML, render, xuất PNG.
6. Mở PR. Người review (C) chọn ngẫu nhiên 5 message và dò tới code.

## Tiêu chí xong
- [x] Đủ 7 sản phẩm, render được, có PNG (8 ảnh: class diagram tách 2 hình).
- [ ] Người review dò 5 message ngẫu nhiên đều tìm thấy phương thức thật. (Việc của người review. Claude đã tự dò toàn bộ 70 tham chiếu `file:dòng` trong `nhat-quan.md` bằng script: tất cả trỏ đúng dòng.)
- [x] Sơ đồ trạng thái dự án khớp enum `ProjectStatus` trong code (đủ 7/7 giá trị; INACTIVE, PLANNING ghi "chưa cài").
- [x] Checklist cẩm nang của từng sơ đồ đạt hết, hoặc mục nào không đạt thì có giải thích.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn tài liệu)
1. Vẽ lại trên bảng sequence "Xuất bản dự án" trong 10 phút.
2. Fragment `alt`, `opt`, `loop` khác nhau thế nào? Mỗi loại có trong sơ đồ của bạn ở đâu?
3. Vì sao `NodeDependencyEntity` có 2 quan hệ tới `NodeEntity`? Bội số của mỗi đầu là gì?

## Cấm
- Dùng AI vẽ bản đầu tiên của sơ đồ 2, 4, 5.
- Vẽ phương thức không có trong code mà không đánh dấu "dự kiến".
- Tự ghi trạng thái `xong`.

## Dành cho Claude (đọc trước khi làm)
Người dán file này đang **học vẽ sơ đồ thiết kế OOAD** khớp với code thật.
1. Không vẽ hộ bản đầu tiên của sơ đồ 2, 4, 5.
2. Khi soát: đối chiếu từng message và từng lớp với code trong repo (đọc file thật, không đoán). Chỉ ra chỗ lệch và để họ tự sửa.
3. Chấm theo checklist trong `docs/ooad/CAM_NANG_VE_SO_DO.md`.
4. Cuối buổi, hỏi họ 3 câu trong "Câu hỏi bảo vệ".

## Ghi chép của người làm
> Làm ngày 12/11/2026 ở chế độ sprint (Claude vẽ từ code thật), nhánh `b8-ooad-thiet-ke` tách từ nhánh B7 (`b7-ooad-phan-tich`, đã trên main `77416de`: có B4, B5, B6, B9, C1, vai trò MANAGER). Phần này do Claude ghi; người B đọc lại ở giai đoạn Học lại.

**Sản phẩm (`docs/ooad/B-do-thi/`, ảnh ở `docs/ooad/png/B-*.png`):**

| # | File | Nội dung chính |
| :-: | :--- | :--- |
| 1 | `seq-noi-phu-thuoc.puml` | 12 lifeline từ `:MindmapTree` tới repository, 45 message. `alt` cạnh đã có (lũy đẳng) / cạnh mới; trong cạnh mới: `alt` tạo vòng → 422 / công việc con đã bắt đầu → 409 `NODE_IN_USE` / hợp lệ → 201 |
| 2 | `seq-xuat-ban.puml` | 15 lifeline, 40 message. `loop` Kahn lồng nhau (hàng đợi, công việc con), `opt` bóc đuôi vòng lặp, `alt` có chu trình → 422 / hợp lệ → ACTIVE, `loop` mở khóa công việc gốc, `afterCommit()` gửi SSE và thông báo bằng mũi tên hở (bất đồng bộ), `afterCompletion` gửi RabbitMQ |
| 3 | `comm-xuat-ban.puml` | Chuyển từ sơ đồ 2, đánh số 1 → 1.1 → … → 1.1.1.1.7, 2.x (sau commit), 3.x (sau completion) |
| 4 | `class-do-thi.puml` | **2 hình**: `class-do-thi` (controller, service, `KahnDagService` + `ProjectKahnResult`, `PhaseProgressCalculator` `<<utility>>` với `{static} compute`); `class-do-thi-du-lieu` (repository, entity, enum, DTO). Có visibility, kiểu, bội số |
| 5 | `state-du-an.puml` | 7 trạng thái đúng enum `ProjectStatus`, chuyển trạng thái theo `publishPipeline` và `ALLOWED_TRANSITIONS` |
| 6 | `object-seed.puml` | Dữ liệu seed dự án 1 (3 phase, WPE-001…004, 3 cạnh) và 2 ảnh chụp `inDegree`/`queue`/`sortedOrder`: trước vòng lặp Kahn, sau bước 1 |
| 7 | `nhat-quan.md` | Ma trận message → phương thức → `file:dòng` cho 2 sequence, đối chiếu class, state, object |

### Trả lời Bước 0
(Claude trả lời theo chế độ sprint.)
1. **`KahnDagService` là bean Spring** nên vẽ thành lifeline `:KahnDagService` (một đối tượng do Spring tạo và tiêm vào `WorkflowGraphService`), có message `validateProjectDag(...)` tới nó. **`PhaseProgressCalculator.compute` là hàm tĩnh**: không có đối tượng nào để gửi message tới, nên trong sequence không vẽ lifeline đối tượng cho nó. Nếu cần thì vẽ lifeline ghi tên lớp kèm `<<utility>>` và message `compute(...)` gạch chân (static). Hai sequence của B8 không đi qua `compute` (nó dùng trong `getGraph`), nên chỉ thể hiện ở class diagram với `{static}`.
2. **Class diagram** mô tả **kiểu**: lớp nào có thuộc tính, phương thức gì, liên hệ ra sao, đúng mọi lúc. **Object diagram** chụp **giá trị cụ thể tại một thời điểm**: `n2 : NodeEntity` với `code = "WPE-002"`, `inDegree` của WPE-002 = 1. Kahn là thuật toán đổi giá trị theo từng bước (in-degree giảm dần, hàng đợi thay đổi), nên 2 ảnh chụp "trước" và "sau bước 1" cho thấy thuật toán chạy thế nào, điều class diagram không làm được.
3. **INACTIVE** theo đặc tả do **thời gian** kích hoạt (30 ngày không tương tác), nên trong use case cần actor "Bộ hẹn giờ". Nhưng **trong code chưa có job nào** chuyển dự án sang INACTIVE, nên sơ đồ trạng thái ghi "chưa cài", và sơ đồ use case mảng B (B7) không thêm actor này.

### Ảnh bản vẽ tay đầu tiên
Không có: chế độ sprint bỏ bước vẽ tay ("Không làm trong sprint: vẽ tay bản đầu trên giấy"). Dời sang giai đoạn Học lại.

### Ma trận nhất quán: các chỗ lệch đã tìm thấy và cách xử lý
Ma trận đầy đủ: [`nhat-quan.md`](../../ooad/B-do-thi/nhat-quan.md). Không có message nào thiếu phương thức thật. Kiểm bằng script: in đúng dòng code mà từng tham chiếu `file:dòng` trỏ tới; cả 70 tham chiếu đều đúng.

Các chỗ **file task lệch code**, sơ đồ vẽ theo code:
1. **`[trùng cạnh] → 409` không có trong code.** `createDependency` lũy đẳng: cạnh đã có thì trả về cạnh cũ (201), không báo lỗi (`WorkflowGraphService.java:343–344`). Sơ đồ 1 vẽ thành nhánh `alt cạnh đã có`. 409 trong sơ đồ là `NODE_IN_USE` (công việc con đã bắt đầu, dòng 369). Cùng lệch với B7 (`EDGE_EXISTS`).
2. **RabbitMQ gửi qua `afterCompletion`, không gửi thẳng.** Sau C1, `WorkflowEventPublisher.publishNotification` gọi `sendAfterCommit` → `registerSynchronization(afterCompletion)` (dòng 94–106). Lý do C1 ghi trong code: `publishPipeline` gọi publish từ bên trong `afterCommit`, mà afterCommit đăng ký muộn thì không chạy. Sơ đồ 2, 3 vẽ đúng 2 tầng: `afterCommit` (SSE, hẹn thông báo) rồi `afterCompletion` (gửi RabbitMQ).
3. **Trạng thái dự án:** file task gợi ý "→ ARCHIVED" chung. Code (`ProjectService.ALLOWED_TRANSITIONS`, dòng 40–45) chỉ cho ACTIVE, PAUSED, INACTIVE → ARCHIVED; **DRAFT không lưu trữ được** (409), ghi note "chưa cài". DRAFT/PLANNING → ACTIVE bằng PATCH bị chặn 409 `USE_PUBLISH` (dòng 251). **Không code nào tạo PLANNING** (createProject, cloneTemplate đều tạo DRAFT) và **không có job vào INACTIVE**: cả hai ghi "chưa cài". COMPLETED không có chuyển đi ra.
4. **Sequence Nối phụ thuộc bắt đầu từ `:MindmapTree`**, sau đó tới `:MindmapDrawer` rồi mới tới store (file task ghi "component Mindmap → store"). Lời gọi nằm ở `MindmapDrawer.connectNodes` (B5), nên vẽ đủ cả hai.
5. **"Phụ thuộc giai đoạn" (`PhaseDependencyEntity`)** và cột cũ `work_phase.parent_phase_id` cùng tồn tại; class diagram chỉ vẽ `PhaseDependencyEntity` (cách lưu chính từ V6). Cột cũ vẫn được đọc ở `loadPhaseParents`.

### Lỗi Claude hoặc người review chỉ ra và cách mình sửa
Lỗi Claude tự phát hiện khi render và xem ảnh (bản PlantUML 1.2021 đi kèm extension):
1. **Class diagram bị cắt** ở 4096 px (giới hạn mặc định của PlantUML): mất phần entity, enum, DTO. Sửa: tách 2 hình trong cùng file.
2. **Sơ đồ đối tượng:** dòng `1 (WPE-001) = 0` có ngoặc tròn nên PlantUML tưởng là phương thức và ẩn đi. Sửa thành `[1] WPE-001 = 0`.
3. **Sơ đồ communication:** ký hiệu `⇢` (bất đồng bộ) không có trong font, hiện thành `→`. Sửa: ghi chữ "(bất đồng bộ)". Nhãn "kahnCycleErrors = …" đặt trên đường UI–Slice kèm `←` đọc như Slice gọi UI; chuyển thành ghi chú gắn vào Slice (Slice tự cập nhật).
4. **Sơ đồ trạng thái:** PLANNING thiếu mũi tên đi vào. Sửa: thêm `[*] → PLANNING` ghi "dữ liệu trước D1, chưa cài".
5. **Sequence xuất bản (bản đầu)** vẽ `publishNotification` gửi RabbitMQ ngay. Đọc lại code sau C1 thấy gửi qua `afterCompletion`. Đã sửa (mục 2 ở trên).

**Tự chấm checklist cẩm nang:**
- **Sequence (9/9, cả 2 sơ đồ):** lifeline là đối tượng lớp thật; mỗi message là phương thức có trong class diagram (trừ hàm Spring/JPA kế thừa: `findById`, `save`, `registerSynchronization`, `convertAndSend`; ghi rõ trong `nhat-quan.md`); có message trả về; SSE, RabbitMQ, `afterCommit` dùng mũi tên hở; `alt`/`opt` có điều kiện; `loop` ghi lặp theo cái gì; bắt đầu từ actor; không vẽ log, getter.
  - Riêng `ensureNotArchived`, `recomputeNodeStatus`, `peelNodesBehindCycle` là phương thức `private` gọi chính nó; có trong class diagram với dấu `-`.
  - Các bước bên trong vòng lặp Kahn (`poll()`, giảm in-degree, `add(v)`) là thao tác trên `PriorityQueue`, vẽ thành tự gọi để thể hiện `loop` theo yêu cầu task.
- **Communication (5/5):** số theo cấp; message trên đúng đường liên kết; có chiều; khớp sequence (bảng 2 trong `nhat-quan.md` ghi số seq ↔ số comm); đối tượng `:Lớp`. Nhánh 422 chỉ vẽ phần ở Slice (1.2); phần lỗi trong service không vẽ trên comm vì nó là message trả về.
- **Class thiết kế (9/9):** tên lớp khớp code; có visibility và kiểu; association có bội số 2 đầu; composition (Dự án → Giai đoạn, Công việc: `ON DELETE CASCADE`) và aggregation (Giai đoạn → Công việc: `ON DELETE SET NULL`) có lý do; generalization repository → `JpaRepository` đúng chiều; dependency cho controller → service; **không vẽ trùng** cột khóa ngoại với association (có note); không có getter/setter; mọi message của sequence có trong lớp.
- **State machine (8/8):** có trạng thái đầu và kết thúc (sau COMPLETED); tên khớp enum; mọi chuyển có sự kiện (`publishPipeline`, `updateProjectStatus(...)`, "30 ngày không tương tác"); điều kiện loại trừ nhau; hành động ghi mở khóa và gửi sự kiện; không có chuyển trái đặc tả; mỗi chuyển ứng một nhánh code (bảng 4 trong `nhat-quan.md`).
- **Object (4/4):** tên dạng `tên : Lớp`; giá trị lấy từ seed V2 (đối chiếu DB local); liên kết khớp class diagram; ghi rõ thời điểm chụp.

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**
