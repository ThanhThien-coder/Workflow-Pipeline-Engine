# A7 — Sơ đồ phân tích OOAD: mảng Tài khoản & Bảo mật

Người làm: A
Người review: B
Trạng thái: chờ kiểm
Cần có trước: T1
Cần trước bước frontend: không
Mở khóa: A8
Nhánh git: a7-ooad-phan-tich
Ước lượng: 1 ngày

> ⚡ **Chế độ sprint:** Claude làm hết các bước, kể cả 🧠; bỏ qua Bước 0 và mục "Dành cho Claude". Luồng làm: [SPRINT_2_NGAY.md](../SPRINT_2_NGAY.md) mục 2–3.
> - **Claude tự chạy bằng dòng lệnh:** render các file `.puml` ra PNG.
> - **Dời về buổi kiểm chung (mục 7):** không có.
> - **Không làm trong sprint:** vẽ tay bản đầu trên giấy. Claude vẽ từ code thật; vòng hiểu là người làm giải thích lại 1 sơ đồ sequence (task số 7 thì 1 sơ đồ activity).

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
> Chế độ sprint (12/11/2026, nhánh `a7-ooad-phan-tich` từ main `77416de`): Claude vẽ từ code thật và đặc tả đã chốt, không vẽ tay. Vòng hiểu: người làm giải thích lại sơ đồ activity "Đổi mật khẩu".
>
> **Vòng hiểu: đã làm** (12/11/2026, qua remote). Lần 1 thiếu (chỉ nêu kiểm độ dài, chưa nêu kiểm mật khẩu hiện tại; hỏi lại ý fork/join và đăng nhập lại). Lần 2: đúng 2 bước kiểm (`VALIDATION_FAILED`, `WRONG_PASSWORD`), đúng nghĩa join, đúng lý do đăng nhập lại; nhầm mục đích tăng `token_version` (tưởng để chặn mật khẩu cũ). Lần 3 đúng: tăng phiên bản token làm vô hiệu hóa các access token (JWT) đang dùng. Người làm hỏi thêm: hình hành động và hình thoi khác nhau thế nào; JWT là gì.

**Sản phẩm** (thư mục `docs/ooad/A-tai-khoan/`, ảnh ở `docs/ooad/png/`):
| Sản phẩm | File | PNG |
| :--- | :--- | :--- |
| Use case | `uc-tai-khoan.puml` | `A-uc-tai-khoan.png` |
| Đặc tả 3 UC (Đăng nhập, Đổi mật khẩu, Khóa tài khoản) | `dac-ta-uc.md` | — |
| Activity "Đổi mật khẩu" | `activity-doi-mat-khau.puml` | `A-activity-doi-mat-khau.png` |
| Class phân tích BCE | `bce-tai-khoan.puml` | `A-bce-tai-khoan.png` |

**Render:** PlantUML 1.2024.7 (jar tải từ Maven Central, chạy trên máy, không gửi lên server công khai), lệnh `java -jar plantuml-1.2024.7.jar -charset UTF-8 -o <png> A-tai-khoan/*.puml`. Máy không có Graphviz nên use case và BCE dùng `!pragma layout smetana` (giống mảng D). Kết quả: cả 3 sơ đồ render được, không lỗi. Lần đầu BCE báo lỗi cú pháp vì trộn `actor` với `class`; đã thêm `allowmixing`.

### Trả lời Bước 0
1. **"Làm mới token" không phải use case.** Use case là mục tiêu có giá trị với actor. Không ai mở app với mục tiêu "làm mới token"; đó là cơ chế kỹ thuật giao diện tự chạy khi access token hết hạn (A4), là một phần để duy trì phiên của "Đăng nhập". Ghi trong đặc tả và sơ đồ sequence ở A8, không vẽ thành elip.
2. **"Đổi ảnh đại diện" là `<<extend>>` của "Cập nhật hồ sơ".** Nó chỉ xảy ra khi người dùng chọn ảnh mới (có điều kiện), và nằm trong cùng mục tiêu "làm hồ sơ của tôi đúng". Vẽ thành use case độc lập cũng không sai (API riêng `POST /users/me/avatar`), nhưng extend thể hiện được quan hệ "tùy chọn, mở rộng từ hồ sơ" mà sơ đồ độc lập không nói được. Ma trận RBAC cũng gộp nó vào UC3.
3. **Lớp control "Điều khiển xác thực" khác `AuthService`:** control là khái niệm **phân tích**, không gắn công nghệ, không có kiểu dữ liệu, gánh cả việc điều phối use case Đăng nhập/Đăng ký/Đăng xuất. Trong code, trách nhiệm đó được tách ra nhiều lớp thật: `AuthController` (nhận HTTP), `AuthService` (điều phối), `JwtService`, `RefreshTokenService`, `TokenHasher`, cùng `JwtAuthFilter`. Một lớp control phân tích có thể thành nhiều lớp thiết kế; sơ đồ class thiết kế ở A8 sẽ vẽ đúng các lớp đó.

