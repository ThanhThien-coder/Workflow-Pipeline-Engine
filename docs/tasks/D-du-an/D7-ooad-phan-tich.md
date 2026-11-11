# D7 — Sơ đồ phân tích OOAD: mảng Dự án, Template, Khách & AI

Người làm: D
Người review: A
Trạng thái: chưa làm
Cần có trước: T1
Cần trước bước frontend: không
Mở khóa: D8
Nhánh git: d7-ooad-phan-tich
Ước lượng: 1 ngày

## Vì sao cần task này
Mảng của D có nhiều actor nhất (Chủ dự án, thành viên, người được mời, khách/giáo viên, quản trị viên). Đây là chỗ luyện vẽ use case tốt nhất. Đặt actor sai hoặc vẽ sai include/extend là lỗi hay bị trừ điểm nhất khi chấm OOAD.

## Sản phẩm (lưu ở `docs/ooad/D-du-an/`)
1. `uc-du-an.puml` — sơ đồ use case của mảng. Được tách làm 2 sơ đồ nếu quá rối: (a) Cộng tác nội bộ, (b) Bên ngoài & AI.
   - Actor: Chủ dự án, Cộng sự, Người được mời (một Người dùng đã đăng nhập), Khách/Giáo viên (truy cập bằng token), Quản trị viên.
   - Use case gợi ý: Tạo dự án, Tạo dự án từ template, Mời thành viên, Phản hồi lời mời (Chấp nhận/Từ chối), Thu hồi lời mời, Đổi vai trò, Chuyển quyền sở hữu, Xóa thành viên, Tạo/thu hồi link khách, Xem tiến độ qua link, Gửi góp ý, Xem & đánh dấu đã xử lý góp ý, Chạy chẩn đoán AI, Quản lý template.
   - Gợi ý quan hệ: "Tạo dự án từ template" `<<extend>>` "Tạo dự án"; "Quản lý template" `<<include>>` "Kiểm tra chu trình" (dùng chung với mảng B).
   - Bắt buộc có ít nhất 1 `<<include>>`, 1 `<<extend>>` (ghi điều kiện), 1 tổng quát hóa giữa actor.
2. `dac-ta-uc.md` — đặc tả 3 use case: **Mời thành viên**, **Khách gửi góp ý**, **Chạy chẩn đoán AI**. Luồng ngoại lệ khớp mã lỗi đã chốt (`INVITATION_ALREADY_PENDING`, `REVOKED_GUEST`, `COOLDOWN_ACTIVE`…).
3. `activity-moi-thanh-vien.puml` — activity "Mời thành viên" với 3 làn Chủ dự án | Hệ thống | Người được mời. Có rẽ nhánh chấp nhận/từ chối, có sự kiện thời gian "hết 7 ngày" dẫn tới EXPIRED.
4. `bce-du-an.puml` — sơ đồ lớp phân tích BCE:
   - boundary: màn hình Workspace, màn hình cài đặt thành viên, trang khách, Template Studio;
   - control: điều khiển dự án, điều khiển lời mời, cổng khách, điều khiển góp ý, bộ chẩn đoán AI;
   - entity: Dự án, Thành viên, Lời mời, Link khách, Góp ý, Template.

## Bước 0 — Tự đọc, không dùng AI
Đọc: `docs/ooad/CAM_NANG_VE_SO_DO.md` mục 3.1, 3.2, 3.3, 3.6; `docs/specs/system-overview.md` (Phân hệ 2, 4, 5; UC5, UC7–UC9, UC12, UC19–UC23); integration map Cụm 3, 7, 8, 9, 10.3; sơ đồ use case cũ ở `docs/archive/docs_for_db_bfd/usecase.md`.
Trả lời:
1. Sơ đồ cũ trong archive sai ký hiệu ở đâu? Có use case nào trái với SSOT hiện tại không (gợi ý: "Claim Task", "Phản hồi giải trình Feedback")?
2. Khách truy cập bằng token có phải một actor riêng không, hay là Người dùng vãng lai? Lập luận.
3. "Thành viên" là một entity riêng hay chỉ là quan hệ giữa Người dùng và Dự án? (gợi ý: lớp kết hợp)

## Được đọc
- `docs/**`, `wpe-backend/src/**`, `wpe-frontend/src/**`

## Được ghi
- `docs/ooad/D-du-an/**`, `docs/ooad/png/D-*.png`
- `docs/tasks/D-du-an/D7-ooad-phan-tich.md`

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 **Vẽ tay** (giấy hoặc draw.io) đủ 4 sản phẩm, không dùng AI. Chụp ảnh dán vào ghi chép.
3. 🧠 Tự chấm theo checklist của từng loại sơ đồ trong cẩm nang, ghi điểm.
4. 🤝 Đưa ảnh hoặc mô tả bản vẽ cho Claude soát. Claude chỉ ra lỗi, **bạn tự sửa**.
5. 🤝 Chép sang PlantUML (hoặc công cụ GV yêu cầu), render, xuất PNG vào `docs/ooad/png/` với tên `D-<tên file>.png`.
6. Mở PR. Người review (A) dò theo checklist và hỏi "Câu hỏi bảo vệ".

## Tiêu chí xong
- [ ] Đủ 4 sản phẩm, render được, có PNG.
- [ ] Checklist cẩm nang của từng sơ đồ đạt hết, hoặc mục nào không đạt thì có giải thích.
- [ ] Use case khớp ma trận RBAC (UC5, UC7–UC9, UC12, UC19–UC23), hoặc giải thích vì sao thêm hay gộp.
- [ ] Ghi chép có ảnh bản vẽ tay đầu tiên.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn tài liệu)
1. Chỉ vào sơ đồ: include nào, extend nào, điều kiện extend là gì?
2. Theo sơ đồ activity, lời mời hết hạn trong lúc người được mời đang mở popup thì luồng đi thế nào?
3. Trong sơ đồ BCE, "Khách gửi góp ý" đi qua những lớp nào?

## Cấm
- Dùng AI vẽ bản đầu tiên.
- Sửa file ngoài mục "Được ghi". Không sửa `docs/archive/`.
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
