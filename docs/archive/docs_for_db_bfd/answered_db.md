# Tổng Hợp Quyết Định & Lời Giải Đáp Về Database

---

### 1. Bảng `PROJECT` - Thuộc tính `updated_at` (ĐÃ CHỐT: GIỮ LẠI)
* **Kết luận:** Giữ lại thuộc tính `timestamp updated_at`.
* **Lý do & Tác dụng:**
  1. **Sắp xếp hiển thị (Sorting "Gần đây nhất"):**
     * Trên Dashboard, tính năng phổ biến nhất là sắp xếp dự án theo "Sửa đổi gần nhất" (*Recently Modified*).
     * Nếu không có `updated_at`, hệ thống chỉ có thể sort theo `created_at` (ngày tạo) hoặc phải query tính ngày lớn nhất từ hàng chục bảng con (`NODE`, `WORK_PHASE`), gây chậm hệ thống.
  2. **Kiểm tra đồng bộ dữ liệu (Cache & Polling):**
     * Frontend có thể so sánh `updated_at` để biết dự án có thay đổi mới không trước khi fetch lại toàn bộ dữ liệu lớn.
  3. **Quản lý xung đột (Optimistic Locking):**
     * Nếu 2 người cùng mở trang cài đặt dự án và sửa thông tin (tên, mô tả) cùng lúc, `updated_at` giúp phát hiện và ngăn chặn ghi đè dữ liệu.

---

### 2. Bảng `GUEST_ACCESS_LOG` (ĐÃ CHỐT: XÓA BỎ KHỎI ERD)
* **Kết luận:** Xóa bỏ hoàn toàn bảng `GUEST_ACCESS_LOG` và quan hệ `GUEST_LINK ||--o{ GUEST_ACCESS_LOG`.
* **Lý do & Quyết định của Product Owner:**
  * Không cần thiết theo dõi chi tiết ai "stalk", IP nào, vào xem mấy lần hay vào lúc nào.
  * Nghiệp vụ chỉ cần: Khách có link thì mở ra xem được, và nếu có góp ý thì để lại lời nhắn là đủ.

---

### 3. Quan hệ Cha - Con (`NODE_DEPENDENCY`) & Task Tự Do (Câu 16 & Câu 8, 9, 10, 11) (ĐÃ CHỐT)
* **Kết luận:**
  1. **VẪN GIỮ QUAN HỆ CHA - CON (`NODE_DEPENDENCY`):**
     * Đây là linh hồn của đồ án "Workflow Pipeline Engine" và là yếu tố "ăn điểm" môn OOAD / J2EE (chạy thuật toán Kahn phát hiện vòng lặp, State Machine tự mở khóa, AI tính đường găng / điểm nghẽn).
     * Khớp 100% với giao diện Canvas của FE (đã code sẵn dây nối SVG, pan/zoom).
  2. **CHO PHÉP TASK TỰ DO / ĐỘC LẬP (`phase_id` nullable, không có cha-con):**
     * Dành cho các công việc hành chính, hỗ trợ, phi kỹ thuật (họp nhóm, làm slide thuyết trình, nộp đề cương).
     * Các task này tự động ở trạng thái `TODO` ngay từ đầu (không bị `LOCKED`).
     * **Quy tắc hiển thị (Tối ưu giao diện & đỡ nhọc khi code):**
       * Trên **Workflow Canvas**: Chỉ vẽ các Node nằm trong chuỗi quy trình có cha-con.
       * Trên **My Tasks (Kanban)**: Hiển thị đầy đủ tất cả các task được giao cho user (cả task DAG lẫn task độc lập).
  3. **CƠ CHẾ KHÓA & MỞ KHÓA (LOCK POLICY) - ĐƠN GIẢN HÓA LOGIC BACKEND:**
     * Task có cha chưa xong $\rightarrow$ Trạng thái `LOCKED`.
     * Khi Task cha chuyển sang `DONE` $\rightarrow$ Engine tự động chuyển trạng thái của Task con từ `LOCKED` sang `TODO` (theo luật AND / OR join).
     * **Hỗ trợ "Force Unlock" (Mở khóa cưỡng bức):** Nếu thành viên muốn làm trước bằng mock data, Project Owner có quyền bấm mở khóa trực tiếp. Điều này giúp backend không phải code cả đống trường hợp ngoại lệ lắt léo.

