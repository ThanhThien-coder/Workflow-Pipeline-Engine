# X2 — Kiểm thử chéo end-to-end

Người làm: cả nhóm (A, B, C, D) — A chạy kịch bản của C, B chạy của D, C chạy của A, D chạy của B
Người review: chủ mảng của từng kịch bản
Trạng thái: chưa làm
Cần có trước: X1
Cần trước bước frontend: không
Mở khóa: X4
Nhánh git: x2-cross-test
Ước lượng: 1 ngày

## Vì sao cần task này
Người viết code thường chỉ test đúng những gì mình nghĩ tới. Đổi người chạy thì lỗi lộ ra, và người chạy buộc phải hiểu mảng của người khác. Xong X2, mỗi người nắm thêm một mảng ở mức "dùng được và biết nó hỏng chỗ nào".

## Việc cần làm
1. Mỗi người viết kịch bản cho mảng của mình ở `docs/tasks/kich-ban/<A|B|C|D>.md`, ít nhất 12 bước. Mỗi bước ghi rõ:
   - đóng vai tài khoản nào;
   - thao tác gì (trên UI hay qua Swagger);
   - kết quả mong đợi.
   Phải có cả các trường hợp lỗi: sai quyền, dữ liệu sai, xung đột (409), chu trình (422), cooldown (429).
2. Người chạy làm đúng theo kịch bản trên **DB sạch** (`docker compose down -v && docker compose up -d` — **xóa dữ liệu local**). Ghi kết quả từng bước: đạt hay không đạt, kèm ảnh hoặc response.
3. Bước không đạt: tạo issue trên GitHub giao cho chủ mảng, ghi số issue vào kịch bản.
4. Chủ mảng sửa trên nhánh `fix-…`. Người chạy chạy lại đúng các bước đã lỗi.
5. Người chạy tự trả lời "Câu hỏi bảo vệ" về mảng mình vừa test.

## Tiêu chí xong
- [ ] Có 4 kịch bản, mỗi kịch bản ít nhất 12 bước và ghi tên người chạy.
- [ ] Mọi lỗi mức chặn (chạy không được luồng chính) đã sửa, hoặc ghi rõ vì sao chưa sửa.
- [ ] Mỗi lỗi có issue và đường dẫn tới PR sửa.

## Câu hỏi bảo vệ (người chạy trả lời về mảng mình đã test)
1. Giải thích 3 bước lỗi tiêu biểu của mảng đó: nguyên nhân và cách đã sửa.
2. Luồng chính của mảng đó đi qua những lớp nào?
3. Nếu được thêm 1 test tự động cho mảng đó, bạn sẽ thêm test gì?

## Cấm
- Sửa code mảng khác trong lúc chạy kịch bản. Lỗi phải đi qua issue để chủ mảng sửa.
- Đọc, in, commit `.env*`, khóa, mật khẩu thật, API key.
- Tự ghi trạng thái `xong`.

## Dành cho Claude (đọc trước khi làm)
Người dán file này đang viết hoặc chạy kịch bản kiểm thử chéo.
1. Được giúp viết kịch bản cho rõ ràng, nhưng các bước phải do người làm tự nghĩ ra từ hiểu biết về mảng.
2. Khi họ chạy kịch bản: giúp đọc lỗi, đoán nguyên nhân, viết issue rõ ràng. Không sửa code mảng khác.

## Ghi chép của người làm
### Ai chạy kịch bản nào, ngày chạy

### Tổng hợp lỗi tìm được (số issue, mức độ, đã sửa chưa)

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**
