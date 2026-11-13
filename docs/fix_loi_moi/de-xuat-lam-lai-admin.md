# Đề xuất làm lại phân hệ Admin

Bản 2, ngày 13/11/2026. Bản này đã qua một lượt phản biện của Gemini 4 Hydrogen XHigh, các ý hợp lý đã đưa thẳng vào nội dung. Đang chờ nhóm duyệt, chưa sửa code.

## 1. Kết luận

Nhận định của nhóm là đúng: chỉ 2 chức năng có giá trị thật là **quản lý tài khoản** và **thư viện template mẫu**. Các phần còn lại thu gọn lại để phục vụ 2 chức năng này. Việc chia làm **2 đợt** để không phá luật "đợt này chỉ fix lỗi" của [README](README.md) dòng 5:

- **Đợt 1, sửa lỗi:** làm đúng các task FA1–FA3 và FD1–FD3 đã chốt cho lỗi L19–L24, kèm vài điều chỉnh nhỏ ở mục 5.
- **Đợt 2, tính năng mới:** mở task riêng sau khi đợt 1 đã merge.

| Chức năng hiện có | Đề xuất | Tham khảo ở hệ thống lớn |
|---|---|---|
| Quản lý tài khoản | Giữ. Đợt 1: khóa và mở khóa (FA2). Đợt 2: đổi vai trò, xóa tài khoản chưa có dữ liệu, chuyển chủ dự án | **GitLab** (Admin > Users): Block, Ban, Delete; không xóa được người là chủ duy nhất của group. **Atlassian**: deactivate thay cho xóa, xóa có 14 ngày chờ. **Google Workspace**: chuyển quyền sở hữu dữ liệu trước khi xóa. **Asana**: khi gỡ thành viên thì chọn người nhận lại dự án |
| Thư viện template | Giữ (FD3). Danh sách trong admin chỉ hiện template `PUBLIC` | **Confluence** (Global templates and blueprints): admin tạo template dùng được ở mọi space, tắt (ẩn) một template trên toàn site rồi bật lại được |
| Nhật ký bảo mật | Thu hẹp thành nhật ký thao tác admin cộng các sự kiện đăng nhập (FA3) | **Atlassian** (Security > Audit log): ghi thao tác của admin lên user, giữ 180 ngày. **OWASP**: luôn ghi thao tác quản trị và các lần đăng nhập |
| Workspace & DAG | Thu nhỏ thành danh sách dự án chỉ gồm thông tin chung, không có DAG (FA2, FD2) | **GitLab** (Admin > Projects): danh sách mọi project, lọc theo tên và mức hiển thị, không mở nội dung |
| Overview & Analytics | Bỏ biểu đồ và số giả, chỉ giữ số đếm thật từ DB (FD1) | **GitLab** (Admin dashboard): tổng số project, user, group; thống kê user đang hoạt động và bị khóa. Lượt truy cập thì xem ở **Vercel Web Analytics** |

## 2. Hiện trạng (đã đọc code)

- Admin có 5 tab ([AdminSidebar.tsx](../../wpe-frontend/src/features/admin/components/AdminSidebar.tsx)). Mọi tab trừ template đang dùng `MockAdminService`. Backend chưa có API `/api/v1/admin/**`.
- 3 role thầy yêu cầu là **Admin, User, Guest**. Trong code: `SystemRole` có `ADMIN` và `USER`; Guest là người xem qua link khách (FC2). Trong mỗi dự án, User còn có quyền `OWNER`, `MANAGER`, `COLLABORATOR` hoặc `VIEWER`.
- Bảng `users` đã có `is_locked` và `token_version` ([V1](../../wpe-backend/src/main/resources/db/migration/V1__init_schema.sql) dòng 15–16), nên khóa tài khoản và đăng xuất mọi nơi làm được mà không cần migration.
- **Xóa cứng user đã có dữ liệu thì DB báo lỗi khóa ngoại.** Các cột sau trỏ tới `users(id)` mà không có `ON DELETE`: `project.owner_id`, `pipeline_template.created_by`, `artifacts.uploaded_by`, `project_invitation.inviter_id`, `invitee_id`.
- Template: `PUBLIC` là template admin tạo, ai cũng thấy. `PRIVATE` là template user lưu từ dự án của mình ([V11](../../wpe-backend/src/main/resources/db/migration/V11__template_visibility.sql)).
- Đặc tả chốt: admin **không được xem nội dung task** (`docs/specs/system-overview.md` dòng 79). UC4 của admin chỉ là "Quản lý User & Khóa/Mở tài khoản" (dòng 127). Đăng ký tài khoản (UC1) là việc của người chưa đăng nhập (dòng 124).