---

### 4. Bảng `PROJECT` - Thuộc tính `completed_at` (Câu 2) (ĐÃ CHỐT: KHÔNG THÊM)
* **Kết luận:** **KHÔNG BỔ SUNG** trường `completed_at` vào bảng `PROJECT`.
* **Lý do thực tế & Giao diện:**
  * Trên giao diện Overview và Workspace (`workspace.types.ts`), dự án chỉ quản lý qua 4 trạng thái: `DRAFT`, `ACTIVE`, `INACTIVE`, `ARCHIVED` (không có trạng thái `COMPLETED`).
  * Giao diện chỉ hiển thị `% hoàn thành` (`completionPercent = done / total`) và ngày sửa gần nhất (`updated_at`), hoàn toàn không có chỗ nào hiển thị `completed_at`.
  * Không thêm để tránh thừa thãi cột trong CSDL.

---

### 5. Phân tích AI (`PROJECT_AI_ANALYSIS`) (Câu 7) (ĐÃ CHỐT: PHƯƠNG ÁN B - DÙNG CỘT JSONB)
* **Kết luận:** **XÓA BỎ BẢNG `PROJECT_AI_ANALYSIS`**. Chuyển thành một cột `jsonb latest_ai_analysis` nằm trực tiếp trong bảng `PROJECT`.
* **Lý do & Tối ưu khi code:**
  * Giao diện Overview có nút bấm chạy AI để xem chẩn đoán hiện tại (nút thắt cổ chai, rủi ro), người dùng chỉ quan tâm kết quả mới nhất chứ không xem lịch sử các lần chạy trước.
  * Khi AI Worker quét xong, nó ghi đè trực tiếp kết quả mới nhất vào cột `latest_ai_analysis`.
  * **Lợi ích lớn:** Giảm hẳn 1 bảng trong Database, bớt được 1 Entity JPA, 1 Repository và 1 Service trong Spring Boot, đỡ nhọc công code rất nhiều.
* **Cấu trúc JSONB `latest_ai_analysis` của bảng `PROJECT`:** Cột này lưu trữ toàn bộ kết quả phân tích mới nhất của AI (bao gồm: các điểm nghẽn CPM, task bẫy, rủi ro kiến trúc và lời khuyên). Worker AI khi quét xong sẽ ghi đè trực tiếp vào cột này.

---

### 6. Bảng `PROJECT_INVITATION` - Quy Trình Mời Thành Viên Bất Đồng Bộ & Deep-Link (Câu 4) (ĐÃ CHỐT: TÁI THIẾT LẬP BẢNG)
* **Kết luận:** **TÁI THIẾT LẬP BẢNG `PROJECT_INVITATION`** (Bãi bỏ hoàn toàn cơ chế Direct Add không có xác nhận từ người dùng).
* **Cấu trúc bảng:**
  * `id`: bigint PK
  * `project_id`: bigint FK (liên kết đến `PROJECT`, ON DELETE CASCADE)
  * `inviter_id`: bigint FK (liên kết đến `USERS.id`, người gửi lời mời)
  * `invitee_id`: bigint FK (liên kết đến `USERS.id`, người được mời tham gia)
  * `role`: varchar(20) NOT NULL DEFAULT 'MEMBER' ('COLLABORATOR' hoặc 'VIEWER')
  * `status`: varchar(20) NOT NULL DEFAULT 'PENDING' (`PENDING`, `ACCEPTED`, `REJECTED`, `REVOKED`, `EXPIRED`)
  * `created_at`: timestamptz DEFAULT CURRENT_TIMESTAMP
  * `responded_at`: timestamptz NULLABLE (thời điểm người dùng bấm Chấp nhận / Từ chối)
  * `expires_at`: timestamptz NOT NULL (hạn chót phản hồi lời mời, mặc định 7 ngày)
  * `version`: bigint NOT NULL DEFAULT 0 (Khóa lạc quan `@Version` chống Race Condition khi Owner thu hồi đồng thời với Invitee chấp thuận)
  * **Ràng buộc:** `CONSTRAINT uq_pending_project_invitation UNIQUE (project_id, invitee_id, status)` (chống spam nhiều lời mời cùng lúc khi đang PENDING).
  * **Chỉ mục:** `CREATE INDEX idx_invitation_invitee_status ON project_invitation(invitee_id, status);`
