# X4 — Bảo vệ: thuyết trình chéo và luyện vẽ không nhìn

Người làm: cả nhóm (A, B, C, D) — B trình bày mảng A, C trình bày mảng B, D trình bày mảng C, A trình bày mảng D
Người review: cả nhóm
Trạng thái: chưa làm
Cần có trước: X2, X3
Cần trước bước frontend: không
Mở khóa: không
Nhánh git: x4-bao-ve
Ước lượng: 0,5–1 ngày

## Vì sao cần task này
Hiểu mảng mình chưa đủ. Khi bảo vệ, giảng viên có thể hỏi bất kỳ ai về bất kỳ phần nào, và môn OOAD có thể bắt vẽ ngay tại chỗ. Người trình bày mỗi mảng là người đã review mảng đó suốt kỳ, nên đã đọc kỹ code và sơ đồ của nó.

## Việc cần làm
### 1. Thuyết trình chéo (mỗi người 10 phút trình bày, 5 phút hỏi)
Nội dung bắt buộc:
- mục tiêu của mảng;
- luồng chính, trình bày bằng sequence diagram;
- dữ liệu, trình bày bằng class diagram hoặc ERD;
- vòng đời, trình bày bằng sơ đồ state;
- 1 lỗi đã sửa: nguyên nhân và cách sửa;
- demo ngắn.
Chủ mảng chỉ được bổ sung sau khi người trình bày nói xong.

### 2. Luyện vẽ không nhìn (như đi thi)
Mỗi người vẽ mảng mình **chưa làm, chưa review và chưa kiểm thử** (mảng còn lại, xem README mục 2): A vẽ mảng B, B vẽ mảng C, C vẽ mảng D, D vẽ mảng A. Vẽ trên giấy, không xem tài liệu, theo thời gian:

| Sơ đồ | Thời gian |
| :--- | :--- |
| Use case của mảng | 15 phút |
| Sequence một luồng chính | 20 phút |
| Class diagram thiết kế | 20 phút |
| State | 10 phút |
| Activity | 15 phút |

Chấm chéo theo checklist trong cẩm nang, thang 10. Loại sơ đồ nào dưới 7 điểm thì vẽ lại loại đó với một mảng khác cho tới khi đạt.

### 3. Vấn đáp
Mỗi người trả lời ngẫu nhiên 10 câu trong ngân hàng câu hỏi (cẩm nang mục 6), cộng 5 "Câu hỏi bảo vệ" lấy từ task của các mảng khác.

## Tiêu chí xong
- [ ] Biên bản `docs/tasks/ghi-chep/X4-bien-ban.md`: ai trình bày, ai hỏi gì, điểm luyện vẽ của từng người cho từng loại sơ đồ.
- [ ] Mọi người đạt từ 7/10 trở lên ở mọi loại sơ đồ (tính cả lần vẽ lại).
- [ ] Mỗi người trả lời đúng ít nhất 8/10 câu vấn đáp.

## Cấm
- Xem tài liệu hoặc dùng AI trong lúc luyện vẽ và vấn đáp.
- Tự ghi trạng thái `xong` khi còn người chưa đạt.

## Dành cho Claude (đọc trước khi làm)
Người dán file này đang chuẩn bị bảo vệ.
1. Được đóng vai giảng viên: hỏi vấn đáp, hỏi vặn câu trả lời, chấm sơ đồ họ đưa lên theo checklist của cẩm nang.
2. Không đưa đáp án trước khi họ trả lời. Sau khi họ trả lời thì chỉ ra chỗ đúng và chỗ thiếu.

## Ghi chép của người làm
### Kết quả thuyết trình

### Điểm luyện vẽ (người × loại sơ đồ)

### Câu vấn đáp còn yếu và kế hoạch ôn

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**
