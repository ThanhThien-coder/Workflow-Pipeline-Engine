# A8 — Sơ đồ thiết kế OOAD: mảng Tài khoản & Bảo mật (khớp code thật)

Người làm: A
Người review: B
Trạng thái: chưa làm
Cần có trước: A7, A3
Cần trước bước frontend: không
Mở khóa: X3
Nhánh git: a8-ooad-thiet-ke
Ước lượng: 1–1,5 ngày

> ⚡ **Chế độ sprint:** Claude làm hết các bước, kể cả 🧠; bỏ qua Bước 0 và mục "Dành cho Claude". Luồng làm: [SPRINT_2_NGAY.md](../SPRINT_2_NGAY.md) mục 2–3.
> - **Claude tự chạy bằng dòng lệnh:** render các file `.puml` ra PNG.
> - **Dời về buổi kiểm chung (mục 7):** không có.
> - **Không làm trong sprint:** vẽ tay bản đầu trên giấy. Claude vẽ từ code thật; vòng hiểu là người làm giải thích lại 1 sơ đồ sequence (task số 7 thì 1 sơ đồ activity).

## Vì sao cần task này
Sơ đồ thiết kế trả lời câu hỏi "hệ thống làm việc đó **bằng những lớp nào, gọi nhau ra sao**". Khi chấm OOAD, giảng viên hay hỏi: message trong sequence có phải phương thức thật không, class diagram có khớp code không. Vẽ sau khi code A3 xong thì sơ đồ khớp code, bạn hiểu luồng thật và trả lời được.

> Hạn OOAD tới trước khi code xong: vẽ theo đặc tả trong A3 và code hiện có, đánh dấu "dự kiến" ở phần chưa code. Code xong thì cập nhật lại.

## Sản phẩm (lưu ở `docs/ooad/A-tai-khoan/`)
1. `seq-dang-nhap.puml` — sequence "Đăng nhập", lifeline là lớp thật: `AuthView`, `authSlice`, `auth.ts`/`apiClient`, `AuthController`, `AuthService`, `UserRepository`, `PasswordEncoder`, `JwtService`, `RefreshTokenService`. Có `alt` cho 3 nhánh: sai mật khẩu (401), bị khóa (403), thành công.
2. `seq-lam-moi-token.puml` — sequence "Làm mới token". Có `alt` phát hiện dùng lại (thu hồi tất cả), có phía FE: single-flight, gửi lại request gốc.
3. `comm-dang-nhap.puml` — sơ đồ communication chuyển từ sơ đồ 1 (đánh số 1, 1.1, 1.2…).
4. `class-tai-khoan.puml` — class diagram thiết kế: controller, service, filter, `CurrentUserProvider`, entity (`UserEntity`, `RefreshTokenEntity`), repository (interface kế thừa `JpaRepository`), DTO record, enum `SystemRole`. Có visibility, kiểu dữ liệu, bội số (`UserEntity` 1 — 0..* `RefreshTokenEntity`), dependency (nét đứt), realization/kế thừa đúng ký hiệu.
5. `state-tai-khoan.puml` — 2 sơ đồ trạng thái:
   - Tài khoản: Hoạt động ⇄ Bị khóa (suspend/unban); tự chuyển "đổi mật khẩu / tokenVersion++".
   - Refresh token: Còn hiệu lực → Đã xoay / Đã thu hồi / Hết hạn, có điều kiện `[dùng lại khi đã thu hồi] / thu hồi tất cả`.
6. `nhat-quan.md` — ma trận nhất quán: mỗi message trong sơ đồ 1 và 2 → phương thức trong class diagram → `file:dòng` trong code.

## Bước 0 — Tự đọc, không dùng AI
Đọc: cẩm nang mục 3.4, 3.5, 3.6, 3.7 và mục 4 (ma trận nhất quán); code A3 đã merge; ghi chép A3 của chính bạn.
Trả lời:
1. Message đồng bộ và bất đồng bộ khác nhau thế nào về ký hiệu và ý nghĩa? Trong luồng đăng nhập có message bất đồng bộ nào không?
2. `UserRepository` là interface, vẽ quan hệ với `JpaRepository` bằng ký hiệu gì? Với `AuthService` thì ký hiệu gì?
3. Vì sao sơ đồ trạng thái tài khoản không có trạng thái kết thúc, còn refresh token thì có?

## Được đọc
- `docs/**`, `wpe-backend/src/**`, `wpe-frontend/src/**`

## Được ghi
- `docs/ooad/A-tai-khoan/**`, `docs/ooad/png/A-*.png`
- `docs/tasks/A-tai-khoan/A8-ooad-thiet-ke.md`

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 Vẽ tay sơ đồ 1, 4, 5 trước, nhìn code thật để vẽ (không dùng AI).
3. 🧠 Tự lập ma trận nhất quán (sản phẩm 6). Message nào không có phương thức thật thì sửa sơ đồ, hoặc ghi lý do.
4. 🤝 Nhờ Claude soát lỗi ký hiệu và đối chiếu với code. Bạn tự sửa.
5. 🤝 Vẽ sơ đồ 2, 3 (Claude được gợi ý bố cục, bạn tự quyết nội dung), chép sang PlantUML, render, xuất PNG.
6. Mở PR. Người review (B) chọn ngẫu nhiên 5 message và dò tới code.

## Tiêu chí xong
- [ ] Đủ 6 sản phẩm, render được, có PNG.
- [ ] Người review dò 5 message ngẫu nhiên đều tìm thấy phương thức thật (ghi kết quả vào PR).
- [ ] Class diagram có đủ visibility, kiểu và bội số. Không vẽ trùng: đã có quan hệ thì không ghi thêm thuộc tính khóa ngoại.
- [ ] Checklist cẩm nang của từng sơ đồ đạt hết, hoặc mục nào không đạt thì có giải thích.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn tài liệu)
1. Vẽ lại trên bảng sơ đồ sequence đăng nhập trong 10 phút.
2. Sequence và communication khác nhau ở đâu? Khi nào nên dùng cái nào?
3. Chỉ trên class diagram: một thay đổi ở `UserEntity` ảnh hưởng tới những lớp nào?

## Cấm
- Dùng AI vẽ bản đầu tiên của sơ đồ 1, 4, 5.
- Vẽ phương thức không có trong code mà không đánh dấu "dự kiến".
- Tự ghi trạng thái `xong`.

## Dành cho Claude (đọc trước khi làm)
Người dán file này đang **học vẽ sơ đồ thiết kế OOAD** khớp với code thật.
1. Không vẽ hộ bản đầu tiên của sơ đồ 1, 4, 5.
2. Khi soát: đối chiếu từng message và từng lớp với code trong repo (đọc file thật, không đoán). Chỉ ra chỗ lệch và để họ tự sửa.
3. Chấm theo checklist trong `docs/ooad/CAM_NANG_VE_SO_DO.md`.
4. Cuối buổi, hỏi họ 3 câu trong "Câu hỏi bảo vệ".

## Ghi chép của người làm
### Trả lời Bước 0

### Ảnh bản vẽ tay đầu tiên

### Ma trận nhất quán: các chỗ lệch đã tìm thấy và cách xử lý

### Lỗi Claude hoặc người review chỉ ra và cách mình sửa

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**