* **Quy trình Mời Thành viên Chuẩn Kiến trúc:**
  1. Chủ dự án/Admin gửi lời mời: Hệ thống tạo bản ghi `PROJECT_INVITATION` (`status = PENDING`).
  2. Bắn sự kiện `InvitationCreatedEvent` vào RabbitMQ -> Consumer đẩy chuông thông báo `NOTIFICATION` với deep-link: `/workspace?action=open-invite-modal&invitationId={id}` và stream thời gian thực qua SSE (`SseEmitterService`).
  3. Người được mời click thông báo -> Trình duyệt kích hoạt Popup Modal xác nhận (Accept / Decline) mà không reload trang.
  4. Khi Accept: Giao dịch nguyên tử (Atomic `@Transactional`) kiểm tra hạn dùng, chuyển `status = ACCEPTED`, cập nhật `responded_at = NOW()`, đồng thời thêm bản ghi chính thức vào `PROJECT_MEMBER`.
  5. Bảo mật RBAC: Người dùng có lời mời `PENDING` tuyệt đối không được truy cập tài nguyên dự án cho đến khi chấp nhận.

---

### 7. Phản Hồi Khách & Dự Án - Đổi Tên Thành `PROJECT_FEEDBACK` (Câu 15) (ĐÃ CHỐT)
* **Kết luận:** **ĐỔI TÊN BẢNG `NODE_FEEDBACK` THÀNH `PROJECT_FEEDBACK`**.
* **Cấu trúc bảng:**
  * `id`: bigint PK
  * `project_id`: bigint FK (liên kết đến `PROJECT`)
  * `node_id`: bigint FK (cho phép `NULL`)
  * `reviewer_name`: varchar
  * `reviewer_role`: varchar ('TEACHER' hoặc 'GUEST')
  * `content`: text
  * `status`: varchar ('OPEN' hoặc 'RESOLVED')
  * `created_at`: timestamp
* **Quy tắc Feedback 1 chiều:** Phản hồi từ TEACHER/GUEST là luồng tiếp thu 1 chiều, nhóm thực thi chỉ đọc và chuyển trạng thái OPEN -> RESOLVED, tuyệt đối không có cơ chế tranh luận hoặc trả lời lại (không có cột `reply_content`).
* **Lý do & Tối ưu:**
  * Phù hợp 100% với giao diện **Feedback Queue** trên màn hình **Overview** của Frontend.
  * Việc để `node_id` cho phép `NULL` giúp hỗ trợ cả 2 nghiệp vụ: vừa có thể góp ý chung cho toàn dự án (`node_id = NULL`), vừa có thể chỉ định góp ý vào 1 task cụ thể.

---

