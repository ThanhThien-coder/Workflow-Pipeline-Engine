# System Overview & RBAC Specification (SSOT)

> **Dự án**: Workflow-Pipeline-Engine  
> **Tài liệu**: Single Source of Truth (SSOT) — Đặc tả Phân hệ & Ma trận Phân quyền RBAC  
> **Công nghệ áp dụng**: React 18 (TypeScript, Tailwind CSS, Zustand) + Spring Boot 3 (Spring Security, Spring Data JPA, PostgreSQL)

---

## 1. Tầm nhìn & Mục tiêu Nghiệp vụ

**Workflow-Pipeline-Engine** là nền tảng quản lý, thiết kế và điều phối dự án dựa trên mô hình **Đồ thị có hướng không chu trình (DAG - Directed Acyclic Graph)** và **Máy trạng thái hữu hạn (FSM - Finite State Machine)**:
* **Tự động hóa luồng phụ thuộc**: Động cơ máy trạng thái ngầm tự động thẩm định điều kiện hội tụ (AND-join / OR-join) và mở khóa các tác vụ kế tiếp khi tác vụ tiền nhiệm hoàn tất.
* **Cổng nghiệm thu nghiêm ngặt (Strict RBAC Review Gate)**: Kiểm soát chặt chẽ quy trình nộp và nghiệm thu sản phẩm bàn giao, chỉ cho phép Chủ dự án (Project Owner) duyệt hoàn thành hoặc yêu cầu làm lại kèm lý do bắt buộc.
* **Mô hình giao việc tức thì (Direct Push Model)**: Tác vụ sau khi mở khóa sẽ tự động xuất hiện trên bảng Kanban cá nhân hóa của người được phân công (`assignedUserId === currentUserId`), loại bỏ hoàn toàn các bước nhận việc rườm rà.
* **Trợ lý chẩn đoán thông minh (AI Diagnostics Engine)**: Tích hợp Google Gemini AI chạy ngầm phân tích cấu trúc đồ thị, tính toán đường găng (CPM), phát hiện điểm nghẽn và đưa ra cảnh báo sớm.

---

## 2. Kiến trúc 5 Phân hệ Cốt lõi (Bounded Contexts)