### Ảnh bản vẽ tay đầu tiên
Không làm trong sprint (xem khối "Chế độ sprint" ở đầu file). Bổ sung ở giai đoạn Học lại.

### Tự chấm theo checklist (điểm từng sơ đồ)
**Use case: 10/10**
- [x] Có ranh giới hệ thống ghi tên hệ thống.
- [x] 3 actor là vai trò, nằm ngoài ranh giới.
- [x] Tên use case "động từ + danh từ", là mục tiêu.
- [x] include đi từ gốc tới use case được include: Đổi mật khẩu → Thu hồi mọi phiên; Khóa tài khoản → Thu hồi mọi phiên.
- [x] extend đi từ use case mở rộng tới gốc, có điều kiện: Đổi ảnh → Cập nhật hồ sơ; Khóa → Quản lý người dùng; Mở khóa → Quản lý người dùng.
- [x] Tổng quát hóa con → cha: Quản trị viên → Người dùng, đầu tam giác rỗng.
- [x] Không có association actor–actor hay use case–use case.
- [x] "Đăng nhập" không là include của use case nào; là tiền điều kiện trong đặc tả.
- [x] Khớp RBAC, có giải thích (mục dưới).
- [x] 12 use case, dưới 15.

Vì sao chiều mũi tên như vậy:
- **include** đi từ gốc tới phần được include vì gốc **luôn cần** phần đó: đổi mật khẩu hay khóa tài khoản đều **luôn** phải thu hồi mọi phiên (đặc tả A5, A6: `token_version += 1` và `revoked = true`). Hai use case dùng chung hành vi này nên tách ra để tái sử dụng.
- **extend** đi từ phần mở rộng tới gốc vì gốc **không biết và không cần** phần mở rộng: "Quản lý người dùng" (xem danh sách) hoàn chỉnh mà không cần khóa ai; khóa hay mở khóa chỉ chen vào khi có điều kiện.
- **Tổng quát hóa** đi từ con (Quản trị viên) tới cha (Người dùng): Quản trị viên **là một** Người dùng, kế thừa Đăng xuất, Xem/Cập nhật hồ sơ, Đổi ảnh, Đổi mật khẩu (RBAC: System Admin có ✅ ở UC3).

Đối chiếu RBAC (`system-overview.md` mục 4):
- UC1 Đăng ký, UC2 Đăng nhập: chỉ Anonymous → actor Khách vãng lai. Khớp.
- UC3 hồ sơ (Xem, Cập nhật, Đổi ảnh, Đổi mật khẩu): Admin và mọi vai trò dự án → actor Người dùng, Admin nhận qua tổng quát hóa. Khớp. Tách UC3 thành 4 use case vì đặc tả A5 có 4 thao tác riêng.
- UC4 Quản lý user & khóa/mở: chỉ Admin → Quản lý người dùng + Khóa + Mở khóa. Khớp.
- UC6 Giám sát & chuyển Archive dự án: chỉ Admin → Lưu trữ workspace. Khớp (phần "giám sát hạ tầng" không thuộc mảng A).
- **Thêm, có giải thích:** "Đăng xuất" không có dòng riêng trong RBAC, gộp vào UC2 (kết thúc phiên do UC2 tạo). "Thu hồi mọi phiên đăng nhập" không nối với actor nào, chỉ được include, nên không cần dòng RBAC.

