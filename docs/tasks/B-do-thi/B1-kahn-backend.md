# B1 — Bộ kiểm tra DAG bằng thuật toán Kahn (backend, dùng chung)

Người làm: B
Người review: C
Trạng thái: chưa làm
Cần có trước: T0
Cần trước bước frontend: không
Mở khóa: B2, D3, D6
Nhánh git: b1-kahn
Ước lượng: 0,5–1 ngày — **nên xong trong 2 ngày đầu**, vì D3 và D6 cần nó

## Vì sao cần task này
Backend chưa có Kahn, mới chỉ có `BE/exception/CycleDetectedException.java` và handler trả 422. Kahn cần cho 4 việc: nối phụ thuộc (B3), xuất bản dự án (B4), lưu template (D3), tính đường găng CPM (D6). Viết một lần thành hàm thuần để dùng chung.

## Kiến thức phải nắm
Đồ thị có hướng, in-degree, sắp xếp topo (topological sort), độ phức tạp O(V+E), generic trong Java, hàm thuần (pure function), test bảng dữ liệu (`@ParameterizedTest`).

## Bước 0 — Tự đọc, không dùng AI
Đọc: `docs/specs/workflow-engine.md` mục 4; `FE/lib/graph/kahn.ts` và test `FE/lib/graph/__tests__/graphEngines.test.ts`; `BE/exception/CycleDetectedException.java`; handler `handleCycleDetected` trong `BE/exception/GlobalExceptionHandler.java`.
Trả lời:
1. 🧠 Chạy tay Kahn trên đồ thị A→B, B→C, C→A, A→D: ghi in-degree sau từng bước và kết quả. D có bị coi là "nằm trong chu trình" không, vì sao?
2. Thêm cạnh C→E. Sau Kahn, E còn in-degree > 0 dù E **không** nằm trong chu trình. Đặc tả 4.5 gom mọi node còn in-degree > 0 vào `cycleNodes`, như vậy báo cho người dùng có chính xác không?
3. Kahn và DFS 3 màu đều phát hiện được chu trình. Chọn Kahn có lợi gì cho dự án này? (gợi ý: thứ tự topo dùng lại cho CPM ở D6)

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `wpe-backend/src/**`, `FE/lib/graph/**`, `docs/specs/workflow-engine.md`

## Được ghi
- `BE/service/engine/dag/**` (mới: `DagValidator.java`, `DagValidationResult.java`, `Edge.java`)
- `BE-test/service/engine/dag/**` (mới)
- `docs/specs/workflow-engine.md` (mục 4: cách tính `cycleNodeIds`)
- `docs/tasks/B-do-thi/B1-kahn-backend.md`

## Đặc tả đã chốt
- `public final class DagValidator` với hàm tĩnh `static <T> DagValidationResult<T> validate(Collection<T> nodeIds, Collection<Edge<T>> edges)`.
- `record Edge<T>(T parent, T child)`; `record DagValidationResult<T>(boolean valid, List<T> sortedOrder, List<T> cycleNodeIds, List<T> blockedNodeIds)`.
  - `blockedNodeIds`: mọi node còn in-degree > 0 sau Kahn (đúng như đặc tả cũ).
  - `cycleNodeIds`: lấy từ `blockedNodeIds` rồi "bóc ngược": lặp lại việc bỏ các node không còn cạnh đi ra tới node khác trong tập còn lại. Phần còn sót là node nằm trên chu trình hoặc nằm giữa 2 chu trình. Trường hợp "nằm giữa 2 chu trình" là hạn chế đã biết, ghi vào docs.
- Thứ tự ổn định: khi nhiều node cùng in-degree 0, lấy theo thứ tự xuất hiện trong `nodeIds`, để kết quả và test không ngẫu nhiên.
- Cạnh trỏ tới node không có trong `nodeIds` → `IllegalArgumentException`. Cạnh trùng chỉ tính 1 lần. Cạnh tự nối (A→A) là chu trình.
- Thêm `static <T> boolean wouldCreateCycle(Collection<T> nodeIds, Collection<Edge<T>> edges, Edge<T> newEdge)` để B2, B3 dùng.
- Không phụ thuộc Spring, không đọc DB (không import `org.springframework` trong `dag/`).
- 422 trả cho người dùng vẫn giữ format cũ: trường `cycleNodes` lấy từ `cycleNodeIds`. Không thêm trường mới vào `ErrorResponse`.

## Việc cần làm
1. 🧠 Bước 0 (chạy tay trên giấy).
2. 🧠 Viết trước ít nhất 12 test case dạng bảng: đồ thị rỗng; 1 node; chuỗi thẳng; hình kim cương (A→B, A→C, B→D, C→D); 2 thành phần rời nhau; chu trình 3 node; tự nối; chu trình kèm đuôi (A→B→C→A, C→E); 2 chu trình rời nhau; cạnh trùng; cạnh tới node lạ; dữ liệu seed (WPE-001→002→003→004).
3. 🧠 **Tự code** phần Kahn chiều xuôi trong `validate`. Claude chỉ được review sau khi bạn viết xong và test đã chạy.
4. 🤝 Phần "bóc ngược" lấy `cycleNodeIds`, và `wouldCreateCycle`.
5. 🤝 Test hiệu năng đơn giản: 10.000 node, 20.000 cạnh. Ghi thời gian đo thật trên máy bạn.
6. Cập nhật `workflow-engine.md` mục 4: định nghĩa `blockedNodeIds`/`cycleNodeIds` và hạn chế đã biết.

## Tiêu chí xong
- [ ] `./mvnw test -Dtest=DagValidatorTest` pass, có ít nhất 12 case như bước 2.
- [ ] Phần Kahn chiều xuôi do B tự viết. Người review yêu cầu giải thích từng dòng.
- [ ] Thư mục `dag/` không import gì từ `org.springframework`.
- [ ] Ghi chép có số đo thật của test 10.000 node.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. Độ phức tạp thời gian và bộ nhớ của hàm là bao nhiêu? Chỉ vào code để giải thích.
2. Vì sao cần thứ tự ổn định?
3. Trường hợp "node nằm giữa 2 chu trình" bị báo nhầm: thuật toán Tarjan (SCC) xử lý thế nào?

## Cấm
- Sửa file ngoài mục "Được ghi". File dùng chung thì báo nhóm trước (README mục 6).
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
