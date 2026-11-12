# B7 — Sơ đồ phân tích OOAD: mảng Thiết kế quy trình DAG

Người làm: B
Người review: C
Trạng thái: chờ kiểm
Cần có trước: T1
Cần trước bước frontend: không
Mở khóa: B8
Nhánh git: b7-ooad-phan-tich
Ước lượng: 1 ngày

> ⚡ **Chế độ sprint:** Claude làm hết các bước, kể cả 🧠; bỏ qua Bước 0 và mục "Dành cho Claude". Luồng làm: [SPRINT_2_NGAY.md](../SPRINT_2_NGAY.md) mục 2–3.
> - **Claude tự chạy bằng dòng lệnh:** render các file `.puml` ra PNG.
> - **Dời về buổi kiểm chung (mục 7):** không có.
> - **Không làm trong sprint:** vẽ tay bản đầu trên giấy. Claude vẽ từ code thật; vòng hiểu là người làm giải thích lại 1 sơ đồ sequence (task số 7 thì 1 sơ đồ activity).

## Vì sao cần task này
Sơ đồ phân tích trả lời câu hỏi "hệ thống làm gì, cho ai", chưa bàn tới code. Làm sớm thì hiểu nghiệp vụ trước khi code B2–B6, và đây là phần điểm lớn của môn OOAD.

## Sản phẩm (lưu ở `docs/ooad/B-do-thi/`)
1. `uc-do-thi.puml` — sơ đồ use case của mảng.
   - Actor: Chủ dự án, Cộng sự, Người xem (Cộng sự và Người xem chỉ xem đồ thị).
   - Use case gợi ý: Tạo giai đoạn, Sửa giai đoạn, Xóa giai đoạn, Nối giai đoạn, Thêm công việc, Sửa công việc, Nối phụ thuộc, Lưu bố cục canvas, Xuất bản dự án, Kiểm tra chu trình, Xem đồ thị, Xem danh sách node gây vòng lặp.
   - Gợi ý quan hệ: "Nối phụ thuộc" và "Xuất bản dự án" cùng `<<include>>` "Kiểm tra chu trình"; "Xem danh sách node gây vòng lặp" `<<extend>>` "Xuất bản dự án" với điều kiện `[phát hiện chu trình]`.
   - Bắt buộc có ít nhất 1 `<<include>>`, 1 `<<extend>>` (ghi điều kiện), 1 tổng quát hóa giữa actor. Giải thích lựa chọn trong ghi chép.
2. `dac-ta-uc.md` — đặc tả 3 use case: **Nối phụ thuộc giữa 2 công việc**, **Xuất bản dự án**, **Xóa giai đoạn**. Luồng ngoại lệ khớp mã lỗi đã chốt ở B2–B4 (`CYCLE_DETECTED`, `EDGE_EXISTS`, `NODE_IN_USE`, `INVALID_PROJECT_STATUS`, `PROJECT_ARCHIVED`).
3. `activity-xuat-ban.puml` — activity "Xuất bản dự án" với 2 làn Chủ dự án | Hệ thống. Thể hiện vòng lặp của Kahn (lấy node in-degree 0 khỏi hàng đợi…) và rẽ nhánh `[đã duyệt đủ N node]` / `[còn node]`.
4. `bce-do-thi.puml` — sơ đồ lớp phân tích BCE:
   - boundary: màn hình đồ thị Macro, màn hình Mindmap, hộp thoại chu trình;
   - control: điều khiển thiết kế đồ thị, bộ kiểm tra DAG;
   - entity: Dự án, Giai đoạn, Công việc, Phụ thuộc công việc, Phụ thuộc giai đoạn.
   Có thuộc tính chính và bội số.

## Bước 0 — Tự đọc, không dùng AI
Đọc: `docs/ooad/CAM_NANG_VE_SO_DO.md` mục 3.1, 3.2, 3.3, 3.6; `docs/specs/system-overview.md` (Phân hệ 2, UC10, UC11); integration map Cụm 4; `docs/specs/workflow-engine.md` mục 4.
Trả lời:
1. "Kiểm tra chu trình" có phải mục tiêu của actor không? Nếu không, vì sao vẫn vẽ nó thành use case được include?
2. Activity "Xuất bản" và sequence "Xuất bản" (B8) khác nhau ở điểm nhìn nào?
3. "Phụ thuộc công việc" là một entity hay chỉ là một quan hệ giữa hai Công việc? Lập luận (gợi ý: lớp kết hợp – association class).