**Đặc tả use case: 7/7**
- [x] Đủ mã, actor, tiền/hậu điều kiện, luồng chính, thay thế, ngoại lệ (UC nào không có luồng thay thế thì ghi "không có").
- [x] Luồng chính xen kẽ actor và hệ thống, đánh số.
- [x] Thay thế và ngoại lệ ghi bước bắt đầu (3a, E1 (bước 4)…).
- [x] Mã lỗi khớp code (Đăng nhập: `VALIDATION_FAILED`, `BAD_CREDENTIALS`, `ACCOUNT_LOCKED` trong A3 đã merge) hoặc đặc tả đã chốt (`WRONG_PASSWORD` A5, `CANNOT_SUSPEND_ADMIN` A6; **chưa có trong code**).
- [x] Tiền điều kiện không lặp thành bước.
- [x] Không tả giao diện chi tiết.
- [x] Tên trùng sơ đồ use case.

**Activity "Đổi mật khẩu": 8/8**
- [x] 1 nút bắt đầu; 3 nút kết thúc (2 nhánh lỗi, 1 thành công).
- [x] Hành động "động từ + danh từ".
- [x] Mỗi hình thoi có 2 nhánh ghi điều kiện phủ hết (có/không, đúng/sai).
- [x] Nhánh lỗi kết thúc rõ ràng; nhánh đúng đi tiếp.
- [x] Fork (thu hồi phiên làm mới ‖ tăng phiên bản token) có join.
- [x] Hành động đúng làn: nhập/gửi/xem lỗi/đăng nhập lại ở làn Người dùng; kiểm tra/băm/thu hồi ở làn Hệ thống.
- [x] Khớp luồng chính và E1, E2 trong đặc tả UC "Đổi mật khẩu".
- [x] Không lẫn trạng thái thành hành động.

**Class phân tích BCE: đạt quy tắc gọi**
- Actor chỉ nối boundary; boundary gọi control; control làm việc với entity; entity không gọi boundary.
- Entity có thuộc tính chính, chưa có kiểu dữ liệu (đúng giai đoạn phân tích); quan hệ có bội số (Người dùng 1 — 0..* Phiên làm mới).
- Thêm entity "Dự án" (chỉ tên, trạng thái, ngày cập nhật) vì use case "Lưu trữ workspace" cần nó; task chỉ gợi ý 2 entity.

Luồng "Đăng nhập" trong BCE: Khách vãng lai → Màn hình đăng nhập/đăng ký → Điều khiển xác thực → Người dùng (tìm theo tên đăng nhập, so mật khẩu, kiểm khóa) → Phiên làm mới (tạo phiên mới) → kết quả trả ngược về màn hình.

### Lỗi Claude hoặc người review chỉ ra và cách mình sửa
- BCE lần đầu không render (`Syntax Error` ở dòng `class` đầu tiên) → thêm `allowmixing`.
- Activity: người làm hỏi vì sao hành động "Kiểm tra độ dài mật khẩu mới" và hình thoi "Mật khẩu mới đủ 8 ký tự trở lên?" giống nhau. Hai hình khác loại (hành động làm việc; hình thoi chỉ rẽ nhánh), nhưng chữ lặp ý → rút chữ hình thoi thành "Đủ 8 ký tự?" và "Khớp?" theo kiểu ví dụ cẩm nang mục 3.3.
- Use case lần đầu có nét include từ "Khóa tài khoản" cắt qua nét extend của "Mở khóa", khó đọc nhãn → viết 2 quan hệ dạng `A <. B` để engine xếp lại; chiều mũi tên không đổi.

### Điều chưa chắc / cần nhóm quyết
- `WRONG_PASSWORD`, `CANNOT_SUSPEND_ADMIN`, `UNSUPPORTED_MEDIA`, `FILE_TOO_LARGE` mới có trong đặc tả A5/A6, chưa có trong code. Làm A5/A6 phải dùng đúng mã này để đặc tả use case vẫn khớp.
- Khi `@PreAuthorize` từ chối, Spring ném `org.springframework.security.access.AccessDeniedException`. `GlobalExceptionHandler` hiện chưa bắt loại này (chỉ có `ForbiddenException` → `403 ACCESS_DENIED`). A6 cần thêm handler để đặc tả E1 của "Khóa tài khoản" đúng.
- Đặc tả A5 không nói có cấp lại token cho phiên hiện tại sau khi đổi mật khẩu hay không. Sơ đồ theo đúng đặc tả: mọi phiên bị thu hồi, người dùng đăng nhập lại.
- `docs/ooad/png/` trước đây chưa có trên main; thư mục này được tạo mới trong task này.

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**
