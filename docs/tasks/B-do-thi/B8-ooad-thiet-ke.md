# B8 — Sơ đồ thiết kế OOAD: mảng Thiết kế quy trình DAG (khớp code thật)

Người làm: B
Người review: C
Trạng thái: chưa làm
Cần có trước: B7, B4
Cần trước bước frontend: không
Mở khóa: X3
Nhánh git: b8-ooad-thiet-ke
Ước lượng: 1–1,5 ngày

## Vì sao cần task này
Sơ đồ thiết kế trả lời câu hỏi "hệ thống làm việc đó **bằng những lớp nào, gọi nhau ra sao**". Vẽ sau khi B2–B4 đã có code thì sơ đồ khớp code, bạn hiểu luồng thật và trả lời được khi bị hỏi.

> Hạn OOAD tới trước khi code xong: vẽ theo đặc tả trong B2–B4, đánh dấu "dự kiến" ở phần chưa code. Code xong thì cập nhật lại.

## Sản phẩm (lưu ở `docs/ooad/B-do-thi/`)
1. `seq-noi-phu-thuoc.puml` — sequence "Nối phụ thuộc", từ component Mindmap → store → `graph.ts` → controller → service → `DagValidator` → repository. Có `alt [tạo vòng] → 422` và `[trùng cạnh] → 409`.
2. `seq-xuat-ban.puml` — sequence "Xuất bản dự án". Có `loop` Kahn, `alt [có chu trình] → 422 / [hợp lệ] → ACTIVE`, `loop` mở khóa node gốc, và message bất đồng bộ tới `SseEmitterService` sau khi commit.
3. `comm-xuat-ban.puml` — sơ đồ communication chuyển từ sơ đồ 2.
4. `class-do-thi.puml` — class diagram thiết kế: controller, service của mảng đồ thị, `DagValidator` cùng `Edge` và `DagValidationResult` (record), các entity `WorkPhaseEntity`, `PhaseDependencyEntity`, `NodeEntity`, `NodeDependencyEntity`, các repository, DTO, enum `JoinPolicy`. Có visibility, kiểu, bội số, và ký hiệu đúng cho generic `<T>`.
5. `state-du-an.puml` — vòng đời dự án: DRAFT/PLANNING → ACTIVE `[Kahn hợp lệ] / mở khóa node gốc`; ACTIVE ⇄ PAUSED; ACTIVE → COMPLETED; → ARCHIVED; ARCHIVED → ACTIVE (khôi phục); INACTIVE (theo đặc tả). Chuyển trạng thái nào **chưa có code** thì ghi note "chưa cài".
6. `object-seed.puml` — sơ đồ đối tượng cho dữ liệu seed (WPE-001…004 và 3 phase), vẽ 2 ảnh chụp: in-degree trước khi chạy Kahn và sau bước đầu tiên.
7. `nhat-quan.md` — ma trận nhất quán: message → phương thức → `file:dòng`.

## Bước 0 — Tự đọc, không dùng AI
Đọc: cẩm nang mục 3.4, 3.5, 3.6, 3.7, 3.11 và mục 4; code B1–B4 đã merge; ghi chép B1–B4 của chính bạn.
Trả lời:
1. Trong sequence, vì sao lời gọi tới `DagValidator.validate` là lời gọi tĩnh? Vẽ lifeline cho lớp tiện ích tĩnh thế nào?
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
- [ ] Đủ 7 sản phẩm, render được, có PNG.
- [ ] Người review dò 5 message ngẫu nhiên đều tìm thấy phương thức thật.
- [ ] Sơ đồ trạng thái dự án khớp enum `ProjectStatus` trong code (đủ giá trị, hoặc giải thích giá trị nào không dùng).
- [ ] Checklist cẩm nang của từng sơ đồ đạt hết, hoặc mục nào không đạt thì có giải thích.

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
### Trả lời Bước 0

### Ảnh bản vẽ tay đầu tiên

### Ma trận nhất quán: các chỗ lệch đã tìm thấy và cách xử lý

### Lỗi Claude hoặc người review chỉ ra và cách mình sửa