## Được đọc
- `docs/**`, `wpe-backend/src/**`, `wpe-frontend/src/**`

## Được ghi
- `docs/ooad/B-do-thi/**`, `docs/ooad/png/B-*.png`
- `docs/tasks/B-do-thi/B7-ooad-phan-tich.md`

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 **Vẽ tay** (giấy hoặc draw.io) đủ 4 sản phẩm, không dùng AI. Chụp ảnh dán vào ghi chép.
3. 🧠 Tự chấm theo checklist của từng loại sơ đồ trong cẩm nang, ghi điểm.
4. 🤝 Đưa ảnh hoặc mô tả bản vẽ cho Claude soát. Claude chỉ ra lỗi, **bạn tự sửa**.
5. 🤝 Chép sang PlantUML (hoặc công cụ GV yêu cầu), render, xuất PNG vào `docs/ooad/png/` với tên `B-<tên file>.png`.
6. Mở PR. Người review (C) dò theo checklist và hỏi "Câu hỏi bảo vệ".

## Tiêu chí xong
- [x] Đủ 4 sản phẩm, render được, có PNG (`docs/ooad/png/B-uc-do-thi.png`, `B-activity-xuat-ban.png`, `B-bce-do-thi.png`).
- [x] Checklist cẩm nang của từng sơ đồ đạt hết, hoặc mục nào không đạt thì có giải thích.
- [x] Use case khớp ma trận RBAC (UC10, UC11, UC19), hoặc giải thích vì sao thêm hay gộp.
- [ ] Ghi chép có ảnh bản vẽ tay đầu tiên. (Chế độ sprint bỏ bước vẽ tay; dời sang giai đoạn Học lại.)

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn tài liệu)
1. Chỉ vào sơ đồ: include nào, extend nào, điều kiện extend là gì?
2. Giải thích Kahn bằng chính sơ đồ activity của bạn.
3. Trong sơ đồ BCE, "Nối phụ thuộc" đi qua những lớp nào?

## Cấm
- Dùng AI vẽ bản đầu tiên.
- Sửa file ngoài mục "Được ghi".
- Tự ghi trạng thái `xong`. Chỉ người review ghi sau khi kiểm.

## Dành cho Claude (đọc trước khi làm)
Người dán file này đang **học vẽ sơ đồ OOAD** cho mảng của họ.
1. Không vẽ hộ bản đầu tiên. Nếu được nhờ vẽ từ đầu, hãy hỏi lại họ đã vẽ tay chưa và đề nghị xem bản vẽ.
2. Khi họ đưa bản vẽ: chấm theo checklist trong `docs/ooad/CAM_NANG_VE_SO_DO.md`, chỉ ra lỗi ký hiệu, lỗi chiều mũi tên, chỗ không khớp với đặc tả hoặc code thật. Đặt câu hỏi để họ tự sửa.
3. Chỉ chuyển sang PlantUML sau khi họ đã chốt bản vẽ, và phải giữ đúng nội dung họ vẽ.
4. Cuối buổi, hỏi họ 3 câu trong "Câu hỏi bảo vệ".

