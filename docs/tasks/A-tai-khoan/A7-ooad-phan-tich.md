# A7 — Sơ đồ phân tích OOAD: mảng Tài khoản & Bảo mật

Người làm: A
Người review: B
Trạng thái: chưa làm
Cần có trước: T1
Cần trước bước frontend: không
Mở khóa: A8
Nhánh git: a7-ooad-phan-tich
Ước lượng: 1 ngày

## Vì sao cần task này
Sơ đồ phân tích trả lời câu hỏi "hệ thống làm gì, cho ai", chưa bàn tới code. Làm sớm thì hiểu nghiệp vụ trước khi code A3–A6, và đây là phần điểm lớn của môn OOAD.

## Sản phẩm (lưu ở `docs/ooad/A-tai-khoan/`)
1. `uc-tai-khoan.puml` — sơ đồ use case của mảng.
   - Actor gợi ý: Khách vãng lai, Người dùng (đã đăng nhập), Quản trị viên (tổng quát hóa từ Người dùng).
   - Use case gợi ý: Đăng ký, Đăng nhập, Đăng xuất, Xem hồ sơ, Cập nhật hồ sơ, Đổi ảnh đại diện, Đổi mật khẩu, Quản lý người dùng, Khóa tài khoản, Mở khóa tài khoản, Lưu trữ workspace.
   - Bắt buộc có ít nhất 1 `<<include>>`, 1 `<<extend>>` và 1 quan hệ tổng quát hóa giữa actor. Trong ghi chép, giải thích vì sao chọn chiều mũi tên như vậy.
2. `dac-ta-uc.md` — đặc tả 3 use case theo mẫu trong cẩm nang: **Đăng nhập**, **Đổi mật khẩu**, **Khóa tài khoản người dùng**. Luồng thay thế và luồng ngoại lệ phải khớp mã lỗi đã chốt ở A3, A5, A6 (`BAD_CREDENTIALS`, `ACCOUNT_LOCKED`, `WRONG_PASSWORD`, `CANNOT_SUSPEND_ADMIN`…).
3. `activity-doi-mat-khau.puml` — sơ đồ activity "Đổi mật khẩu" với 2 làn Người dùng | Hệ thống. Có rẽ nhánh (mật khẩu cũ đúng hay sai), có fork/join (thu hồi refresh token ‖ tăng `token_version`).
4. `bce-tai-khoan.puml` — sơ đồ lớp phân tích theo mẫu BCE:
   - boundary: màn hình đăng nhập/đăng ký, màn hình hồ sơ, màn hình quản trị người dùng;
   - control: điều khiển xác thực, điều khiển hồ sơ, điều khiển quản trị;
   - entity: Người dùng, Phiên làm mới (refresh token).
   Có thuộc tính chính (chưa cần kiểu dữ liệu) và quan hệ kèm bội số.

## Bước 0 — Tự đọc, không dùng AI
Đọc: `docs/ooad/CAM_NANG_VE_SO_DO.md` mục 3.1, 3.2, 3.3, 3.6; `docs/specs/system-overview.md` (Phân hệ 1 và 5, UC1–UC4, UC6); integration map Cụm 1, 2, 10.1–10.2.
Trả lời:
1. "Làm mới token" có phải use case không? Vì sao? (gợi ý: use case là mục tiêu của actor)
2. "Đổi ảnh đại diện" nên là `<<extend>>` của "Cập nhật hồ sơ" hay một use case độc lập? Lập luận.
3. Lớp control "điều khiển xác thực" khác lớp `AuthService` trong code ở chỗ nào?

## Được đọc
- `docs/**`, `wpe-backend/src/**`, `wpe-frontend/src/**`

## Được ghi
- `docs/ooad/A-tai-khoan/**`, `docs/ooad/png/A-*.png`
- `docs/tasks/A-tai-khoan/A7-ooad-phan-tich.md`

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 **Vẽ tay** (giấy hoặc draw.io) đủ 4 sản phẩm, không dùng AI. Chụp ảnh dán vào ghi chép.
3. 🧠 Tự chấm theo checklist của từng loại sơ đồ trong cẩm nang, ghi điểm.
4. 🤝 Đưa ảnh hoặc mô tả bản vẽ cho Claude soát. Claude chỉ ra lỗi, **bạn tự sửa**.
5. 🤝 Chép sang PlantUML (hoặc công cụ GV yêu cầu), render, xuất PNG vào `docs/ooad/png/` với tên `A-<tên file>.png`.
6. Mở PR. Người review (B) dò theo checklist và hỏi "Câu hỏi bảo vệ".

## Tiêu chí xong
- [ ] Đủ 4 sản phẩm, render được, có PNG.
- [ ] Checklist cẩm nang của từng sơ đồ đạt hết, hoặc mục nào không đạt thì có giải thích.
- [ ] Mỗi use case trong sơ đồ có trong ma trận RBAC (`system-overview.md` mục 4), hoặc giải thích vì sao thêm hay gộp.
- [ ] Đặc tả use case có luồng thay thế và luồng ngoại lệ khớp mã lỗi trong code/đặc tả.
- [ ] Ghi chép có ảnh bản vẽ tay đầu tiên (để thấy quá trình tự làm).

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn tài liệu)
1. Chỉ vào sơ đồ: include nào, extend nào, vì sao mũi tên đi chiều đó?
2. Actor Quản trị viên tổng quát hóa từ Người dùng thì kế thừa những use case nào?
3. Trong sơ đồ BCE của bạn, một yêu cầu "Đăng nhập" đi qua những lớp nào, theo thứ tự nào?

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
