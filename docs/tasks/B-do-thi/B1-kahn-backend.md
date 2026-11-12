# B1 — Kahn backend: kiểm thử và hoàn thiện `KahnDagService` (dùng chung)

Người làm: B
Người review: C
Trạng thái: xong
Cần có trước: T0
Cần trước bước frontend: không
Mở khóa: B2, B3, D3, D6
Nhánh git: b1-kahn
Ước lượng: 0,5–1 ngày — **nên xong trong 2 ngày đầu**, vì D3 và D6 cần nó

> **Cập nhật 11/11/2026 (sau khi pull):** code Kahn đã có ở `BE/service/engine/KahnDagService.java` cùng test `BE-test/service/engine/KahnDagServiceTest.java` (do Dev B viết, xem `docs/archive/dev_b/DEV_B_IMPLEMENTATION_GUIDE.md`). Task này **không viết lại**: đọc hiểu, tự kiểm chứng bằng tay, bổ sung test, và sửa 3 thiếu sót bên dưới.

> ⚡ **Chế độ sprint:** Claude làm hết các bước, kể cả 🧠; bỏ qua Bước 0 và mục "Dành cho Claude". Luồng làm: [SPRINT_2_NGAY.md](../SPRINT_2_NGAY.md) mục 2–3.
> - **Claude tự chạy bằng dòng lệnh:** chạy `KahnDagServiceTest` và toàn bộ test.
> - **Dời về buổi kiểm chung (mục 7):** không có.
> - **Không làm trong sprint:** chạy tay Kahn trên giấy; `sortedOrder` vẫn làm vì là đặc tả đã chốt.

## Vì sao cần task này
`KahnDagService` được dùng cho xuất bản (B4), kiểm template (D3), và sẽ dùng cho tính đường găng (D6). Đọc code thấy 3 thiếu sót:
1. `validateProjectDag` gom **mọi** node còn in-degree > 0 vào `cycleNodeCodes`. Như vậy node đứng **sau** chu trình (không nằm trên vòng) cũng bị báo là lỗi.
2. `ProjectKahnResult` không trả thứ tự topo (`sortedOrder`), trong khi D6 cần thứ tự này để tính CPM.
3. Chưa có hàm kiểm "thêm 1 cạnh có tạo vòng không". Vì vậy `WorkflowGraphService.createDependency` hiện chỉ chặn được vòng 2 node (A→B, B→A), còn vòng dài như A→B→C→A thì lọt (B3 sửa, cần hàm của B1).

## Kiến thức phải nắm
Đồ thị có hướng, in-degree, sắp xếp topo, độ phức tạp O(V+E), test dạng bảng (`@ParameterizedTest`).

## Bước 0 — Tự đọc, không dùng AI
Đọc: `docs/specs/workflow-engine.md` mục 4; `BE/service/engine/KahnDagService.java` và test của nó; `FE/lib/graph/kahn.ts`; handler `handleCycleDetected` trong `BE/exception/GlobalExceptionHandler.java`.
Trả lời:
1. 🧠 Chạy tay Kahn trên đồ thị A→B, B→C, C→A, A→D: ghi in-degree sau từng bước. D có bị báo "nằm trong chu trình" không?
2. Thêm cạnh C→E. Theo code hiện tại, E có bị đưa vào `cycleNodeCodes` không? Báo vậy cho người dùng có đúng không?
3. Chỉ ra dòng code trong `createDependency` (`BE/service/WorkflowGraphService.java`) chỉ kiểm vòng 2 node. Cho một ví dụ vòng 3 node lọt qua.

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `wpe-backend/src/**`, `FE/lib/graph/**`, `docs/**`

## Được ghi
- `BE/service/engine/KahnDagService.java`
- `BE-test/service/engine/KahnDagServiceTest.java`
- `docs/specs/workflow-engine.md` (mục 4), `docs/tasks/B-do-thi/B1-kahn-backend.md`