## Ghi chép của người làm
> Làm ngày 12/11/2026 ở chế độ sprint (Claude vẽ từ code thật), nhánh `b7-ooad-phan-tich` tách từ main `00671af`, sau đó cập nhật lên main `7ed530d` (đã có B4, vai trò MANAGER của PR #33). Phần này do Claude ghi.

**Sản phẩm (`docs/ooad/B-do-thi/`):** `uc-do-thi.puml`, `dac-ta-uc.md`, `activity-xuat-ban.puml`, `bce-do-thi.puml`.

**Đã render PNG** (12/11/2026) bằng `plantuml.jar` đi kèm extension PlantUML (jebbs) mà người B cài trong Antigravity IDE (bản PlantUML 1.2021.00). Lệnh: `java -jar <plantuml.jar> -tpng -charset UTF-8 -o docs/ooad/png docs/ooad/B-do-thi/<tên>.puml`, rồi đổi tên thành `B-<tên>.png`. Khi render phải sửa 2 chỗ: (1) `bce-do-thi.puml` thêm `allowmixing`, vì khai báo actor trước class làm bản PlantUML này báo lỗi ở dòng 17; (2) `activity-xuat-ban.puml` cho nhánh `[còn node]` tự kết thúc trong `if`, nhánh thành công đi tiếp sau `endif`, vì bản cũ vẽ hai nhánh chung một đường khi đổi làn, nhìn như thành công cũng dẫn tới "Xem danh sách node gây vòng lặp". Đã xem cả 3 ảnh: chữ tiếng Việt, mũi tên include/extend và tổng quát hóa hiển thị đúng.

### Trả lời Bước 0
(Claude trả lời theo chế độ sprint; người B đọc lại ở giai đoạn Học lại.)
1. **"Kiểm tra chu trình" không phải mục tiêu của actor.** Chủ dự án muốn "nối phụ thuộc" hay "xuất bản", không ai mở app chỉ để kiểm chu trình. Vẫn vẽ thành use case vì đây là một khối hành vi **dùng chung** cho 3 use case (nối phụ thuộc, nối giai đoạn, xuất bản) và **luôn** xảy ra trong cả 3, đúng nghĩa `<<include>>`. Nó cũng khớp UC11 trong ma trận RBAC.
2. **Activity nhìn theo quy trình:** làm gì trước, rẽ nhánh nào, ai làm (theo làn), không quan tâm lớp nào. **Sequence (B8) nhìn theo đối tượng:** lớp nào gọi phương thức nào của lớp nào, theo thứ tự thời gian, ra sao trong code thật.
3. **"Phụ thuộc công việc" là entity.** Về ý nghĩa, nó là một quan hệ cha → con giữa 2 Công việc. Nhưng trong hệ thống nó có danh tính và vòng đời riêng: bảng `node_dependency` có `id`, `project_id`, ràng buộc không trùng (cha, con), được tạo và xóa độc lập qua API (`POST`/`DELETE /dependencies`). Nếu quan hệ có thuộc tính hoặc vòng đời riêng thì vẽ được thành lớp kết hợp (association class). Vì đây là quan hệ **của Công việc với chính nó**, PlantUML khó vẽ association class cho trường hợp này, nên `bce-do-thi.puml` vẽ thành entity riêng với 2 liên kết "là cha" và "là con", cùng ý nghĩa.

### Ảnh bản vẽ tay đầu tiên
Không có: chế độ sprint bỏ bước vẽ tay (task ghi "Không làm trong sprint: vẽ tay bản đầu trên giấy"). Tiêu chí "Ghi chép có ảnh bản vẽ tay đầu tiên" vì vậy **chưa đạt**, dời sang giai đoạn Học lại.

### Tự chấm theo checklist (điểm từng sơ đồ)
**Use case (`uc-do-thi.puml`) — 10/10**
- [x] Có ranh giới hệ thống ghi tên "Workflow Pipeline Engine — Thiết kế quy trình DAG".
- [x] 4 actor là vai trò (Người xem, Cộng sự, Quản lý dự án, Chủ dự án), nằm ngoài ranh giới.
- [x] 12 use case dạng "động từ + danh từ".
- [x] include đi từ use case gốc (Nối phụ thuộc, Nối giai đoạn, Xuất bản dự án) tới "Kiểm tra chu trình".
- [x] extend đi từ "Xem danh sách node gây vòng lặp" tới use case gốc, có điều kiện `[phát hiện chu trình]` và `[cạnh mới tạo vòng]`.
- [x] Tổng quát hóa con → cha: Cộng sự → Người xem, Quản lý dự án → Cộng sự, Chủ dự án → Quản lý dự án.
- [x] Không có association actor–actor hay use case–use case.
- [x] Không vẽ "Đăng nhập" (là tiền điều kiện trong đặc tả).
- [x] Khớp RBAC (đã có cột Project Manager từ PR #33): UC19 (xem đồ thị) cho Người xem, Cộng sự, Quản lý dự án, Chủ dự án; UC10 (thiết kế, lưu tọa độ) và UC11 (kiểm tra chu trình) chỉ Chủ dự án. UC10 được tách thành 9 use case nhỏ hơn (tạo, sửa, xóa, nối giai đoạn; thêm, sửa, nối công việc; lưu bố cục; xuất bản) cho đúng mục tiêu từng thao tác.
- [x] 12 use case, dưới 15.

**Đặc tả use case (`dac-ta-uc.md`) — 7/7**
- [x] Đủ mã, actor, tiền điều kiện, hậu điều kiện, luồng chính, thay thế, ngoại lệ.
- [x] Luồng chính xen kẽ actor và hệ thống, đánh số.
- [x] Luồng thay thế và ngoại lệ ghi rõ bước bắt đầu (4a, E1 (bước 2)…).
- [x] Mã lỗi khớp code (`WorkflowGraphService.java`) trên main `7ed530d`, kể cả phần Xuất bản (B4 đã merge).
- [x] Tiền điều kiện không lặp thành bước.
- [x] Không tả màu sắc, vị trí nút.
- [x] Tên use case trùng sơ đồ: "Nối phụ thuộc", "Xuất bản dự án", "Xóa giai đoạn".

**Activity (`activity-xuat-ban.puml`) — 8/8**
- [x] 1 nút bắt đầu, nhiều nút kết thúc (mỗi nhánh lỗi kết thúc rõ).
- [x] Hành động dạng "động từ + danh từ".
- [x] Mọi nhánh có điều kiện và phủ hết: (có/không), (đúng/sai), vòng lặp (còn/rỗng), `[đã duyệt đủ N node]` / `[còn node]`.
- [x] Nhánh rẽ gộp lại hoặc kết thúc rõ.
- [x] Không dùng fork nên không cần join. Gửi SSE và thông báo trong code chạy tuần tự, nên vẽ fork là sai.
- [x] Làn đúng: chọn xuất bản và xem kết quả ở làn Chủ dự án; kiểm tra, Kahn, lưu ở làn Hệ thống.
- [x] Khớp luồng chính và ngoại lệ E1–E4 trong đặc tả.
- [x] Không lẫn trạng thái thành hành động ("Chuyển dự án sang ACTIVE" là hành động).

**BCE (`bce-do-thi.puml`)** — cẩm nang mục 3.6a không có checklist đánh số. Đã soát theo quy tắc gọi: actor → boundary; boundary → control; control → entity; entity không gọi ai. Có thuộc tính chính và bội số theo khóa ngoại. Boundary gọi boundary (màn hình mở hộp thoại chu trình) là quan hệ trong lớp giao diện, không vi phạm quy tắc.

### Lỗi Claude hoặc người review chỉ ra và cách mình sửa
**Lệch giữa file task và code thật (đặc tả theo code, ghi ở đây để nhóm biết):**
1. **Không có mã `EDGE_EXISTS`.** File task liệt kê mã này, nhưng `createDependency` là lũy đẳng: nối cạnh đã có thì trả về cạnh đó, không báo lỗi. Đặc tả ghi thành luồng thay thế 4a. B8 cũng đang ghi `[trùng cạnh] → 409`, cần sửa theo.
2. **Xóa giai đoạn không có `NODE_IN_USE`.** `deletePhase` chuyển công việc thành độc lập, không chặn. `NODE_IN_USE` thực tế xuất hiện ở "Nối phụ thuộc" (công việc con đã bắt đầu) và "Xóa công việc".
3. **Hộp xác nhận xóa giai đoạn nói sai:** giao diện ghi "Phase … and all tasks inside it will be permanently deleted", nhưng backend giữ lại công việc. Lỗi chữ ở `MacroWorkflow.tsx` (mảng B5/B6), chưa sửa.
4. **Xuất bản đã khớp code:** lúc vẽ B4 chưa merge; nay B4 (#31) đã vào main, đặc tả và activity khớp `publishPipeline` thật.
5. **Khách (token chia sẻ) cũng xem được đồ thị (UC19)** nhưng đi qua cổng khách của mảng D, nên không vẽ vào sơ đồ mảng B.
6. **Thêm 1 extend và 1 include ngoài gợi ý:** "Xem danh sách node gây vòng lặp" extend cả "Nối phụ thuộc" (backend trả `cycleNodes` khi nối tạo vòng, và B5 mở modal chu trình); "Nối giai đoạn" include "Kiểm tra chu trình" (`addPhaseEdge` cũng chặn vòng lặp).
7. **Thêm actor Quản lý dự án (MANAGER, PR #33)** vào chuỗi tổng quát hóa. Trong mảng đồ thị MANAGER chỉ xem (UC19), không sửa đồ thị hay xuất bản (UC10, UC11 chỉ Owner).

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**