## 3. Các hệ thống lớn làm gì

| Hệ thống | Khóa / tạm ngưng | Xóa | Dữ liệu của người bị xóa |
|---|---|---|---|
| GitLab | Block (giữ dữ liệu), Deactivate (tài khoản lâu không dùng), Ban (khóa và ẩn hoạt động) | Chỉ xóa user, đóng góp chuyển sang "Ghost User"; hoặc xóa cả đóng góp. Không xóa được người là chủ duy nhất của group | Khuyên dùng block, ban hoặc deactivate thay cho xóa |
| Atlassian (Jira) | Deactivate: giữ vai trò, mở lại được bất cứ lúc nào | Bị deactivate 14 ngày trước khi xóa hẳn, hủy được trong thời gian đó | Hiện tên "Former user" |
| Google Workspace | Suspend là bước đầu, đảo ngược được | Xóa là vĩnh viễn | Chuyển quyền sở hữu file **trước** khi xóa |
| Asana | Gỡ thành viên trong Admin Console | — | Chọn người nhận lại task và dự án |

Rút ra 6 nguyên tắc:

1. Khóa là thao tác chính, xóa là thao tác hiếm.
2. Chuyển quyền sở hữu trước khi xóa.
3. Xóa xong vẫn giữ lại dấu vết.
4. Ghi lại thao tác quản trị cùng các lần đăng nhập thành công và thất bại (OWASP).
5. Admin quản lý tài khoản, không đọc nội dung công việc.
6. Lượt truy cập để hạ tầng lo: Vercel Web Analytics ẩn danh, không gắn với từng user.

## 4. Thiết kế chi tiết

### 4.1 Quản lý tài khoản

**Đợt 1 (FA2, giữ đúng như đã chốt):**
- Danh sách user. Email trả về đã che, nên **chỉ tìm theo họ tên hoặc username**, không tìm theo email.
- Khóa: `is_locked = true`, `token_version + 1`, thu hồi refresh token. Không khóa được `ADMIN`.
- Mở khóa: `is_locked = false`.

**Đợt 2 (task mới):**
- **Đổi vai trò USER ↔ ADMIN.**
  - Khi hạ một `ADMIN` xuống `USER` phải `token_version + 1` và thu hồi mọi refresh token. Nếu không, phiên cũ vẫn giữ quyền admin.
  - Không tự hạ quyền chính mình.
  - Không hạ admin hoạt động cuối cùng. Phép đếm này chạy trong transaction có khóa hàng, để hai admin thao tác cùng lúc không đưa hệ thống về 0 admin.
- **Xóa tài khoản:** chỉ xóa cứng được tài khoản **chưa có dữ liệu** (không khóa ngoại nào ở mục 2 trỏ tới, thường là tài khoản tạo nhầm). Tài khoản đã có dữ liệu thì chỉ khóa, giống cách GitLab và Atlassian khuyên. **Không làm xóa mềm, không thêm migration.**
- **Chuyển chủ dự án:** dùng khi người chủ bị khóa mà dự án vẫn cần chạy tiếp.
  - Chủ mới phải là thành viên đang hoạt động: `removed_at IS NULL`, không bị khóa.
  - Cập nhật cùng lúc `project.owner_id` và `project_member.role`.
  - Dự án chỉ có một người thì không chuyển được, chỉ cho lưu trữ (`ARCHIVED`).
  - Code đặt ở service của admin, không sửa `ProjectService.java`, vì file đó chỉ FC4 được sửa (README dòng 70).
- **Không sửa email** trong admin: email là của người dùng, họ tự đổi trong hồ sơ. Lý do: form sửa đang nạp sẵn email đã che, gửi lại sẽ ghi đè email thật.
- **Không làm "đặt lại mật khẩu bằng mật khẩu tạm".** Admin biết mật khẩu tạm thì đăng nhập được vào tài khoản người khác và xem được nội dung task, trái dòng 79 của đặc tả.
- **Thêm tài khoản: cần nhóm quyết**, xem mục 6.

### 4.2 Thư viện template mẫu (FD3)

- Danh sách trong admin lọc theo `visibility = PUBLIC`, tức chỉ template do admin tạo. Template `PRIVATE` của user không hiện. Đây là sửa lỗi L23.
- Admin tạo, sửa, xóa template mẫu. Dự án đã tạo từ template không bị ảnh hưởng, vì tạo dự án là sao chép template ra.
- Đợt 2 (nếu cần): **ẩn** template khỏi danh mục bằng một cờ riêng. **Không** chuyển template sang `PRIVATE`, vì `PRIVATE` mang nghĩa "template riêng của user", template mẫu bị ẩn sẽ biến mất khỏi màn hình admin.