## Đặc tả đã chốt
- **Giữ nguyên** chữ ký `validateProjectDag(List<NodeEntity>, List<NodeDependencyEntity>)` và `validateTemplateGraph(Map)` vì B4, D3 đang dùng. Chỉ được **thêm** trường hoặc hàm mới.
- Thêm vào `ProjectKahnResult`: `List<Long> sortedOrder` (thứ tự topo, rỗng nếu có chu trình) và `List<String> blockedNodeCodes` (mọi node còn in-degree > 0).
- `cycleNodeCodes` đổi cách tính: lấy tập bị chặn rồi "bóc ngược", lặp lại việc bỏ các node không còn cạnh đi ra tới node khác trong tập. Phần còn lại là node nằm trên chu trình (hoặc nằm giữa 2 chu trình — hạn chế đã biết, ghi vào docs).
- Thứ tự ổn định: nhiều node cùng in-degree 0 thì lấy theo thứ tự id tăng dần (để test không ngẫu nhiên).
- Thêm `boolean wouldCreateCycle(List<NodeEntity> nodes, List<NodeDependencyEntity> deps, Long parentId, Long childId)` — trả `true` nếu thêm cạnh parent→child tạo vòng (kể cả parent = child).
- 422 trả cho người dùng giữ format cũ (`cycleNodes`), không đổi `ErrorResponse`.

## Việc cần làm
1. 🧠 Bước 0 (chạy tay trên giấy).
2. 🧠 Đọc test hiện có, lập bảng: case nào đã có, case nào thiếu. Tối thiểu phải đủ: rỗng; 1 node; chuỗi thẳng; kim cương; 2 thành phần rời; chu trình 3 node; chu trình kèm đuôi; 2 chu trình; cạnh trùng; dữ liệu seed WPE-001→004.
3. 🧠 **Tự viết** phần "bóc ngược" và `wouldCreateCycle`. Claude chỉ review sau khi bạn viết xong và test đã chạy.
4. 🤝 Thêm `sortedOrder`, `blockedNodeCodes`, bổ sung test còn thiếu.
5. Cập nhật `workflow-engine.md` mục 4.

## Tiêu chí xong
- [ ] `KahnDagServiceTest` pass, đủ các case ở bước 2 (chạy bằng IntelliJ hoặc `./mvnw test -Dtest=KahnDagServiceTest` sau khi A1 xong).
- [ ] Case "chu trình kèm đuôi": `cycleNodeCodes` không chứa node đuôi, `blockedNodeCodes` có.
- [ ] Có test cho `wouldCreateCycle` với vòng 3 node.
- [ ] Code "bóc ngược" và `wouldCreateCycle` do B tự viết; người review yêu cầu giải thích từng dòng.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. Độ phức tạp thời gian và bộ nhớ của `validateProjectDag`?
2. Vì sao cần thứ tự ổn định?
3. Trường hợp "node nằm giữa 2 chu trình" bị báo nhầm: Tarjan (SCC) xử lý thế nào?

## Cấm
- Sửa file ngoài mục "Được ghi". File dùng chung thì báo nhóm trước (README mục 6).
- Đổi chữ ký các hàm public đang có của `KahnDagService`.
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
Bỏ qua theo chế độ sprint.

### Đã làm gì (file nào, vì sao)
> Làm ở chế độ sprint ngày 11/11/2026: Claude viết code và test, phần dưới do Claude ghi.

**`BE/service/engine/KahnDagService.java`**
- `ProjectKahnResult` thêm 2 trường ở cuối: `sortedOrder` (thứ tự topo, rỗng nếu có chu trình) và `blockedNodeCodes` (mọi node còn in-degree > 0). Chữ ký `validateProjectDag` và `validateTemplateGraph` giữ nguyên.
- Thiếu sót 1: `cycleNodeCodes` giờ lấy tập node bị chặn rồi "bóc ngược" (hàm `peelNodesBehindCycle`), nên không còn chứa node chỉ đứng sau chu trình.
- Thiếu sót 2: trả `sortedOrder`. Dùng hàng đợi ưu tiên theo id để thứ tự ổn định.
- Thiếu sót 3: thêm `wouldCreateCycle(nodes, deps, parentId, childId)`, duyệt theo chiều rộng từ node con, gặp node cha thì trả `true`.
- Thêm phòng thủ cho dữ liệu hỏng (ngoài đặc tả, B đã đồng ý giữ): cạnh có node cha hoặc node con không nằm trong danh sách node thì bị bỏ qua. Trước đây cạnh như vậy làm node con bị báo chu trình giả.