Hệ thống được tổ chức thành 5 phân hệ chức năng độc lập theo ranh giới nghiệp vụ (Bounded Contexts) và đồng bộ với hệ thống điều hướng:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                      HỆ THỐNG WORKFLOW-PIPELINE-ENGINE                 │
├────────────────────┬────────────────────┬──────────────────────────────┤
│ 1. Auth Gateway    │ 2. Project         │ 3. Execution Engine          │
│    (Xác thực &     │    Workspace       │    (Điều phối FSM,           │
│    Tài khoản)      │    (DAG Designer & │    My Tasks & Nghiệm thu)    │
│                    │    Dual-View)      │                              │
├────────────────────┴────────────────────┴──────────────────────────────┤
│ 4. Overview & Review Portal             │ 5. Admin Portal              │
│    (KPI Metrics, Guest Link,            │    (Quản trị User, CRUD      │
│    Feedback 1 chiều, AI Diagnostics)    │    System Template Studio)   │
└────────────────────────────────────────────────────────────────────────┘
```

### Phân hệ 1: Xác thực & Tài khoản (Auth Gateway)
* **Vai trò**: Cổng kiểm soát bảo mật, cấp quyền và quản lý danh tính người dùng.
* **Chức năng chính**:
  1. *Đăng ký tài khoản*: Khởi tạo thông tin người dùng mới với mật khẩu mã hóa BCrypt.
  2. *Đăng nhập & Cấp phát JWT*: Xác thực định danh, trả về Access Token (JWT ngắn hạn) và thiết lập Refresh Token (dài hạn).
  3. *Cơ chế xoay vòng Refresh Token (Token Rotation)*: Lưu vết tại bảng `REFRESH_TOKEN`, chống tấn công phát lại.
  4. *Quản lý hồ sơ & Thu hồi phiên tức thì*: Cập nhật thông tin cá nhân, đổi mật khẩu; hỗ trợ tăng `token_version` để thu hồi tức thời toàn bộ phiên đăng nhập trên các thiết bị khác khi có biến cố bảo mật.

### Phân hệ 2: Dự án & Thiết kế Quy trình DAG (Project Workspace)
* **Vai trò**: Không gian trực quan để khởi tạo, tổ chức thành viên và thiết kế cấu trúc quy trình công việc.
* **Chức năng chính**:
  1. *Khởi tạo dự án & Clone Template*: Tạo dự án mới từ đầu hoặc sao chép sâu toàn bộ cấu trúc quy trình từ kho mẫu chuẩn (`PIPELINE_TEMPLATE`).
  2. *Quy trình mời thành viên bất đồng bộ (Invitation Flow)*: Chủ dự án tạo lời mời (`PROJECT_INVITATION`), hệ thống phát `InvitationCreatedEvent` đẩy thông báo `NOTIFICATION` kèm deep-link `/workspace?action=open-invite-modal&invitationId={id}` và stream SSE thời gian thực. Người được mời nhận popup modal xác nhận Chấp nhận (Accept) / Từ chối (Decline). Khi chấp nhận, giao dịch nguyên tử tạo `PROJECT_MEMBER` và chuyển trạng thái lời mời sang `ACCEPTED`.
  3. *Quản lý quyền thành viên*: Gán các vai trò dự án (`OWNER`, `COLLABORATOR`, `VIEWER`) hoặc loại bỏ thành viên (Soft Remove bằng `removed_at`).
  4. *Giao diện thiết kế Dual-View (Phase Graph / Kanban)*: Chuyển đổi linh hoạt giữa giao diện đồ thị nối dây SVG (Bézier curve) và bảng Kanban phân theo giai đoạn vĩ mô (`WORK_PHASE`).
  5. *Thẩm định đồ thị DAG (Thuật toán Kahn)*: Giải thuật kiểm tra tính chu trình lặp (Cycle Detection) nhằm ngăn ngừa tình trạng bế tắc (Deadlock) trước khi xuất bản dự án.

### Phân hệ 3: Điều phối Thực thi & Nghiệm thu Tác vụ (Execution Engine)
* **Vai trò**: Trái tim điều phối runtime của hệ thống, quản lý vòng đời trạng thái của từng Task.
* **Chức năng chính**:
  1. *Động cơ tự mở khóa (AND-join / OR-join)*: Tự động tính toán phụ thuộc từ bảng `NODE_DEPENDENCY`. Khi task cha đạt `DONE`, tự động chuyển trạng thái task con từ `LOCKED` sang `TODO`.
  2. *Bảng Kanban cá nhân hóa (My Tasks - Direct Push Model)*: Hiển thị 4 cột chuẩn (`TODO`, `IN_PROGRESS`, `REVIEW`, `DONE`) lọc chính xác theo `assignedUserId === currentUserId`.
  3. *Bàn giao kết quả & Đính kèm Artifact*: Chuyển trạng thái từ `IN_PROGRESS` sang `REVIEW`. Việc đính kèm liên kết ngoài (GitHub PR, Figma, Swagger, Docs) là **tùy chọn (Optional)**.
  4. *Cổng phê duyệt nghiêm ngặt (Strict Review Gate)*: Chỉ tài khoản có vai trò `OWNER` mới có quyền duyệt từ `REVIEW` sang `DONE`. Khi từ chối, bắt buộc nhập lý do vào `reject_reason` để trả về `IN_PROGRESS`.
  5. *Cảnh báo trễ hạn & Điều phối*: Background Worker quét định kỳ, tự động đánh dấu `is_overdue = TRUE` khi vượt quá `due_date`, cho phép gia hạn hoặc gán lại người thực hiện.
  6. *Khóa lạc quan (Optimistic Locking)*: Quản lý thuộc tính `version` trên entity `Node` nhằm loại trừ nguy cơ ghi đè dữ liệu khi nhiều thành viên cùng thao tác đồng thời.

### Phân hệ 4: Cổng Đánh giá & AI Chẩn đoán (Overview & Review Portal)
* **Vai trò**: Cung cấp bức tranh toàn cảnh về tiến độ, cổng chia sẻ bảo mật cho chuyên gia ngoài và phân tích AI.
* **Chức năng chính**:
  1. *Dashboard Số liệu & KPI*: Hiển thị tỷ lệ hoàn thành (`completionRate`), số lượng nút trên đường găng (`criticalPathNodes`), biểu đồ vận tốc tuần (Weekly Velocity) và phân bổ trạng thái (Status Breakdown).
  2. *Cổng chia sẻ cho khách ngoài (Public Audit & Share Gateway via `GUEST_LINK`)*: Sinh chuỗi Token ngẫu nhiên có thời hạn (`expires_at`), hỗ trợ thu hồi tức thì (`is_revoked`) để Giáo viên/Khách ngoài truy cập trực tiếp xem tiến độ mà không cần tài khoản.
  3. *Hàng đợi phản hồi 1 chiều (Feedback Queue)*: Tiếp nhận góp ý từ `TEACHER` hoặc `GUEST` gắn theo từng Task (`node_id`) hoặc toàn dự án. **Quy tắc tiếp thu 1 chiều**: Nhóm thực thi tiếp thu và bấm chuyển `OPEN` sang `RESOLVED`, **tuyệt đối không có cơ chế tranh luận/phản hồi ngược lại**.
  4. *Chẩn đoán điểm nghẽn bằng AI (Gemini Worker)*: Chạy ngầm thu thập cấu trúc đồ thị, tính toán đường găng CPM, phát hiện task bẫy, dự báo trễ hạn và ghi đè kết quả vào `PROJECT.latest_ai_analysis` (JSONB).

### Phân hệ 5: Quản trị Nền tảng (Admin Portal)
* **Vai trò**: Quản trị tài nguyên hệ thống và cung cấp công cụ xây dựng quy trình mẫu tiêu chuẩn.
* **Chức năng chính**:
  1. *Quản lý người dùng*: Khóa hoặc mở khóa quyền truy cập của người dùng trên toàn hệ thống.
  2. *System Template Studio*: Thiết kế mẫu quy trình chuẩn 2 tầng (Tầng Macro `Phase` và Tầng Detail `Node`) với các danh mục chuyên biệt (Software Engineering, DevOps, Marketing...).
  3. *Giám sát hạ tầng & Dọn dẹp dự án rác*: Cảnh báo trước 7 ngày và chuyển các dự án không hoạt động sang trạng thái lưu trữ (`ARCHIVED`).
  4. *Nguyên tắc bảo mật dữ liệu*: Quản trị viên chỉ quản lý metadata cấp cao, **tuyệt đối không được phép xem nội dung chi tiết của các Task và tài nguyên nội bộ dự án** nếu không có quyền tham gia dự án.

---

## 3. Danh sách Tác nhân (Actors) & Mô hình Kế thừa

### 3.1 Danh sách Tác nhân Con người (Human Actors)
1. **Quản trị viên Hệ thống (System Admin)**: Quản trị toàn hệ thống, tài khoản và kho mẫu chung. Có thẩm quyền cao nhất ở cấp độ nền tảng nhưng độc lập với dữ liệu dự án.
2. **Chủ dự án (Project Owner / Lead)**: Người khởi tạo dự án, nắm toàn quyền thiết kế đồ thị DAG, mời thành viên, nghiệm thu kết quả bàn giao và sinh Guest Link.
3. **Quản lý Dự án (Project Manager)**: Thành viên được Chủ dự án ủy quyền duyệt task, đổi người làm/hạn chót, đánh dấu góp ý; không có quyền quản trị dự án.
4. **Cộng sự Thực thi (Collaborator / Member)**: Thành viên tham gia làm việc, nhận việc trên My Tasks, thực hiện công việc, nộp bài kèm link Artifact và tiếp thu phản hồi tại Feedback Queue.
5. **Người xem Nội bộ (Project Viewer)**: Thành viên thuộc dự án được cấp quyền chỉ đọc (Read-only) đồ thị, xem danh mục Artifact và Dashboard thống kê.
6. **Giáo viên / Khách ngoài (Guest via Token)**: Chuyên gia hoặc giáo viên truy cập qua liên kết tạm thời mang Token, xem tiến độ trực quan, để lại phản hồi 1 chiều và xem báo cáo AI.
7. **Người dùng Vãng lai (Anonymous User)**: Người chưa đăng nhập, chỉ có thể xem trang giới thiệu, đăng ký và đăng nhập vào hệ thống.

### 3.2 Tác nhân Hệ thống (System Actors)
* **Authentication Service**: Xác thực mật khẩu BCrypt, cấp phát JWT và kiểm soát phiên với `REFRESH_TOKEN`.
* **Execution State Engine**: Bộ máy giám sát sự kiện trạng thái, tính toán bậc vào (in-degree) và kích hoạt mở khóa downstream tasks.
* **AI Background Worker**: Tiến trình nền kết nối Google Gemini API phân tích log, tính đường găng CPM và xuất bản chẩn đoán vào `PROJECT.latest_ai_analysis`.
* **Notification Service**: Bộ phận đẩy chuông thông báo cá nhân `NOTIFICATION` khi task mở khóa, có kết quả duyệt bài hoặc bị cảnh báo trễ hạn.
* **Resource Link Service**: Quản trị liên kết tài nguyên ngoài (Figma, PR, Swagger, Docs), **tuyệt đối không lưu trữ file vật lý trên máy chủ**.

### 3.3 Sơ đồ Kế thừa Quyền hạn (Role Inheritance)

```text
[Anonymous User] ──── (Đăng nhập thành công) ────> [Project Viewer]
                                                           │
                                                           ▼ (Kế thừa quyền đọc)
                                                [Collaborator / Member]
                                                           │
                                                           ▼ (Kế thừa toàn quyền thực thi)
                                                   [Project Owner]