### 8. Bảng `GUEST_LINK` - Cơ Chế Token Chia Sẻ Cho Khách (Câu 6) (ĐÃ CHỐT: DÙNG BẢNG RIÊNG)
* **Kết luận:** **GIỮ BẢNG RIÊNG `GUEST_LINK`** (Cách 1).
* **Cấu trúc bảng:**
  * `id`: bigint PK
  * `project_id`: bigint FK (liên kết đến `PROJECT`)
  * `token`: varchar(255) UNIQUE (chuỗi mã token chia sẻ ngẫu nhiên)
  * `is_revoked`: boolean DEFAULT FALSE (cờ thu hồi link)
  * `expires_at`: timestamp (thời điểm hết hạn link)
  * `created_at`: timestamp
* **Lý do & Tối ưu kỹ thuật:**
  * Khách truy cập từ đường link ngoài `app.com/share/:token`, Backend Spring Boot chỉ cần dùng Spring Data JPA: `findByToken(token)` là tìm ra ngay Dự án trong 1 mili-giây.
  * Tránh việc phải viết Native Query phức tạp để tìm kiếm bên trong JSONB của PostgreSQL.
  * Cho phép linh hoạt tạo nhiều link khác nhau (link cho thầy hướng dẫn, link cho thầy phản biện) mà không sợ bị đè mất token.

---

### 9. Bảng `WORK_PHASE` - Tinh Chỉnh Giai Đoạn Dự Án (Câu 5) (ĐÃ CHỐT)
* **Kết luận:** Giữ bảng `WORK_PHASE` nhưng tinh gọn triệt để.
* **Những điều chỉnh cụ thể:**
  1. **BỎ CỘT `code` (1, 2a, 2b...):** Thay bằng `order_index: int DEFAULT 0` để lưu thứ tự. Frontend tự động đánh số thứ tự liền mạch hiển thị ra giao diện dựa trên `order_index`. Xóa hay thêm phase ở giữa không bao giờ bị lệch dữ liệu.
  2. **BỎ CỘT `gate_info` (PR link, swagger):** Xóa bỏ hoàn toàn vì tài liệu nộp nằm ở từng Task (`ARTIFACTS`) hoặc link chung của `PROJECT`, không gắn cứng vào Phase.
  3. **GIỮ `sub_title` và `accent_color`:** Giúp Frontend vẽ thẻ Macro Phase Card có màu sắc và mô tả phụ trực quan.
* **Cấu trúc bảng chốt lại:**
  * `id`: bigint PK
  * `project_id`: bigint FK (liên kết đến `PROJECT`)
  * `parent_phase_id`: bigint FK (cho phép `NULL`, dùng nếu muốn nối dây giữa Phase trước $\rightarrow$ Phase sau trên Macro Canvas)
  * `name`: varchar (Tên Phase)
  * `sub_title`: varchar (Tiêu đề phụ)
  * `accent_color`: varchar (Màu sắc hiển thị: emerald, blue, slate...)
  * `order_index`: int DEFAULT 0 (Thứ tự sắp xếp)
  * `created_at`: timestamp

---

### 10. Bảng `NODE` - Vận Hành Task & Optimistic Locking (Câu 12) (ĐÃ CHỐT)
* **Kết luận:**
  1. **BỎ CỘT `current_round`:** Không chia vòng 1, 2. Thay bằng cột **`reject_reason: text (nullable)`** — khi Owner từ chối nghiệm thu ở bước `In Review`, bắt buộc nhập lý do vào đây và task quay về `In Progress` để người làm sửa lại.
  2. **GIỮ CỘT `ui_metadata: jsonb`:** Lưu tọa độ x, y, width, height, màu sắc để vẽ Node trên Workflow Canvas.
  3. **GIỮ CỘT `version: bigint DEFAULT 0`:** Dùng cho JPA `@Version` (Optimistic Locking - Khóa lạc quan), chống xung đột dữ liệu khi nhiều người cùng thao tác trên 1 task.

---

