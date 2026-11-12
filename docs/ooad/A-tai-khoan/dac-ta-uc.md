# Đặc tả use case — Mảng Tài khoản & Bảo mật (A7)

Theo mẫu `docs/ooad/CAM_NANG_VE_SO_DO.md` mục 3.2. Tên use case trùng với sơ đồ `uc-tai-khoan.puml`. Mã UC khớp ma trận RBAC `docs/specs/system-overview.md` mục 4.

Nguồn mã lỗi:
- **Đăng nhập:** code thật đã merge (A3: `AuthService`, `AuthController`, `GlobalExceptionHandler`).
- **Đổi mật khẩu, Khóa tài khoản:** "Đặc tả đã chốt" của A5 và A6. Hai task này chưa code (dời sau sprint), nên `WRONG_PASSWORD` và `CANNOT_SUSPEND_ADMIN` **chưa có trong code**. Khi làm A5, A6 phải dùng đúng các mã này.

---

## UC: Đăng nhập
- **Mã:** UC2
- **Actor chính:** Khách vãng lai. **Actor phụ:** không có.
- **Mô tả ngắn:** Khách nhập tên đăng nhập và mật khẩu để vào hệ thống. Hệ thống cấp access token (sống 15 phút) và refresh token (sống 7 ngày, dùng 1 lần).
- **Tiền điều kiện:** khách đã có tài khoản; chưa đăng nhập trên trình duyệt này.
- **Hậu điều kiện khi thành công:**
  1. Một phiên làm mới mới được lưu (chỉ lưu mã băm SHA-256 của refresh token, `revoked = false`, hạn 7 ngày).
  2. Người dùng ở trạng thái đã đăng nhập và vào được Workspace.
- **Luồng chính:**
  1. Khách mở màn hình đăng nhập.
  2. Hệ thống hiển thị form đăng nhập.
  3. Khách nhập tên đăng nhập, mật khẩu, chọn có ghi nhớ đăng nhập hay không, rồi xác nhận.
  4. Hệ thống kiểm tra dữ liệu bắt buộc.
  5. Hệ thống tìm người dùng theo tên đăng nhập và so khớp mật khẩu với mật khẩu đã băm (BCrypt).
  6. Hệ thống kiểm tra tài khoản không bị khóa.
  7. Hệ thống tạo access token và refresh token, lưu phiên làm mới, trả thông tin người dùng.
  8. Khách (giờ là Người dùng) được chuyển vào Workspace.
- **Luồng thay thế:**
  - 3a. Khách chọn "ghi nhớ đăng nhập" → phiên được lưu lâu dài trên trình duyệt (localStorage); không chọn → chỉ lưu đến khi đóng trình duyệt (sessionStorage). Thời hạn token phía máy chủ không đổi.
- **Luồng ngoại lệ:**
  - E1 (bước 4). Thiếu tên đăng nhập hoặc mật khẩu → `400 VALIDATION_FAILED`, use case kết thúc.
  - E2 (bước 5). Không có tên đăng nhập đó, hoặc sai mật khẩu → `401 BAD_CREDENTIALS` với cùng một thông báo, use case kết thúc.
  - E3 (bước 6). Tài khoản đang bị khóa → `403 ACCOUNT_LOCKED`, use case kết thúc.
- **Quy tắc nghiệp vụ:**
  - BR1. Sai tên đăng nhập và sai mật khẩu trả **cùng** một lỗi, để người ngoài không dò được tài khoản nào tồn tại.
  - BR2. Chỉ kiểm tra khóa **sau khi** mật khẩu đúng, để không lộ trạng thái khóa cho người không biết mật khẩu.
  - BR3. Hệ thống chỉ tìm theo tên đăng nhập, không tìm theo email.

---

## UC: Đổi mật khẩu
- **Mã:** UC3 (nhóm "Xem & cập nhật hồ sơ cá nhân")
- **Actor chính:** Người dùng (gồm cả Quản trị viên, nhờ tổng quát hóa). **Actor phụ:** không có.
- **Mô tả ngắn:** Người dùng đổi mật khẩu của chính mình. Sau khi đổi, mọi phiên đăng nhập trên mọi thiết bị bị thu hồi.
- **Tiền điều kiện:** người dùng đã đăng nhập (access token hợp lệ).
- **Hậu điều kiện khi thành công** (trong **1 transaction**):
  1. Mật khẩu đã băm (BCrypt) được thay bằng mật khẩu mới.
  2. `token_version` tăng 1, nên mọi access token cũ mất hiệu lực.
  3. Mọi phiên làm mới của người dùng có `revoked = true`.