[System Admin]    ─── (Luồng quản trị nền tảng: Quản lý User & Template Studio)
[Guest via Token] ─── (Luồng khách ngoài: Truy cập qua URL Token, xem đồ thị & gửi góp ý 1 chiều)
```

---

## 4. Ma trận Phân quyền Use Case (RBAC Matrix)

Dưới đây là ma trận phân quyền chi tiết cho toàn bộ 23 chức năng cốt lõi của hệ thống:

| STT | Use Case / Chức năng Nghiệp vụ | Anonymous | System Admin | Guest (Token) | Project Viewer | Collaborator | Project Manager | Project Owner |
| :-: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **UC1** | Đăng ký tài khoản mới | ✅ | - | - | - | - | - | - |
| **UC2** | Đăng nhập & Nhận Access Token / Refresh Token | ✅ | - | - | - | - | - | - |
| **UC3** | Xem & Cập nhật Hồ sơ cá nhân (Profile) | - | ✅ | - | ✅ | ✅ | ✅ | ✅ |
| **UC4** | Quản lý User & Khóa/Mở tài khoản | - | ✅ | - | - | - | - | - |
| **UC5** | CRUD Mẫu quy trình chuẩn (System Template Studio) | - | ✅ | - | - | - | - | - |
| **UC6** | Giám sát hạ tầng & Chuyển Archive dự án rác | - | ✅ | - | - | - | - | - |
| **UC7** | Khởi tạo Dự án mới & Clone Template | - | - | - | - | - | - | ✅ |
| **UC8** | Mời thành viên tham gia (Invitation Flow) & Gán Role | - | - | - | - | - | - | ✅ |
| **UC9** | Điều chỉnh vai trò thành viên / Loại bỏ (Soft Remove) | - | - | - | - | - | - | ✅ |
| **UC10** | Thiết kế, chỉnh sửa & Lưu tọa độ đồ thị DAG Canvas | - | - | - | - | - | - | ✅ |
| **UC11** | Chạy kiểm tra chu trình đồ thị (Kahn DAG Algorithm) | - | - | - | - | - | - | ✅ |
| **UC12** | Sinh mới & Thu hồi Token chia sẻ (`GUEST_LINK`) | - | - | - | - | - | - | ✅ |
| **UC13** | Phê duyệt bài (`REVIEW` ➔ `DONE`) hoặc Trả lại kèm lý do | - | - | - | - | - | ✅ | ✅ |
| **UC14** | Gia hạn Deadline / Điều chuyển người phụ trách Node | - | - | - | - | - | ✅ | ✅ |
| **UC15** | Xem bảng My Tasks cá nhân (`assignedUserId === me`) | - | - | - | - | ✅ | ✅ | ✅ |
| **UC16** | Chuyển trạng thái bắt đầu làm (`TODO` ➔ `IN_PROGRESS`) | - | - | - | - | ✅ | ✅ | ✅ |
| **UC17** | Hủy nhận việc (`IN_PROGRESS` ➔ `TODO`) | - | - | - | - | ✅ | ✅ | ✅ |
| **UC18** | Nộp bài (`IN_PROGRESS` ➔ `REVIEW`) kèm link Artifact | - | - | - | - | ✅ | ✅ | ✅ |
| **UC19** | Xem đồ thị tiến độ DAG & Kho tài nguyên Artifacts | - | - | ✅ | ✅ | ✅ | ✅ | ✅ |
| **UC20** | Xem Dashboard chỉ số & KPI dự án (Overview Screen) | - | - | ✅ | ✅ | ✅ | ✅ | ✅ |
| **UC21** | Xem báo cáo chẩn đoán sự cố & Đường găng AI | - | - | ✅ | ✅ | ✅ | ✅ | ✅ |
| **UC22** | Gửi phản hồi / Nhận xét 1 chiều trên Node hoặc Dự án | - | - | ✅ *(Gửi mới)* | - | - | - | - |
| **UC23** | Xem danh sách & Đánh dấu RESOLVED Feedback Queue | - | - | - | - | - *(chỉ xem)* | ✅ | ✅ |

---

## 5. Quy tắc Vận hành Phiên & Nguyên tắc Bảo mật

> [!IMPORTANT]
> 1. **Kiểm soát Truy cập Phân cấp chặt chẽ**:
>    - Spring Boot Backend chịu trách nhiệm thẩm định an ninh cuối cùng thông qua `@PreAuthorize` và các Custom Security Evaluators (`ProjectSecurityService.isOwner(...)`). Frontend Route Guards chỉ phục vụ nâng cao trải nghiệm người dùng (UX).
> 2. **Bảo mật Guest Link Token**:
>    - Mỗi đường dẫn chia sẻ cho khách mang một chuỗi token ngẫu nhiên bảo mật cao (độ dài 64+ ký tự).
>    - Bắt buộc kiểm tra tính hợp lệ qua 3 tiêu chí: `is_revoked = FALSE`, `expires_at > NOW()`, và dự án có trạng thái `ACTIVE`.
>    - Khách chỉ được đọc các tài nguyên có cờ `is_public_for_guest = TRUE`.
> 3. **Thu hồi Quyền tức thì (Immediate Session Revocation)**:
>    - Khi tài khoản bị Admin khóa (`is_locked = TRUE`), hoặc khi đổi mật khẩu, hệ thống tăng `token_version`. Toàn bộ Access Token mang `token_version` cũ sẽ bị JWT Filter từ chối ngay lập tức mà không cần chờ hết hạn thời gian sống.
