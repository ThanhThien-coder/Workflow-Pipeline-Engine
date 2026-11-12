# X3 — Ráp bộ sơ đồ OOAD toàn hệ thống và kiểm nhất quán

Người làm: cả nhóm (A, B, C, D) — mỗi người vẽ thêm 1–2 sơ đồ cấp hệ thống
Người review: cả nhóm (buổi kiểm nhất quán)
Trạng thái: chưa làm
Cần có trước: A8, B8, C8, D8
Cần trước bước frontend: không
Mở khóa: X4
Nhánh git: x3-ooad-he-thong
Ước lượng: 1 ngày

> ⚡ **Chế độ sprint:** làm ở chiều và tối ngày 2 ([SPRINT_2_NGAY.md](../SPRINT_2_NGAY.md) mục 6), **không cần chờ đủ A8–D8**: mảng nào chưa xong thì ghi "chưa có" trong mục lục.
> - **Claude làm:** vẽ sơ đồ cấp hệ thống từ code thật, điền mục lục `docs/ooad/README.md`, đối chiếu sơ đồ state với enum trong code, xuất PNG.
> - **Cả nhóm làm:** buổi kiểm nhất quán rút còn 30 phút, chỉ soát tên use case và tên lớp giữa 4 mảng. Chỗ lệch ghi vào `docs/ooad/kiem-nhat-quan.md`.
> - **Không làm trong sprint:** vẽ tay bản đầu.

## Vì sao cần task này
Sơ đồ theo mảng (A7–D8) đã đủ chi tiết. Báo cáo OOAD còn cần các sơ đồ **toàn hệ thống**, và cần cả bộ sơ đồ **nhất quán với nhau**: tên lớp, tên use case, trạng thái phải trùng khớp giữa các sơ đồ và với code.

## Phân công sơ đồ cấp hệ thống (ai đã làm hạ tầng hay nghiệp vụ liên quan thì vẽ)
- **A**: Deployment diagram (trình duyệt, JVM, Docker gồm PostgreSQL và RabbitMQ, Gemini; giao thức và cổng) và Package diagram backend (controller, service, repository, entity, dto, config, security).
- **B**: Class diagram miền (domain model — mọi entity và quan hệ, không có controller/service), ERD cập nhật sau các migration mới (V5 trở đi) (`docs/specs/database-schema.md`), Object diagram dữ liệu seed.
- **C**: Component diagram (các khối FE, REST, các khối BE, RabbitMQ, SSE, PostgreSQL; interface cung cấp và yêu cầu).
- **D**: Use case tổng quát (đủ 6 actor, đủ 23 UC trong ma trận RBAC), và BFD nếu GV yêu cầu (cập nhật từ `docs/archive/docs_for_db_bfd/bfd.md`, không sửa file archive).

## Việc cần làm
1. 🧠 Mỗi người vẽ tay sơ đồ cấp hệ thống của mình trước, rồi chép sang công cụ. Lưu ở `docs/ooad/he-thong/`.
2. Ráp `docs/ooad/README.md`: điền bảng mục lục toàn bộ sơ đồ (của A7–D8 và cấp hệ thống). Mỗi sơ đồ ghi file, người vẽ, người review, mô tả 2 câu.
3. **Buổi kiểm nhất quán (cả nhóm, khoảng 1 giờ)**, theo cẩm nang mục 4:
   - Use case tổng quát ↔ use case của từng mảng: tên phải trùng.
   - Class miền ↔ ERD ↔ entity trong code.
   - Từng sequence ↔ class diagram thiết kế của mảng đó.
   - Sơ đồ state ↔ enum trong code: `NodeStatus`, `InvitationStatus`, `ProjectStatus`, `FeedbackStatus`.
   Ghi mọi chỗ lệch và cách xử lý vào `docs/ooad/kiem-nhat-quan.md`.
4. Xuất PNG/PDF cho báo cáo vào `docs/ooad/png/`.

## Tiêu chí xong
- [ ] `docs/ooad/README.md` có đủ mục lục.
- [ ] Các sơ đồ cấp hệ thống render được.
- [ ] `docs/ooad/kiem-nhat-quan.md` không còn mục "lệch" nào chưa giải thích.
- [ ] Use case tổng quát có đủ 23 UC của ma trận RBAC, hoặc ghi rõ lý do gộp.

## Câu hỏi bảo vệ (hỏi chéo trong buổi kiểm nhất quán)
1. Component diagram khác package diagram ở đâu?
2. Class diagram miền khác ERD ở đâu (bội số, khóa ngoại, lớp kết hợp)?
3. Deployment diagram trả lời câu hỏi gì mà các sơ đồ khác không trả lời?

## Cấm
- Dùng AI vẽ bản đầu tiên của sơ đồ cấp hệ thống.
- Sửa `docs/archive/`.
- Tự ghi trạng thái `xong`.

## Dành cho Claude (đọc trước khi làm)
Người dán file này đang ráp bộ sơ đồ OOAD.
1. Không vẽ hộ bản đầu tiên. Được soát lỗi ký hiệu và tìm chỗ lệch giữa các sơ đồ.
2. Khi kiểm nhất quán: đọc file sơ đồ và code thật để đối chiếu, liệt kê chỗ lệch kèm vị trí, để nhóm tự quyết cách sửa.

## Ghi chép của người làm
### Mỗi người đã vẽ gì
- **C (12/11/2026, chế độ sprint, Claude vẽ từ code thật):** component diagram `docs/ooad/he-thong/component.puml` (PNG `docs/ooad/png/C-component.png`). Đã điền dòng của C7, C8 và component vào mục lục `docs/ooad/README.md`. Ghi chú trên sơ đồ: Profile, Admin, Notification ở giao diện vẫn dùng mock; integration map chương I còn nhắc `PhaseController`, `UserProfileController`, `AdminPortalController`, `NotificationController` nhưng code chưa có.

### Các chỗ lệch tìm được trong buổi kiểm nhất quán (tóm tắt)

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**