- **Luồng chính:**
  1. Người dùng mở mục bảo mật trong hồ sơ.
  2. Hệ thống hiển thị form đổi mật khẩu.
  3. Người dùng nhập mật khẩu hiện tại, mật khẩu mới và xác nhận.
  4. Hệ thống kiểm tra mật khẩu mới có từ 8 ký tự trở lên.
  5. Hệ thống so khớp mật khẩu hiện tại với mật khẩu đã băm.
  6. Hệ thống băm và lưu mật khẩu mới, đồng thời thực hiện use case **"Thu hồi mọi phiên đăng nhập"** (include): tăng `token_version` và thu hồi mọi phiên làm mới.
  7. Hệ thống báo đổi mật khẩu thành công.
  8. Người dùng đăng nhập lại bằng mật khẩu mới.
- **Luồng thay thế:** không có.
- **Luồng ngoại lệ:**
  - E1 (bước 4). Mật khẩu mới dưới 8 ký tự → `400 VALIDATION_FAILED`, use case kết thúc.
  - E2 (bước 5). Mật khẩu hiện tại sai → `400 WRONG_PASSWORD`, use case kết thúc.
  - E3 (bất kỳ bước nào). Access token hết hạn hoặc không hợp lệ → `401 TOKEN_EXPIRED`. Phía giao diện tự làm mới token 1 lần (A4); thất bại thì đăng xuất.
- **Quy tắc nghiệp vụ:**
  - BR1. Đổi mật khẩu luôn thu hồi **mọi** phiên, kể cả phiên đang dùng.
  - BR2. Ba thay đổi trong hậu điều kiện nằm trong cùng một transaction: hoặc cả ba, hoặc không thay đổi gì.

---

## UC: Khóa tài khoản
- **Mã:** UC4 ("Quản lý user & khóa/mở tài khoản"). Là `<<extend>>` của "Quản lý người dùng".
- **Actor chính:** Quản trị viên. **Actor phụ:** Người dùng bị khóa (bị đăng xuất khỏi mọi thiết bị).
- **Mô tả ngắn:** Quản trị viên khóa một tài khoản vi phạm. Tài khoản bị khóa không đăng nhập được và mọi phiên đang mở bị thu hồi.
- **Tiền điều kiện:** Quản trị viên đã đăng nhập bằng JWT thật (có vai trò `ADMIN`); đang ở màn hình quản trị người dùng.
- **Hậu điều kiện khi thành công:**
  1. Tài khoản có `is_locked = true`.
  2. `token_version` của tài khoản đó tăng 1 và mọi phiên làm mới của tài khoản đó bị thu hồi.
  3. Lần đăng nhập sau của tài khoản đó nhận `403 ACCOUNT_LOCKED`.
- **Luồng chính:**
  1. Quản trị viên tìm người dùng (theo từ khóa, trạng thái).
  2. Hệ thống hiển thị danh sách người dùng, email đã che (ví dụ `a***@pipeline.engine`).
  3. Quản trị viên chọn một người dùng đang hoạt động, chọn "Khóa", nhập lý do và số ngày khóa.
  4. Hệ thống kiểm tra người gọi có vai trò `ADMIN`.
  5. Hệ thống kiểm tra tài khoản bị khóa không phải Quản trị viên.
  6. Hệ thống đặt `is_locked = true` và thực hiện use case **"Thu hồi mọi phiên đăng nhập"** (include).
  7. Hệ thống ghi log lý do và số ngày khóa, rồi báo khóa thành công.
  8. Quản trị viên thấy trạng thái người dùng đổi thành "Đã khóa".
- **Luồng thay thế:**
  - 3a. Người dùng được chọn đang bị khóa → giao diện hiện "Mở khóa" thay cho "Khóa" (chuyển sang use case **Mở khóa tài khoản**).
- **Luồng ngoại lệ:**
  - E1 (bước 4). Người gọi không phải `ADMIN` → `403 ACCESS_DENIED`, use case kết thúc.
  - E2 (bước 5). Tài khoản cần khóa có vai trò `ADMIN` → `403 CANNOT_SUSPEND_ADMIN`, use case kết thúc.
  - E3 (bước 6). Không tìm thấy người dùng → `404 RESOURCE_NOT_FOUND`, use case kết thúc.
- **Quy tắc nghiệp vụ:**
  - BR1. Không được khóa Quản trị viên.
  - BR2. Số ngày khóa hiện chỉ được ghi log, chưa có cột lưu hạn khóa; tài khoản bị khóa đến khi Quản trị viên mở khóa (hạn chế ghi trong A6).
  - BR3. Quản trị viên chỉ thấy metadata của người dùng và dự án, không xem nội dung task (system-overview Phân hệ 5).
