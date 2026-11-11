# B1 — Kahn backend: kiểm thử và hoàn thiện `KahnDagService` (dùng chung)

Người làm: B
Người review: C
Trạng thái: chưa làm
Cần có trước: T0
Cần trước bước frontend: không
Mở khóa: B2, B3, D6
Nhánh git: b1-kahn
Ước lượng: 0,5–1 ngày — **nên xong trong 2 ngày đầu**, vì B3 và D6 cần nó (D3 không phải chờ: chỉ dùng `validateTemplateGraph`, hàm này giữ nguyên)

> **Cập nhật 11/11/2026 (sau khi pull):** code Kahn đã có ở `BE/service/engine/KahnDagService.java` cùng test `BE-test/service/engine/KahnDagServiceTest.java` (do Dev B viết, xem `docs/archive/dev_b/DEV_B_IMPLEMENTATION_GUIDE.md`). Task này **không viết lại**: đọc hiểu, tự kiểm chứng bằng tay, bổ sung test, và sửa 3 thiếu sót bên dưới.

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

### Đã làm gì (file nào, vì sao)

### Kết quả test (dán output thật, không chép tay)

### Điều chưa chắc / cần nhóm quyết

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**