### 4.3 Nhật ký (FA3, migration `V13` như đã chốt)

- **Ghi:**
  - mọi thao tác ở mục 4.1, 4.2, 4.4;
  - đăng nhập thất bại;
  - lần đăng nhập bị chặn vì tài khoản đang khóa;
  - **đăng nhập thành công của tài khoản ADMIN**;
  - **mọi request bị chặn 403** vào `/api/v1/admin/**`.
- **Mỗi dòng gồm:** thời điểm, ai làm, hành động, đối tượng, kết quả, IP. Không ghi mật khẩu, token hay nội dung task.
- Admin **chỉ xem và lọc**, không sửa hay xóa được nhật ký.
- Lưu ý: khi deploy sau proxy (ví dụ Vercel), cột IP phải lấy từ header của proxy tin cậy, không lấy địa chỉ của chính proxy.

### 4.4 Danh sách dự án (FA2, FD2)

- Bảng gồm: tên, chủ, số thành viên, trạng thái, lần cập nhật cuối. Không có DAG, không có nội dung task.
- Đợt 1 chỉ có thao tác lưu trữ dự án. Đợt 2 thêm chuyển chủ dự án (mục 4.1).
- "Chi tiết workspace" của FD2 chỉ là một ngăn bên hiện số tổng.

### 4.5 Overview (FD1)

- Chỉ hiện số tính được từ DB: user, dự án, task, template. Bỏ biểu đồ lượt truy cập và các ô không tính được, vì lượt truy cập đã có ở Vercel.
- Giữ đúng phạm vi FD1 đã chốt, không làm thêm.

## 5. Ảnh hưởng tới các task đã chia

| Task | Đợt 1 (giữ như đã chốt, điều chỉnh nhỏ) | Đợt 2 |
|---|---|---|
| FA1 | Giữ nguyên, làm trước tiên | — |
| FA2 | Tìm user theo họ tên hoặc username, không tìm theo email | Đổi vai trò, xóa tài khoản chưa có dữ liệu, chuyển chủ dự án |
| FA3 | Thêm 2 sự kiện: admin đăng nhập thành công, request 403 vào API admin | — |
| FD1 | Giữ nguyên | — |
| FD2 | Giữ nguyên | — |
| FD3 | Danh sách admin lọc theo `PUBLIC` | Ẩn template bằng cờ riêng (nếu cần) |

## 6. Cần nhóm quyết

1. **Thêm tài khoản từ admin** (đang hỏi team; thầy chưa nhắc tới). Theo đặc tả, đăng ký là UC1 (người dùng tự đăng ký), còn admin chỉ khóa và mở (UC4). Nếu admin tạo tài khoản kèm mật khẩu tạm thì admin biết mật khẩu đó, nên đăng nhập được vào tài khoản người khác.
   - Đề xuất: **không làm**, người dùng tự đăng ký.
   - Nếu team muốn có "thêm", thì phải bắt đổi mật khẩu ngay lần đăng nhập đầu và ghi việc tạo vào nhật ký. Việc này cần thêm một cột, tức thêm migration.

## Nguồn

- GitLab: [Moderate users](https://docs.gitlab.com/administration/moderate_users/), [Delete users](https://docs.gitlab.com/user/profile/account/delete_account), [Admin area](https://docs.gitlab.com/administration/admin_area)
- Atlassian: [Delete a managed account](https://support.atlassian.com/user-management/docs/delete-a-managed-account/), [Manage your organization's Atlassian accounts](https://confluence.atlassian.com/x/-KdLOQ), [Audit log activities](https://support.atlassian.com/security-and-access-policies/docs/accessing-audit-log-activities/)
- Confluence: [Administering Site Templates](https://confluence.atlassian.com/doc/administering-site-templates-138439.html)
- Google Workspace (bài của bên thứ ba, chưa đối chiếu trang gốc của Google): [Suspend vs delete](https://www.k12mt.com/kb/google-admin-suspend-users-vs-delete-user), [Offboarding](https://promevo.com/blog/google-workspace-offboarding)
- Asana: [User deprovisioning](https://help.asana.com/s/article/user-deprovisioning), [Torii: remove users from Asana](https://www.toriihq.com/articles/how-to-remove-user-asana)
- OWASP: [Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- Vercel: [Web Analytics](https://vercel.com/docs/analytics)