### 11. Bảng `ARTIFACTS` & Kho Chung Tài Liệu Dự Án (Câu 14) (ĐÃ CHỐT)
* **Quy tắc nghiệp vụ thống nhất:**
  1. **Chỉ lưu đường dẫn liên kết (URL Link):** Tuyệt đối không upload file vật lý (tránh phải dựng server lưu trữ như Google Drive, tốn dung lượng và phức tạp). Người dùng chỉ nộp/lưu các liên kết đến tài nguyên bên ngoài: GitHub PR, Figma, Swagger, Google Docs, Loom/Demo video.
  2. **Khi nộp Task:** Nếu Leader không duyệt (Reject) $\rightarrow$ Artifact đó bị loại bỏ, không cần lưu lịch sử rác trong DB. Bỏ các cột `round_no`, `version` rườm rà.
  3. **Nghiệp vụ Kho chung tài liệu (Project Artifact Hub):** Hỗ trợ 2 luồng:
     * *Luồng 1:* Task sau khi hoàn thành có nút *"Thêm vào kho chung"* và đổi tên hiển thị.
     * *Luồng 2:* Quản lý trực tiếp từ giao diện Kho chung (thêm, xóa, sửa, đổi tên các link Figma/Swagger/PR/Docs độc lập không gắn vào task nào).
  4. **Tính chất nộp Artifact:** Nộp Artifact khi hoàn thành task là TÙY CHỌN (Optional). Thành viên có thể chuyển task sang In Review mà không bắt buộc phải đính kèm liên kết.
* **Cấu trúc bảng `ARTIFACTS` chuẩn hóa:**
  * `id`: bigint PK
  * `project_id`: bigint FK (liên kết đến `PROJECT`)
  * `node_id`: bigint FK (cho phép `NULL` — nếu tạo trực tiếp từ Kho chung thì `node_id = NULL`; nếu nộp theo task thì trỏ đến task đó)
  * `uploaded_by`: bigint FK (người tải lên)
  * `name`: varchar (tên hiển thị, vd: "Bản thiết kế Figma", "Swagger API")
  * `type`: varchar ('PR', 'FIGMA', 'DOCS', 'SWAGGER', 'OTHER_LINK')
  * `url`: varchar(500) (đường link tài nguyên)
  * `is_in_repository`: boolean DEFAULT FALSE (cờ đánh dấu có hiển thị ở Kho chung dự án không)
  * `is_public_for_guest`: boolean DEFAULT TRUE (cho phép khách xem qua guest link)
  * `created_at`: timestamp

---

### 12. Bảng `NOTIFICATION` - Thông Báo Cá Nhân Quả Chuông (Câu 3) (ĐÃ CHỐT: GIỮ BẢNG)
* **Kết luận:** **GIỮ BẢNG `NOTIFICATION`**.
* **Mục đích sử dụng:**
  * Lưu thông báo cá nhân phục vụ icon Quả Chuông (Notification Bell) trên thanh Topbar.
  * Tự động sinh thông báo khi:
    1. Một task mới được Engine mở khóa: *"Task X của bạn đã sẵn sàng làm việc"*.
    2. Owner duyệt hoặc từ chối task: *"Owner đã duyệt task Y của bạn"* / *"Owner yêu cầu sửa lại task Y: [Lý do]"*.
    3. Được thêm vào dự án mới: *"Bạn đã được thêm vào dự án Z với vai trò Collaborator"*.
    4. Cảnh báo quá hạn: *"Task W của bạn đã bị trễ hạn"*.
* **Cấu trúc bảng:**
  * `id`: bigint PK
  * `user_id`: bigint FK (liên kết đến `USERS`)
  * `title`: varchar
  * `message`: text (cho phép `NULL`)
  * `link_url`: varchar (đường dẫn điều hướng khi click)
  * `is_read`: boolean DEFAULT FALSE
  * `created_at`: timestamp

---
*(ĐÃ HOÀN TẤT THẢO LUẬN VÀ CHỐT 100% CÁC CÂU HỎI TRONG QUESTION_ABOUT_DB.MD)*
