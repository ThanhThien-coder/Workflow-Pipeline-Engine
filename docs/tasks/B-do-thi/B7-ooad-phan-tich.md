# B7 — Sơ đồ phân tích OOAD: mảng Thiết kế quy trình DAG

Người làm: B
Người review: C
Trạng thái: chưa làm
Cần có trước: T1
Cần trước bước frontend: không
Mở khóa: B8
Nhánh git: b7-ooad-phan-tich
Ước lượng: 1 ngày

## Vì sao cần task này
Sơ đồ phân tích trả lời câu hỏi "hệ thống làm gì, cho ai", chưa bàn tới code. Làm sớm thì hiểu nghiệp vụ trước khi code B2–B6, và đây là phần điểm lớn của môn OOAD.

## Sản phẩm (lưu ở `docs/ooad/B-do-thi/`)
1. `uc-do-thi.puml` — sơ đồ use case của mảng.
   - Actor: Chủ dự án, Cộng sự, Người xem (Cộng sự và Người xem chỉ xem đồ thị).
   - Use case gợi ý: Tạo giai đoạn, Sửa giai đoạn, Xóa giai đoạn, Nối giai đoạn, Thêm công việc, Sửa công việc, Nối phụ thuộc, Lưu bố cục canvas, Xuất bản dự án, Kiểm tra chu trình, Xem đồ thị, Xem danh sách node gây vòng lặp.
   - Gợi ý quan hệ: "Nối phụ thuộc" và "Xuất bản dự án" cùng `<<include>>` "Kiểm tra chu trình"; "Xem danh sách node gây vòng lặp" `<<extend>>` "Xuất bản dự án" với điều kiện `[phát hiện chu trình]`.
   - Bắt buộc có ít nhất 1 `<<include>>`, 1 `<<extend>>` (ghi điều kiện), 1 tổng quát hóa giữa actor. Giải thích lựa chọn trong ghi chép.
2. `dac-ta-uc.md` — đặc tả 3 use case: **Nối phụ thuộc giữa 2 công việc**, **Xuất bản dự án**, **Xóa giai đoạn**. Luồng ngoại lệ khớp mã lỗi đã chốt ở B2–B4 (`CYCLE_DETECTED`, `NODE_IN_USE`, `INVALID_PROJECT_STATUS`, `PROJECT_ARCHIVED`). Lưu ý: nối lại một cạnh **đã có** không phải ngoại lệ. Hệ thống trả lại cạnh cũ và không báo lỗi (lũy đẳng, xem B3), nên ghi nó ở luồng thay thế.
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
- [ ] Đủ 4 sản phẩm, render được, có PNG.
- [ ] Checklist cẩm nang của từng sơ đồ đạt hết, hoặc mục nào không đạt thì có giải thích.
- [ ] Use case khớp ma trận RBAC (UC10, UC11, UC19), hoặc giải thích vì sao thêm hay gộp.
- [ ] Ghi chép có ảnh bản vẽ tay đầu tiên.

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
### Trả lời Bước 0

### Ảnh bản vẽ tay đầu tiên

### Tự chấm theo checklist (điểm từng sơ đồ)

### Lỗi Claude hoặc người review chỉ ra và cách mình sửa

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**