**`BE-test/service/engine/KahnDagServiceTest.java`**: từ 6 lên 31 test. Đủ các case yêu cầu: rỗng; 1 node; chuỗi thẳng; kim cương; 2 thành phần rời; chu trình 3 node; chu trình kèm đuôi; 2 chu trình; cạnh trùng; dữ liệu seed WPE-001→004. Thêm: node giữa 2 chu trình (hạn chế đã biết), thứ tự ổn định, node không có code, 9 trường hợp `wouldCreateCycle` và 1 test đối chiếu `wouldCreateCycle` với `validateProjectDag` trên mọi cặp node.

**`docs/specs/workflow-engine.md`**: thêm mục 4.3 mô tả bản backend.

### Kết quả test (dán output thật, không chép tay)
**Trước khi sửa** (2 test tái hiện, chạy `mvn -B test -Dtest=KahnDagServiceTest`):
```text
[ERROR] Tests run: 8, Failures: 2, Errors: 0, Skipped: 0
[ERROR]   KahnDagServiceTest.testCycleWithTailExcludesTailNodes:160 expected: <[A, B, C]> but was: <[A, B, C, D, E]>
[ERROR]   KahnDagServiceTest.testEdgeWithUnknownParentIsIgnored:171 expected: <true> but was: <false>
[INFO] BUILD FAILURE
```
Thiếu sót 2 và 3 (`sortedOrder`, `wouldCreateCycle`) là hàm và trường chưa tồn tại, nên không có test fail trước khi sửa.

**Sau khi sửa:**
```text
[INFO] Tests run: 31, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.299 s -- in com.pipeline.wpe.service.engine.KahnDagServiceTest
```
**Toàn bộ test backend** (`mvn -B test`):
```text
[INFO] Tests run: 126, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```
Task này không có bước Swagger, SQL hay trình duyệt.

### Điều chưa chắc / cần nhóm quyết
1. **Bỏ qua cạnh có đầu mút lạ** không có trong "Đặc tả đã chốt". Đây là phòng thủ, **không gặp được khi dùng bình thường**: `createDependency` bắt hai node cùng dự án, xuất bản lấy toàn bộ node của dự án (mọi phase, nên cạnh ghost node sang phase khác không bị ảnh hưởng), và xóa node thì database tự xóa cạnh. Chỉ xảy ra khi dữ liệu bị sửa thẳng trong database hoặc code khác ghi sai, vì bảng `node_dependency` không ràng buộc hai node phải cùng dự án. Hệ quả khi gặp: node con của cạnh đó được coi là node gốc và được mở khóa khi xuất bản, dữ liệu hỏng không được báo ra. Nhóm xem có đồng ý không.
2. **`validateTemplateGraph` chưa áp dụng "bóc ngược"**: template có chu trình kèm đuôi vẫn báo cả node đuôi. Đặc tả B1 không yêu cầu sửa; D3 cần thì báo B.
3. **`WorkflowGraphService.publishPipeline` chưa dùng gì mới**: nó vẫn trả `cycleNodeCodes`, giờ đã là danh sách đúng. B4 kiểm lại.

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**

## Review của C (12/11/2026, chế độ sprint)
Đạt 2 tiêu chí review sprint (SPRINT_2_NGAY.md mục 5): (1) test xanh: ghi chép có output thật trước/sau khi sửa; C chạy lại `./mvnw test` trên main 77416de: 425 test pass, `KahnDagServiceTest` 31/31; (2) PR #15 sửa 4 file, đều nằm trong "Được ghi".
