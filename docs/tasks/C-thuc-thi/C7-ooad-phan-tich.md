# C7 — Sơ đồ phân tích OOAD: mảng Chạy task & Realtime

Người làm: C
Người review: D
Trạng thái: chưa làm
Cần có trước: T1
Cần trước bước frontend: không
Mở khóa: C8
Nhánh git: c7-ooad-phan-tich
Ước lượng: 1 ngày

## Vì sao cần task này
Sơ đồ phân tích trả lời câu hỏi "hệ thống làm gì, cho ai", chưa bàn tới code. Mảng của C có luồng nghiệp vụ đậm nhất (nộp bài, duyệt, từ chối, tự mở khóa), nên sơ đồ của C thường là phần giảng viên hỏi nhiều nhất.

## Sản phẩm (lưu ở `docs/ooad/C-thuc-thi/`)
1. `uc-thuc-thi.puml` — sơ đồ use case của mảng.
   - Actor: Cộng sự, Chủ dự án (tổng quát hóa từ Cộng sự), Bộ hẹn giờ (actor thời gian, cho việc quét trễ hạn).
   - Use case gợi ý: Xem My Tasks, Bắt đầu làm, Hủy nhận việc, Nộp bài, Đính kèm minh chứng, Duyệt bài, Từ chối bài, Mở khóa cưỡng bức, Quản lý tài nguyên dự án, Xem thông báo, Quét task trễ hạn.
   - Bắt buộc có ít nhất 1 `<<include>>`, 1 `<<extend>>` (ví dụ "Đính kèm minh chứng" mở rộng "Nộp bài"), 1 tổng quát hóa giữa actor, và 1 actor không phải người.
2. `dac-ta-uc.md` — đặc tả 3 use case: **Nộp bài**, **Duyệt bài**, **Từ chối bài**. Luồng ngoại lệ khớp với lỗi trong code (409 sai version, 403 không phải owner, 400 thiếu lý do, 409 `PROJECT_ARCHIVED`).
3. `activity-vong-doi-task.puml` — activity "Vòng đời một task" với 3 làn Cộng sự | Chủ dự án | Hệ thống. Có rẽ nhánh duyệt/từ chối kèm vòng lặp quay lại làm, và fork sau khi DONE (mở khóa task con ‖ gửi thông báo).
4. `bce-thuc-thi.puml` — sơ đồ lớp phân tích BCE:
   - boundary: bảng Kanban, hộp thoại nộp bài, chuông thông báo;
   - control: điều khiển trạng thái task (FSM), bộ mở khóa phụ thuộc, bộ phát sự kiện, bộ quét trễ hạn;
   - entity: Công việc, Minh chứng, Thông báo, Phụ thuộc công việc.

## Bước 0 — Tự đọc, không dùng AI
Đọc: `docs/ooad/CAM_NANG_VE_SO_DO.md` mục 3.1, 3.2, 3.3, 3.6; `docs/specs/system-overview.md` (Phân hệ 3, UC13–UC18); `docs/specs/workflow-engine.md`; integration map Cụm 5, 6.
Trả lời:
1. "Tự mở khóa task con" có phải use case không? Ai là actor? Vẽ nó ở sơ đồ nào thì hợp hơn?
2. Vì sao Bộ hẹn giờ được coi là actor?
3. Activity "Vòng đời task" khác sơ đồ state của task (C8) ở điểm nào?

## Được đọc
- `docs/**`, `wpe-backend/src/**`, `wpe-frontend/src/**`

## Được ghi
- `docs/ooad/C-thuc-thi/**`, `docs/ooad/png/C-*.png`
- `docs/tasks/C-thuc-thi/C7-ooad-phan-tich.md`

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 **Vẽ tay** (giấy hoặc draw.io) đủ 4 sản phẩm, không dùng AI. Chụp ảnh dán vào ghi chép.
3. 🧠 Tự chấm theo checklist của từng loại sơ đồ trong cẩm nang, ghi điểm.
4. 🤝 Đưa ảnh hoặc mô tả bản vẽ cho Claude soát. Claude chỉ ra lỗi, **bạn tự sửa**.
5. 🤝 Chép sang PlantUML (hoặc công cụ GV yêu cầu), render, xuất PNG vào `docs/ooad/png/` với tên `C-<tên file>.png`.
6. Mở PR. Người review (D) dò theo checklist và hỏi "Câu hỏi bảo vệ".

## Tiêu chí xong
- [ ] Đủ 4 sản phẩm, render được, có PNG.
- [ ] Checklist cẩm nang của từng sơ đồ đạt hết, hoặc mục nào không đạt thì có giải thích.
- [ ] Use case khớp ma trận RBAC (UC13–UC18), hoặc giải thích vì sao thêm hay gộp.
- [ ] Ghi chép có ảnh bản vẽ tay đầu tiên.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn tài liệu)
1. Chỉ vào sơ đồ: include nào, extend nào, điều kiện extend là gì?
2. Theo sơ đồ activity, task bị từ chối 2 lần thì luồng đi thế nào?
3. Trong sơ đồ BCE, "Duyệt bài" đi qua những lớp nào, theo thứ tự nào?

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
