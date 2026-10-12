# TÀI LIỆU ĐẶC TẢ KIẾN TRÚC VÀ YÊU CẦU HỆ THỐNG (SSOT)
## DỰ ÁN: WORKFLOW PIPELINE ENGINE

> [!NOTE]
> **Tài liệu chuẩn hóa (Single Source of Truth - SSOT):** Phục vụ nạp Context dự án cho Claude Code / AI Coding Assistants và làm tài liệu kỹ thuật chính thức của dự án.
>
> * **Kiến trúc dữ liệu:** PostgreSQL chuẩn hóa 3NF (12 Bảng).
> * **Mô hình điều phối:** Directed Acyclic Graph (DAG) & Finite State Machine (FSM).
> * **Mô hình phân công:** Direct Push Model (Kanban My Tasks).

---

## MỤC LỤC
- [PHẦN 1: TỔNG QUAN HỆ THỐNG VÀ BỐI CẢNH KIẾN TRÚC](#phần-1-tổng-quan-hệ-thống-và-bối-cảnh-kiến-trúc)
  - [1.1 Mục tiêu và Tầm nhìn Nghiệp vụ](#11-mục-tiêu-và-tầm-nhìn-nghiệp-vụ)
  - [1.2 Cấu trúc 5 Phân hệ Nghiệp vụ (Bounded Contexts)](#12-cấu-trúc-5-phân-hệ-nghiệp-vụ-bounded-contexts)
- [PHẦN 2: CÂY PHÂN RÃ CHỨC NĂNG HỆ THỐNG (FUNCTIONAL DECOMPOSITION)](#phần-2-cây-phân-rã-chức-năng-hệ-thống-functional-decomposition)
- [PHẦN 3: TÁC NHÂN (ACTORS), MỐI QUAN HỆ VÀ MA TRẬN PHÂN QUYỀN (RBAC)](#phần-3-tác-nhân-actors-mối-quan-hệ-và-ma-trận-phân-quyền-rbac)
  - [3.1 Danh sách Tác nhân (Actors)](#31-danh-sách-tác-nhân-actors)
  - [3.2 Quan hệ Kế thừa Quyền giữa các Tác nhân](#32-quan-hệ-kế-thừa-quyền-giữa-các-tác-nhân)
  - [3.3 Ma trận Phân quyền Use Case (RBAC Matrix)](#33-ma-trận-phân-quyền-use-case-rbac-matrix)
  - [3.4 Nguyên tắc Bảo mật và Vận hành Phiên làm việc](#34-nguyên-tắc-bảo-mật-và-vận-hành-phiên-làm-việc)
- [PHẦN 4: ĐẶC TẢ CƠ SỞ DỮ LIỆU POSTGRESQL (DATA DICTIONARY - 12 BẢNG)](#phần-4-đặc-tả-cơ-sở-dữ-liệu-postgresql-data-dictionary---12-bảng)
  - [4.1 Bảng USERS](#41-bảng-users)
  - [4.2 Bảng REFRESH_TOKEN](#42-bảng-refresh_token)
  - [4.3 Bảng PROJECT](#43-bảng-project)
  - [4.4 Bảng PROJECT_MEMBER](#44-bảng-project_member)
  - [4.5 Bảng PIPELINE_TEMPLATE](#45-bảng-pipeline_template)
  - [4.6 Bảng WORK_PHASE](#46-bảng-work_phase)
  - [4.7 Bảng NODE](#47-bảng-node)
  - [4.8 Bảng NODE_DEPENDENCY](#48-bảng-node_dependency)
  - [4.9 Bảng ARTIFACTS](#49-bảng-artifacts)
  - [4.10 Bảng PROJECT_FEEDBACK](#410-bảng-project_feedback)
  - [4.11 Bảng GUEST_LINK](#411-bảng-guest_link)
  - [4.12 Bảng NOTIFICATION](#412-bảng-notification)
- [PHẦN 5: ĐẶC TẢ MÁY TRẠNG THÁI VÀ ENGINE ĐIỀU PHỐI (STATE MACHINE)](#phần-5-đặc-tả-máy-trạng-thái-và-engine-điều-phối-state-machine)
  - [5.1 Vòng đời Trạng thái của Node](#51-vòng-đời-trạng-thái-của-node)
  - [5.2 Quy tắc Nghiệp vụ Điều phối và Chuyển đổi Trạng thái](#52-quy-tắc-nghiệp-vụ-điều-phối-và-chuyển-đổi-trạng-thái)
  - [5.3 Vòng đời Trạng thái của Dự án (Project Lifecycle)](#53-vòng-đời-trạng-thái-của-dự-án-project-lifecycle)
- [PHẦN 6: THUẬT TOÁN ĐỒ THỊ VÀ KIỂM TRA CHU TRÌNH (KAHN DAG)](#phần-6-thuật-toán-đồ-thị-và-kiểm-tra-chu-trình-kahn-dag)
- [PHẦN 7: ĐẶC TẢ TÍCH HỢP TRÍ TUỆ NHÂN TẠO (AI ENGINE SPECIFICATION)](#phần-7-đặc-tả-tích-hợp-trí-tuệ-nhân-tạo-ai-engine-specification)
  - [7.1 Cơ chế Tóm tắt Tiến độ và Chẩn đoán Điểm nghẽn](#71-cơ-chế-tóm-tắt-tiến-độ-và-chẩn-đoán-điểm-nghẽn)
  - [7.2 Quy trình Sinh Đồ thị Tự động có Con người Kiểm soát (Human-in-the-loop)](#72-quy-trình-sinh-đồ-thị-tự-động-có-con-người-kiểm-soát-human-in-the-loop)
- [PHẦN 8: BẢNG TỔNG HỢP THIẾU SÓT VÀ LỘ TRÌNH TRIỂN KHAI](#phần-8-bảng-tổng-hợp-thiếu-sót-và-lộ-trình-triển-khai)
- [PHẦN 9: QUY TẮC KỸ THUẬT DÀNH CHO CLAUDE CODE VÀ NHÀ PHÁT TRIỂN](#phần-9-quy-tắc-kỹ-thuật-dành-cho-claude-code-và-nhà-phát-triển)

---

## PHẦN 1: TỔNG QUAN HỆ THỐNG VÀ BỐI CẢNH KIẾN TRÚC

### 1.1 Mục tiêu và Tầm nhìn Nghiệp vụ
Hệ thống **Workflow Pipeline Engine** là nền tảng quản lý và điều phối dự án dựa trên mô hình **đồ thị có hướng không chu trình (DAG - Directed Acyclic Graph)**. Khác với các hệ thống quản lý tác vụ tuyến tính thông thường:
* Tự động hóa việc mở khóa các công việc phụ thuộc thông qua **Động cơ máy trạng thái (State Machine Engine)**.
* Kiểm soát chặt chẽ quy trình nộp và nghiệm thu sản phẩm qua cổng kiểm duyệt (RBAC Approval Gate).
* Tích hợp trí tuệ nhân tạo (Gemini AI) chạy ngầm để chẩn đoán điểm nghẽn tiến độ, đường găng CPM và bẫy công việc.

### 1.2 Cấu trúc 5 Phân hệ Nghiệp vụ (Bounded Contexts)
Hệ thống được tổ chức thành 5 phân hệ chức năng độc lập về mặt logic nghiệp vụ và giao diện người dùng dựa trên cấu trúc điều hướng Navigation chuẩn:

| Phân hệ | Tên gọi kỹ thuật | Vai trò & Trách nhiệm chính | Màn hình chính |
| :--- | :--- | :--- | :--- |
| **Phân hệ 1** | **Auth Gateway** | Đăng ký, đăng nhập, hồ sơ cá nhân, cấp phát JWT, xoay vòng Refresh Token và điều phối Dynamic Topbar RBAC theo ngữ cảnh dự án. | Auth / Profile |
| **Phân hệ 2** | **Project Workspace** | Khởi tạo dự án, thiết kế đồ thị kéo thả Dual-View (Phase Graph / Kanban), quản lý thành viên (Direct Add) và kiểm tra chu trình lặp (Kahn DAG). | Workflow Canvas |
| **Phân hệ 3** | **Execution Engine** | Máy trạng thái điều phối mở khóa Node (AND/OR join), bảng Kanban cá nhân hóa (Direct Push Model), nộp tài nguyên Artifact và nghiệm thu kết quả. | My Tasks |
| **Phân hệ 4** | **Overview & Review Portal** | Tổng quan số liệu dự án, Public Audit & Share Gateway (Guest Link), Feedback Queue 1 chiều (từ GV/Khách) và AI chẩn đoán điểm nghẽn. | Overview |
| **Phân hệ 5** | **Admin Portal** | Quản lý tài khoản toàn hệ thống, dọn dẹp/lưu trữ dự án rác và quản lý kho mẫu quy trình chuẩn (System Templates). | Admin Dashboard |

---

## PHẦN 2: CÂY PHÂN RÃ CHỨC NĂNG HỆ THỐNG (FUNCTIONAL DECOMPOSITION)
Hệ thống bao gồm 5 phân hệ lớn với 23 khối chức năng chi tiết:

### Phân hệ 1: Phân hệ Xác thực & Tài khoản (Auth Gateway)
* **1.1 Đăng ký tài khoản mới:** Tạo tài khoản người dùng với các thông tin cơ bản.
* **1.2 Đăng nhập & Cấp phát JWT:** Xác thực thông tin đăng nhập, sinh Access Token và lưu trữ phiên qua Refresh Token.
* **1.3 Quản lý hồ sơ cá nhân:** Cập nhật thông tin người dùng, đổi mật khẩu và quản lý phiên đăng nhập.

### Phân hệ 2: Phân hệ Dự án & Thiết kế DAG (Project Workspace)
* **2.1 Khởi tạo dự án & Clone Template:** Tạo dự án mới từ đầu hoặc sao chép toàn bộ cấu trúc quy trình từ một mẫu chuẩn có sẵn.
* **2.2 Thêm thành viên trực tiếp (Direct Add) & Gán quyền:** Thêm trực tiếp người dùng đã có tài khoản vào dự án qua username/email; hệ thống tự động đẩy chuông báo `NOTIFICATION` (loại bỏ hoàn toàn cơ chế gửi email mời kèm token phức tạp).
* **2.3 Điều chỉnh Role / Thu hồi quyền thành viên:** Thay đổi vai trò (Owner, Collaborator, Viewer) hoặc loại bỏ thành viên (Soft Remove).
* **2.4 Màn hình Workflow (Dual-View Phase Graph / Kanban):** Giao diện tương tác trực quan cho phép chuyển đổi linh hoạt giữa Phase Graph (đồ thị DAG) và Phase Kanban, thêm nút công việc, thiết lập đường liên kết phụ thuộc và cấu hình thuộc tính.
* **2.5 Kiểm tra chu trình lặp (Thuật toán Kahn):** Giải thuật kiểm tra tính hợp lệ của đồ thị DAG, chặn các trường hợp tạo vòng lặp phụ thuộc khép kín trước khi kích hoạt.

### Phân hệ 3: Phân hệ Engine Điều phối & Thực thi Node (Execution Engine)
* **3.1 Engine tự mở khóa Node (AND / OR Join):** Động cơ tự động tính toán điều kiện hoàn thành của các nút tiền nhiệm để chuyển trạng thái nút từ `LOCKED` sang `TODO`.
* **3.2 Bảng Kanban My Tasks (Direct Push Model):** Màn hình My Tasks được cá nhân hóa tuyệt đối theo điều kiện `assignedUserId === currentUserId`, tự động hiển thị các công việc được giao trực tiếp (không qua bước trung gian Chấp nhận / Từ chối).
* **3.3 Bàn giao kết quả (Đính kèm Artifact - Tùy chọn):** Người phụ trách chuyển trạng thái từ `IN_PROGRESS` sang `REVIEW`, việc đính kèm liên kết minh chứng là tùy chọn (Optional).
* **3.4 Đánh giá & Duyệt kết quả (Task State Machine & RBAC Gate):** Kiểm soát việc chuyển trạng thái từ `REVIEW` sang `DONE` qua cổng phê duyệt RBAC Gate (chỉ OWNER có quyền duyệt), hoặc từ chối quay về `IN_PROGRESS` kèm lý do bắt buộc.
* **3.5 Cảnh báo Deadline & Điều phối nhân lực:** Tiến trình chạy ngầm quét định kỳ phát hiện các task trễ hạn (`is_overdue = TRUE`), cho phép gia hạn hoặc phân công lại người thực hiện.
* **3.6 Thống kê tiến độ & Task Metrics:** Tổng hợp chỉ số định lượng về khối lượng công việc, tỷ lệ hoàn thành và thời gian thực thi.

### Phân hệ 4: Phân hệ Cổng Đánh giá & AI Chẩn đoán (Overview & Review Portal)
* **4.1 Quản lý Public Audit & Share Gateway:** Sinh mã Token ngẫu nhiên (Generate New Token), thu hồi quyền truy cập (Revoke Link), cài đặt thời hạn hết hạn ngay tại Header màn hình Overview.
* **4.2 Xem trực quan đồ thị & Artifact (Read-only):** Cung cấp giao diện chỉ xem cho Giáo viên hoặc Chuyên gia đánh giá tiến độ mà không cho phép sửa đổi dữ liệu.
* **4.3 Khối Feedback Queue 1 chiều trên màn hình Overview:** Nhận dòng phản hồi tuyến tính từ TEACHER/GUEST gắn theo mã Node để nhóm thực thi tiếp thu và đánh dấu `RESOLVED` mà không trả lời/tranh luận lại (không có cơ chế phản hồi ngược).
* **4.4 AI chẩn đoán điểm nghẽn tiến độ (Gemini Worker):** Tích hợp AI Worker phân tích cấu trúc đồ thị và lịch sử thực thi để nhận diện rủi ro chậm trễ và đưa ra lời khuyên hành động.

### Phân hệ 5: Phân hệ Quản trị Nền tảng (Admin Portal)
* **5.1 Quản lý User & Khóa/Mở tài khoản:** Quản trị viên xem danh sách toàn bộ người dùng và thao tác khóa hoặc mở khóa quyền truy cập.
* **5.2 CRUD Kho mẫu quy trình chuẩn:** Quản trị viên tạo, sửa, xóa và duy trì các mẫu quy trình công việc tiêu chuẩn cho toàn hệ thống.
* **5.3 Giám sát hạ tầng & Dọn dẹp dự án rác:** Giám sát tài nguyên hệ thống, thông báo cảnh báo trước 7 ngày và chuyển sang trạng thái lưu trữ (Archive) đối với dự án bị bỏ rơi.

---

## PHẦN 3: TÁC NHÂN (ACTORS), MỐI QUAN HỆ VÀ MA TRẬN PHÂN QUYỀN (RBAC)

### 3.1 Danh sách Tác nhân (Actors)

#### A. Tác nhân Con người
* **Quản trị viên (System Admin):** Quản trị hạ tầng kỹ thuật, tài khoản người dùng và kho mẫu dùng chung. Không can thiệp vào dữ liệu nội bộ chi tiết của dự án.
* **Chủ dự án (Project Owner / Lead):** Người tạo và sở hữu dự án, nắm toàn quyền thiết kế đồ thị, phân quyền, nghiệm thu và điều phối.
* **Cộng sự thực thi (Collaborator / Member):** Thành viên trực tiếp tham gia làm việc, xử lý công việc được gán trên bảng Kanban My Tasks cá nhân hóa, nộp kết quả và tiếp thu góp ý tại Feedback Queue (không tranh luận lại).
* **Người xem (Project Viewer):** Thành viên trong dự án chỉ được cấp quyền đọc đồ thị, xem tài nguyên và xem số liệu thống kê.
* **Giáo viên / Người đánh giá ngoài (Guest via Token):** Khách truy cập bên ngoài qua liên kết Token, có quyền xem đồ thị (chỉ đọc), ghim phản hồi góp ý 1 chiều và xem báo cáo AI.
* **Người dùng vãng lai (Anonymous):** Người truy cập chưa xác thực, chỉ có quyền đăng ký hoặc đăng nhập hệ thống.

#### B. Tác nhân Hệ thống (System Actors)
* **Authentication Service:** Xử lý xác thực, cấp phát và thu hồi JWT / Refresh Token, kiểm soát phiên làm việc.
* **Execution State Engine:** Động cơ ngầm giám sát trạng thái task, thẩm định điều kiện hội tụ (AND/OR join) và mở khóa các nút kế tiếp.
* **AI Engine Worker:** Tiếp nhận dữ liệu tiến độ, tính toán phân tích bất đồng bộ và ghi đè báo cáo chẩn đoán vào dự án.
* **Notification Service:** Hệ thống đẩy thông báo in-app quả chuông (`NOTIFICATION`) khi task mở khóa, được duyệt/từ chối, cảnh báo trễ hạn hoặc khi được thêm vào dự án.
* **Resource Management Service:** Quản lý liên kết tài nguyên ngoài (PR, Figma, Docs, Swagger), **tuyệt đối không lưu file vật lý trên server**.

### 3.2 Quan hệ Kế thừa Quyền giữa các Tác nhân
```
[Anonymous] ──(Xác thực thành công)──> [Project Viewer]
                                              │
                                              ▼
                                     [Collaborator / Member]
                                              │
                                              ▼
                                       [Project Owner]

[System Admin]    ─── (Luồng độc lập: Quản trị tài khoản & Kho mẫu hệ thống)
[Guest via Token] ─── (Luồng độc lập: Truy cập chỉ xem & Gửi feedback 1 chiều)
```

### 3.3 Ma trận Phân quyền Use Case (RBAC Matrix)

| Nhóm Nghiệp Vụ / Chức Năng | Anonymous | System Admin | Guest (Token) | Project Viewer | Collaborator | Project Owner |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Đăng ký / Đăng nhập & Cấp phát JWT** | ✅ | - | - | - | - | - |
| **Quản lý hồ sơ cá nhân (Profile)** | - | ✅ | - | ✅ | ✅ | ✅ |
| **Quản lý User & Khóa/Mở tài khoản** | - | ✅ | - | - | - | - |
| **CRUD Mẫu quy trình chuẩn (System Template)** | - | ✅ | - | - | - | - |
| **Dọn dẹp / Chuyển Archive dự án rác** | - | ✅ | - | - | - | - |
| **Khởi tạo dự án & Clone Template** | - | - | - | - | - | ✅ |
| **Thêm thành viên trực tiếp (Direct Add) & Gán Role** | - | - | - | - | - | ✅ |
| **Điều chỉnh Role / Kick thành viên (Soft Remove)** | - | - | - | - | - | ✅ |
| **Thiết kế & Lưu tọa độ đồ thị DAG (Workflow)** | - | - | - | - | - | ✅ |
| **Kiểm tra chu trình lặp (Kahn DAG)** | - | - | - | - | - | ✅ |
| **Sinh & Thu hồi Token chia sẻ (Guest Link)** | - | - | - | - | - | ✅ |
| **Duyệt bài / Yêu cầu làm lại Task (Review Gate)** | - | - | - | - | - | ✅ |
| **Gia hạn Deadline / Đổi người phụ trách Node** | - | - | - | - | - | ✅ |
| **Thực thi công việc trên My Tasks (`assignedUserId`)** | - | - | - | - | ✅ | ✅ |
| **Chuyển trạng thái Task (`TODO` ➔ `IN_PROGRESS`)** | - | - | - | - | ✅ | ✅ |
| **Nộp bài (`IN_PROGRESS` ➔ `REVIEW`) kèm Artifact** | - | - | - | - | ✅ | ✅ |
| **Xem đồ thị tiến độ DAG & Tài nguyên Artifacts** | - | - | ✅ | ✅ | ✅ | ✅ |
| **Xem Dashboard số liệu thống kê (Metrics)** | - | - | ✅ | ✅ | ✅ | ✅ |
| **Xem báo cáo chẩn đoán AI** | - | - | ✅ | ✅ | ✅ | ✅ |
| **Gửi phản hồi / Góp ý 1 chiều** | - | - | ✅ *(Gửi mới)* | - | - | - |
| **Xem & Đánh dấu RESOLVED Feedback Queue** | - | - | - | - | ✅ | ✅ |
| **Nhận thông báo quả chuông (Notification Bell)** | - | - | - | ✅ | ✅ | ✅ |

### 3.4 Nguyên tắc Bảo mật và Vận hành Phiên làm việc
> [!IMPORTANT]
> 1. **Giới hạn quyền đọc của Admin:** Quản trị viên chỉ được quyền xem các thông tin chung (Metadata) của dự án, tuyệt đối không được đọc hoặc can thiệp nội dung chi tiết của các Task và tài nguyên nội bộ nếu không có sự ủy quyền.
> 2. **Cơ chế Token dành cho Guest:** Mã truy cập của khách là một chuỗi ngẫu nhiên bảo mật cao, bắt buộc có thời hạn hết hiệu lực cụ thể (`expires_at`), có khả năng thu hồi tức thì (`is_revoked`) và chỉ cho phép đọc những tài nguyên được đánh dấu công khai (`is_public_for_guest = TRUE`).
> 3. **Thu hồi quyền tức thì (Immediate Revocation):** Khi tài khoản bị khóa bởi Admin hoặc bị loại khỏi dự án, toàn bộ token/phiên làm việc liên quan bị hủy hiệu lực ngay lập tức thông qua cơ chế so khớp `token_version` và cờ `removed_at`.

---

## PHẦN 4: ĐẶC TẢ CƠ SỞ DỮ LIỆU POSTGRESQL (DATA DICTIONARY - 12 BẢNG)
Hệ thống sử dụng cơ sở dữ liệu quan hệ PostgreSQL chuẩn hóa (3NF) với **12 bảng dữ liệu**, tích hợp kiểu dữ liệu JSONB cho các cấu trúc động (`latest_ai_analysis`, `graph_data`, `ui_metadata`).

---

### 4.1 Bảng `USERS`
Lưu trữ danh tính và thông tin xác thực của người dùng toàn hệ thống.

| Tên Cột | Kiểu Dữ Liệu | Khóa / Ràng Buộc | Giá Trị Mặc Định | Mô Tả & Nghiệp Vụ |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `bigint` | PK, Auto Increment | | Khóa chính định danh tài khoản. |
| `username` | `varchar(50)` | UNIQUE, NOT NULL | | Tên định danh tài khoản đăng nhập. |
| `email` | `varchar(100)` | UNIQUE, NOT NULL | | Địa chỉ thư điện tử xác thực. |
| `full_name` | `varchar(100)` | NULLABLE | | Họ và tên hiển thị của người dùng. |
| `password_hash` | `varchar(255)` | NOT NULL | | Chuỗi mật khẩu đã được băm an toàn (BCrypt). |
| `system_role` | `varchar(20)` | NOT NULL | `'USER'` | Vai trò toàn hệ thống: `'ADMIN'`, `'USER'`. |
| `is_locked` | `boolean` | NOT NULL | `FALSE` | Cờ khóa tài khoản từ Quản trị viên. |
| `token_version` | `int` | NOT NULL | `0` | Hỗ trợ thu hồi phiên làm việc tức thời và đăng xuất khỏi mọi thiết bị khi đổi mật khẩu. |
| `created_at` | `timestamp with time zone` | NOT NULL | `NOW()` | Thời điểm tạo tài khoản. |

---

### 4.2 Bảng `REFRESH_TOKEN`
Lưu trữ phiên làm việc và mã băm Refresh Token phục vụ cơ chế xoay vòng token (Refresh Token Rotation).

| Tên Cột | Kiểu Dữ Liệu | Khóa / Ràng Buộc | Giá Trị Mặc Định | Mô Tả & Nghiệp Vụ |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `bigint` | PK, Auto Increment | | Khóa chính bản ghi phiên. |
| `user_id` | `bigint` | FK (USERS.id), NOT NULL | | Tài khoản sở hữu phiên đăng nhập. |
| `token_hash` | `varchar(255)` | UNIQUE, NOT NULL | | Chuỗi băm mã làm mới token. |
| `expires_at` | `timestamp with time zone` | NOT NULL | | Thời điểm token hết hiệu lực. |
| `revoked` | `boolean` | NOT NULL | `FALSE` | Cờ đánh dấu token đã bị thu hồi. |
| `created_at` | `timestamp with time zone` | NOT NULL | `NOW()` | Thời điểm cấp phát phiên. |

---

### 4.3 Bảng `PROJECT`
Lưu trữ thông tin không gian làm việc và metadata của từng dự án quy trình pipeline.

| Tên Cột | Kiểu Dữ Liệu | Khóa / Ràng Buộc | Giá Trị Mặc Định | Mô Tả & Nghiệp Vụ |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `bigint` | PK, Auto Increment | | Khóa chính định danh dự án. |
| `owner_id` | `bigint` | FK (USERS.id), NOT NULL | | Chủ dự án (Project Owner). |
| `name` | `varchar(150)` | NOT NULL | | Tên hiển thị của dự án. |
| `description` | `text` | NULLABLE | | Mô tả phạm vi và mục tiêu dự án. |
| `status` | `varchar(30)` | NOT NULL | `'DRAFT'` | Trạng thái: `'DRAFT'`, `'ACTIVE'`, `'INACTIVE'`, `'ARCHIVED'`. |
| `latest_ai_analysis` | `jsonb` | NULLABLE | | Bản ghi phân tích mới nhất từ AI Worker (metrics, anomalies, traps, cpm_forecast, advice). |
| `created_at` | `timestamp with time zone` | NOT NULL | `NOW()` | Thời điểm khởi tạo dự án. |
| `updated_at` | `timestamp with time zone` | NOT NULL | `NOW()` | Thời điểm cập nhật dự án gần nhất (phục vụ sort "Gần đây nhất" và Optimistic Locking mức dự án). |

> [!NOTE]
> Đã xóa bỏ hoàn toàn cột `guest_access` (JSONB) trong bảng này do cơ chế chia sẻ cho khách ngoài đã được tách thành bảng riêng biệt `GUEST_LINK`.

---

### 4.4 Bảng `PROJECT_MEMBER`
Quản lý danh sách và quyền hạn của các thành viên bên trong từng dự án theo cơ chế kết nạp trực tiếp (Direct Add).

| Tên Cột | Kiểu Dữ Liệu | Khóa / Ràng Buộc | Giá Trị Mặc Định | Mô Tả & Nghiệp Vụ |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `bigint` | PK, Auto Increment | | Khóa chính bản ghi thành viên. |
| `project_id` | `bigint` | FK (PROJECT.id), NOT NULL | | Dự án tham gia. |
| `user_id` | `bigint` | FK (USERS.id), NOT NULL | | Người dùng được kết nạp. |
| `role` | `varchar(30)` | NOT NULL | | Vai trò trong dự án: `'OWNER'`, `'COLLABORATOR'`, `'VIEWER'`. |
| `joined_at` | `timestamp with time zone` | NOT NULL | `NOW()` | Thời điểm tham gia dự án. |
| `removed_at` | `timestamp with time zone` | NULLABLE | `NULL` | Thời điểm bị loại khỏi dự án (Soft Remove, `NULL` khi đang hoạt động). |

* **Ràng buộc duy nhất (Unique Constraint):** Cặp `(project_id, user_id)` là duy nhất tại một thời điểm.

---

### 4.5 Bảng `PIPELINE_TEMPLATE`
Lưu trữ các mẫu quy trình công việc chuẩn phục vụ tái sử dụng và nhân bản dự án (Clone Template).

| Tên Cột | Kiểu Dữ Liệu | Khóa / Ràng Buộc | Giá Trị Mặc Định | Mô Tả & Nghiệp Vụ |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `bigint` | PK, Auto Increment | | Khóa chính mẫu quy trình. |
| `name` | `varchar(150)` | NOT NULL | | Tên mẫu quy trình chuẩn. |
| `description` | `text` | NULLABLE | | Mô tả nghiệp vụ của mẫu. |
| `created_by` | `bigint` | FK (USERS.id), NOT NULL | | Người thiết lập mẫu. |
| `is_system_standard` | `boolean` | NOT NULL | `FALSE` | Đánh dấu mẫu dùng chung toàn hệ thống do Quản trị viên thiết lập. |
| `graph_data` | `jsonb` | NOT NULL | | Cấu trúc toàn bộ đồ thị mẫu (nodes, edges, metadata). |
| `created_at` | `timestamp with time zone` | NOT NULL | `NOW()` | Thời điểm tạo mẫu. |

**Cấu trúc mẫu JSONB `graph_data`:**
```json
{
  "nodes": [
    { "id": "temp-node-1", "title": "Phân tích yêu cầu", "join_policy": "ALL_COMPLETED" },
    { "id": "temp-node-2", "title": "Thiết kế hệ thống", "join_policy": "ALL_COMPLETED" }
  ],
  "edges": [
    { "parent_id": "temp-node-1", "child_id": "temp-node-2" }
  ],
  "metadata": { "category": "Software Engineering", "version": "1.0" }
}
```

---

### 4.6 Bảng `WORK_PHASE`
Phân chia giai đoạn vĩ mô (Macro Phases) giúp phân nhóm và hiển thị trực quan các cụm công việc trên Dual-View Phase Graph / Kanban.

| Tên Cột | Kiểu Dữ Liệu | Khóa / Ràng Buộc | Giá Trị Mặc Định | Mô Tả & Nghiệp Vụ |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `bigint` | PK, Auto Increment | | Khóa chính giai đoạn. |
| `project_id` | `bigint` | FK (PROJECT.id), NOT NULL | | Dự án sở hữu giai đoạn. |
| `parent_phase_id` | `bigint` | FK (WORK_PHASE.id), NULLABLE | `NULL` | Dùng khi phân cấp Phase con (Sub-phase); `NULL` nếu là Phase gốc. |
| `name` | `varchar(100)` | NOT NULL | | Tên giai đoạn (Foundation, Auth, Core...). |
| `sub_title` | `varchar(255)` | NULLABLE | | Tiêu đề phụ mô tả ngắn gọn vai trò giai đoạn. |
| `accent_color` | `varchar(50)` | NULLABLE | | Mã màu hiển thị (emerald, blue, slate, violet...). |
| `order_index` | `int` | NOT NULL | `0` | Thứ tự sắp xếp hiển thị phase trên giao diện. |
| `created_at` | `timestamp with time zone` | NOT NULL | `NOW()` | Thời điểm khởi tạo giai đoạn. |

---

### 4.7 Bảng `NODE`
Bảng trung tâm lưu trữ thông tin của từng công việc/tác vụ (Task/Node) trong quy trình điều phối DAG.

| Tên Cột | Kiểu Dữ Liệu | Khóa / Ràng Buộc | Giá Trị Mặc Định | Mô Tả & Nghiệp Vụ |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `bigint` | PK, Auto Increment | | Khóa chính định danh Node. |
| `project_id` | `bigint` | FK (PROJECT.id), NOT NULL | | Dự án chứa công việc. |
| `phase_id` | `bigint` | FK (WORK_PHASE.id), NULLABLE | `NULL` | Giai đoạn trực thuộc (`NULL` nếu là task tự do phi kỹ thuật). |
| `code` | `varchar(50)` | NOT NULL | | Mã định danh công việc, duy nhất trong dự án (ví dụ: `WPE-001`, `AUTH-02`). |
| `title` | `varchar(200)` | NOT NULL | | Tiêu đề công việc. |
| `description` | `text` | NULLABLE | | Hướng dẫn chi tiết và tiêu chuẩn kỹ thuật. |
| `status` | `varchar(30)` | NOT NULL | `'LOCKED'` | Trạng thái: `'LOCKED'`, `'TODO'`, `'IN_PROGRESS'`, `'REVIEW'`, `'DONE'`. |
| `assigned_user_id` | `bigint` | FK (USERS.id), NULLABLE | `NULL` | Người thực thi trực tiếp trên bảng My Tasks (`assignedUserId === currentUserId`). |
| `join_policy` | `varchar(30)` | NOT NULL | `'ALL_COMPLETED'` | Điều kiện mở khóa: `'ALL_COMPLETED'` (AND-join), `'ANY_COMPLETED'` (OR-join). |
| `reject_reason` | `text` | NULLABLE | | Lý do từ chối nghiệm thu do Owner nhập khi trả task từ `REVIEW` về `IN_PROGRESS` (bắt buộc nhập khi từ chối). |
| `due_date` | `timestamp with time zone` | NULLABLE | | Hạn chót hoàn thành tác vụ. |
| `is_overdue` | `boolean` | NOT NULL | `FALSE` | Cờ trễ hạn do Background Worker quét và cập nhật tự động. |
| `version` | `bigint` | NOT NULL | `0` | Cột phục vụ khóa lạc quan (Optimistic Locking via `@Version`), chống xung đột khi nhiều người cập nhật 1 task. |
| `ui_metadata` | `jsonb` | NOT NULL | `'{}'` | Tọa độ và thuộc tính vẽ node trên Canvas (`{ x, y, width, height, color }`). |
| `created_at` | `timestamp with time zone` | NOT NULL | `NOW()` | Thời điểm tạo task. |
| `updated_at` | `timestamp with time zone` | NOT NULL | `NOW()` | Thời điểm cập nhật task gần nhất. |

**Cấu trúc mẫu JSONB `ui_metadata`:**
```json
{
  "position": { "x": 120, "y": 240 },
  "style": { "fill": "#ffffff", "stroke": "#2563eb" },
  "color": "blue"
}
```

---

### 4.8 Bảng `NODE_DEPENDENCY`
Biểu diễn các cạnh có hướng (Directed Edges) định nghĩa cấu trúc đồ thị DAG giữa các nút công việc.

| Tên Cột | Kiểu Dữ Liệu | Khóa / Ràng Buộc | Giá Trị Mặc Định | Mô Tả & Nghiệp Vụ |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `bigint` | PK, Auto Increment | | Khóa chính bản ghi liên kết. |
| `project_id` | `bigint` | FK (PROJECT.id), NOT NULL | | Dự án chứa liên kết. |
| `parent_node_id` | `bigint` | FK (NODE.id), NOT NULL | | Nút tiền nhiệm (đứng trước). |
| `child_node_id` | `bigint` | FK (NODE.id), NOT NULL | | Nút kế nhiệm (đứng sau). |

* **Ràng buộc duy nhất (Unique Constraint):** Cặp `(parent_node_id, child_node_id)` là duy nhất. Không được phép tạo hai đường nối trùng lặp.

---

### 4.9 Bảng `ARTIFACTS`
Quản lý tài nguyên và liên kết sản phẩm bàn giao công việc (**Tuyệt đối không lưu file vật lý trên server, chỉ lưu URL liên kết ngoài**).

| Tên Cột | Kiểu Dữ Liệu | Khóa / Ràng Buộc | Giá Trị Mặc Định | Mô Tả & Nghiệp Vụ |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `bigint` | PK, Auto Increment | | Khóa chính tài nguyên. |
| `project_id` | `bigint` | FK (PROJECT.id), NOT NULL | | Dự án sở hữu tài nguyên. |
| `node_id` | `bigint` | FK (NODE.id), NULLABLE | `NULL` | Gắn vào 1 task cụ thể (`NULL` nếu tạo độc lập trong Kho chung Project Hub). |
| `uploaded_by` | `bigint` | FK (USERS.id), NOT NULL | | Người đính kèm liên kết. |
| `name` | `varchar(200)` | NOT NULL | | Tên hiển thị (ví dụ: "Bản thiết kế Figma", "Swagger API Spec", "Pull Request #45"). |
| `type` | `varchar(50)` | NOT NULL | | Phân loại liên kết ngoài: `'PR'`, `'FIGMA'`, `'DOCS'`, `'SWAGGER'`, `'OTHER_LINK'`. |
| `url` | `varchar(500)` | NOT NULL | | Đường dẫn URL trực tiếp tới tài nguyên bên ngoài. |
| `is_in_repository` | `boolean` | NOT NULL | `FALSE` | Cờ đánh dấu tài nguyên có được đưa vào Kho chung tài liệu của dự án hay không. |
| `is_public_for_guest` | `boolean` | NOT NULL | `TRUE` | Cờ cho phép người đánh giá ngoài truy cập xem qua Guest Link. |
| `created_at` | `timestamp with time zone` | NOT NULL | `NOW()` | Thời điểm tạo bản ghi. |

---

### 4.10 Bảng `PROJECT_FEEDBACK`
Lưu trữ thông tin đánh giá, góp ý 1 chiều từ Người đánh giá ngoài hoặc Giáo viên hướng dẫn (Feedback Queue 1 chiều).

| Tên Cột | Kiểu Dữ Liệu | Khóa / Ràng Buộc | Giá Trị Mặc Định | Mô Tả & Nghiệp Vụ |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `bigint` | PK, Auto Increment | | Khóa chính phản hồi. |
| `project_id` | `bigint` | FK (PROJECT.id), NOT NULL | | Dự án nhận góp ý. |
| `node_id` | `bigint` | FK (NODE.id), NULLABLE | `NULL` | Trỏ vào một task cụ thể (`NULL` nếu là góp ý chung cho toàn dự án). |
| `reviewer_name` | `varchar(100)` | NOT NULL | | Tên của người đưa ra nhận xét. |
| `reviewer_role` | `varchar(20)` | NOT NULL | | Phân loại người đánh giá: `'TEACHER'`, `'GUEST'`. |
| `content` | `text` | NOT NULL | | Nội dung chi tiết của nhận xét hoặc yêu cầu chỉnh sửa. |
| `status` | `varchar(30)` | NOT NULL | `'OPEN'` | Trạng thái tiếp thu: `'OPEN'`, `'RESOLVED'`. |
| `created_at` | `timestamp with time zone` | NOT NULL | `NOW()` | Thời điểm gửi phản hồi. |

> [!WARNING]
> **Quy tắc Feedback 1 chiều cốt lõi:** Bảng **TUYỆT ĐỐI KHÔNG CÓ cột `reply_content`**. Luồng Feedback là luồng tiếp thu 1 chiều: thành viên nhóm đọc nội dung để sửa chữa và bấm chuyển trạng thái từ `OPEN` sang `RESOLVED`, tuyệt đối không có cơ chế tranh luận hoặc phản hồi qua lại trên hệ thống.

---

### 4.11 Bảng `GUEST_LINK`
Quản lý mã token truy cập công khai dành riêng cho Giáo viên hướng dẫn và Người đánh giá ngoài.

| Tên Cột | Kiểu Dữ Liệu | Khóa / Ràng Buộc | Giá Trị Mặc Định | Mô Tả & Nghiệp Vụ |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `bigint` | PK, Auto Increment | | Khóa chính liên kết khách. |
| `project_id` | `bigint` | FK (PROJECT.id), NOT NULL | | Dự án được chia sẻ. |
| `token` | `varchar(255)` | UNIQUE, NOT NULL | | Chuỗi token ngẫu nhiên bảo mật cao được sinh cho liên kết chia sẻ. |
| `is_revoked` | `boolean` | NOT NULL | `FALSE` | Cờ thu hồi liên kết tức thời từ Chủ dự án. |
| `expires_at` | `timestamp with time zone` | NOT NULL | | Thời điểm liên kết hết hiệu lực truy cập. |
| `created_at` | `timestamp with time zone` | NOT NULL | `NOW()` | Thời điểm tạo liên kết. |

---

### 4.12 Bảng `NOTIFICATION`
Lưu trữ thông báo cá nhân phục vụ tính năng thông báo quả chuông (Notification Bell) trên thanh Topbar của người dùng.

| Tên Cột | Kiểu Dữ Liệu | Khóa / Ràng Buộc | Giá Trị Mặc Định | Mô Tả & Nghiệp Vụ |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `bigint` | PK, Auto Increment | | Khóa chính thông báo. |
| `user_id` | `bigint` | FK (USERS.id), NOT NULL | | Người dùng nhận thông báo. |
| `title` | `varchar(200)` | NOT NULL | | Tiêu đề thông báo ngắn gọn. |
| `message` | `text` | NULLABLE | | Nội dung chi tiết thông báo. |
| `link_url` | `varchar(500)` | NULLABLE | | Đường dẫn điều hướng nhanh khi người dùng click vào thông báo. |
| `is_read` | `boolean` | NOT NULL | `FALSE` | Cờ đánh dấu đã đọc (`FALSE` = hiển thị chấm đỏ trên chuông). |
| `created_at` | `timestamp with time zone` | NOT NULL | `NOW()` | Thời điểm tạo thông báo. |

---

## PHẦN 5: ĐẶC TẢ MÁY TRẠNG THÁI VÀ ENGINE ĐIỀU PHỐI (STATE MACHINE)

### 5.1 Vòng đời Trạng thái của Node
Trạng thái của từng công việc trên màn hình Workflow và bảng Kanban cá nhân hóa My Tasks chuyển đổi theo quy trình 4 cột chuẩn (`TODO` ➔ `IN_PROGRESS` ➔ `REVIEW` ➔ `DONE`):

```text
       [Khởi tạo Node trên đồ thị Workflow Canvas]
                          │
                          ▼
                     ┌──────────┐
                     │  LOCKED  │  <── Nút bị khóa hoàn toàn. Không hiển thị trên My Tasks
                     └──────────┘      khi các công việc tiền nhiệm chưa hoàn tất.
                          │
                          │ (Engine tự động mở khóa theo AND-join hoặc OR-join)
                          ▼
                     ┌──────────┐
                     │   TODO   │  <── Tự động xuất hiện trên My Tasks của người phụ trách
                     └──────────┘      (Mô hình Direct Push: assignedUserId === currentUserId)
                          │
                          │ (Thành viên bắt đầu thực hiện tác vụ)
                          ▼
                 ┌─────────────────┐
                 │   IN_PROGRESS   │ ◄─────────────────────────────────────────────┐
                 └─────────────────┘                                               │
                   │             │                                                 │
                   │             └─► (Tiến trình quét quá hạn: gán is_overdue=TRUE │
                   │                  Owner có quyền gia hạn hoặc đổi người làm)   │
                   │                                                               │
                   │ (Thành viên nộp kết quả công việc:                            │
                   │  Đính kèm Artifact là TÙY CHỌN - không bắt buộc)              │
                   ▼                                                               │
                 ┌─────────────────┐                                               │
                 │     REVIEW      │                                               │
                 └─────────────────┘                                               │
                   │             │                                                 │
                   │             └─► (Owner TỪ CHỐI: bắt buộc nhập reject_reason) ─┘
                   │
                   │ (Chỉ OWNER có quyền duyệt: chấp thuận sản phẩm, đóng băng Node)
                   ▼
                 ┌─────────────────┐
                 │      DONE       │ ──► Kích hoạt Engine kiểm tra điều kiện để mở khóa
                 └─────────────────┘     các Node con kế tiếp theo đồ thị DAG.
                          │
                          ▼
                 [Kết thúc luồng Node]
```

### 5.2 Quy tắc Nghiệp vụ Điều phối và Chuyển đổi Trạng thái

#### 1. Điều kiện mở khóa tự động của Engine (Join Policies)
* **`ALL_COMPLETED` (AND-join):** Nút ở trạng thái `LOCKED` chỉ được chuyển sang `TODO` khi **TẤT CẢ** các nút cha trực tiếp trỏ vào nó đều đã đạt trạng thái `DONE`.
* **`ANY_COMPLETED` (OR-join):** Nút ở trạng thái `LOCKED` sẽ được chuyển sang `TODO` ngay khi **CÓ ÍT NHẤT MỘT** nút cha trực tiếp đạt trạng thái `DONE`.

#### 2. Mô hình Phân công trực tiếp (Direct Push Model) & Bảng My Tasks cá nhân hóa
* Công việc sau khi mở khóa hoặc được gán sẽ đẩy trực tiếp vào bảng My Tasks của người phụ trách theo bộ lọc: `assignedUserId === currentUserId`.
* Loại bỏ hoàn toàn bước trung gian "Chấp nhận / Từ chối" công việc, giúp luồng thực thi gọn gàng và tức thì.

#### 3. Quy định nộp Artifact và Nghiệm thu kết quả
* **Nộp Artifact là TÙY CHỌN (Optional):** Thành viên khi chuyển task từ `IN_PROGRESS` sang `REVIEW` có thể đính kèm link minh chứng hoặc không bắt buộc (linh hoạt cho các task họp hành, cấu hình, nghiên cứu).
* **Cổng phê duyệt nghiêm ngặt (RBAC Approval Gate):** Thành viên thực thi **không thể tự ý chuyển sang `DONE`**. Thao tác duyệt chấp thuận chuyển từ `REVIEW` sang `DONE` hoặc từ chối quay về `IN_PROGRESS` là **đặc quyền duy nhất của tài khoản sở hữu vai trò `OWNER`** trong dự án. Khi từ chối, Owner bắt buộc phải nhập lý do vào trường `reject_reason`.

#### 4. Xử lý tác vụ trễ hạn (Overdue Handling)
* Một tiến trình chạy ngầm định kỳ (Scheduled Job) quét liên tục các nút có trạng thái `IN_PROGRESS` hoặc `REVIEW` mà thời gian hiện tại đã vượt quá `due_date`.
* Tiến trình sẽ cập nhật `is_overdue = TRUE` để hiển thị cảnh báo đỏ trên giao diện. Tại thời điểm này, Owner có quyền gia hạn hạn chót hoặc tái phân bổ người thực hiện.

### 5.3 Vòng đời Trạng thái của Dự án (Project Lifecycle)
Toàn bộ dự án tuân theo 4 trạng thái vòng đời:
* **`DRAFT`:** Giai đoạn xây dựng cấu trúc đồ thị, thêm bớt công việc và thiết lập quan hệ phụ thuộc. Engine điều phối chưa kích hoạt.
* **`ACTIVE`:** Dự án đã vượt qua giải thuật kiểm tra chu trình và được xuất bản chính thức. Các nút gốc không có phụ thuộc sẽ chuyển sang `TODO`, tự động xuất hiện trên My Tasks của người phụ trách và Engine bắt đầu vận hành tự động.
* **`INACTIVE`:** Dự án không phát sinh bất kỳ tương tác hoặc chuyển đổi trạng thái nào trong khoảng thời gian quy định (ví dụ: 30 ngày). Hệ thống sẽ gửi cảnh báo trước khi tiến hành đóng băng.
* **`ARCHIVED`:** Trạng thái lưu trữ do Quản trị viên dọn dẹp hoặc Chủ dự án chủ động lưu trữ. Toàn bộ dữ liệu chuyển sang chế độ chỉ đọc (Read-only). Chủ dự án có thể khôi phục trong thời gian ân hạn quy định.

---

## PHẦN 6: THUẬT TOÁN ĐỒ THỊ VÀ KIỂM TRA CHU TRÌNH (KAHN DAG)

Để đảm bảo quy trình không bị rơi vào tình trạng bế tắc (Deadlock) do phụ thuộc vòng tròn, hệ thống áp dụng **Thuật toán sắp xếp Topo của Kahn (Kahn's Algorithm)**.

### 6.1 Thời điểm Thực thi
1. Khi Chủ dự án nhấn **Lưu** hoặc **Kiểm tra hợp lệ** bản vẽ đồ thị trên giao diện Workflow.
2. Trước thời điểm chuyển trạng thái dự án từ `DRAFT` sang `ACTIVE`. Nếu phát hiện có chu trình lặp, hệ thống lập tức chặn kích hoạt và đánh dấu các nút vi phạm.

### 6.2 Chi tiết Giải thuật Kahn
```text
BẮT ĐẦU:
  1. Khởi tạo mảng Bậc Vào (In-degree) cho tất cả các nút trong dự án = 0.
  2. Với mỗi cạnh phụ thuộc trong danh sách NODE_DEPENDENCY:
       - Tăng Bậc Vào của nút con (child_node_id) lên 1 đơn vị.
       - Thêm nút con vào danh sách kề (Adjacency List) của nút cha (parent_node_id).
  3. Khởi tạo một Hàng Đợi (Queue). Đưa tất cả các nút có Bậc Vào = 0 vào Queue.
  4. Khởi tạo biến đếm count = 0 (Số nút đã duyệt).
  5. Trong khi Queue không rỗng:
       - Lấy một nút u ra khỏi Queue.
       - Tăng count lên 1.
       - Với mỗi nút kế tiếp v nằm trong danh sách kề của u:
           * Giảm Bậc Vào của v đi 1 đơn vị.
           * Nếu Bậc Vào của v giảm về 0:
               Đưa v vào Queue.
  6. Kiểm tra kết quả:
       - Nếu count == Tổng số nút của dự án:
           ==> ĐỒ THỊ HỢP LỆ (DAG hợp lệ, không có chu trình). Cho phép kích hoạt dự án.
       - Ngược lại (count < Tổng số nút):
           ==> ĐỒ THỊ BỊ LỖI CHU TRÌNH LẶP (Circular Dependency Deadlock).
           ==> Lọc ra tất cả các nút có Bậc Vào > 0 để bôi đỏ cảnh báo trực quan cho người dùng.
KẾT THÚC.
```

---

## PHẦN 7: ĐẶC TẢ TÍCH HỢP TRÍ TUỆ NHÂN TẠO (AI ENGINE SPECIFICATION)

### 7.1 Cơ chế Tóm tắt Tiến độ và Chẩn đoán Điểm nghẽn
* **Vấn đề giải quyết:** Tránh việc gửi yêu cầu trực tiếp đến dịch vụ AI (Gemini) mỗi khi người dùng tải trang, hạn chế độ trễ và tiết kiệm hạn mức tài nguyên (Rate Limiting).
* **Giải pháp vận hành:** Tiến trình xử lý ngầm (Background Job / AI Worker) thu thập toàn bộ dữ liệu cấu trúc đồ thị DAG, danh sách nút quá hạn, thời gian chờ tại bước In Review và các phản hồi trong Feedback Queue chưa giải quyết.
* **4 Năng lực AI cốt lõi:**
  1. **Phát hiện anomaly kiến trúc (Architectural Anomalies):** Nhận dạng các nút thắt cổ chai cô lập, phân nhánh mất cân đối hoặc nút hội tụ nhiều luồng mà thiếu tài nguyên.
  2. **Nhận diện task bẫy (Task Traps):** Cảnh báo các nút tiềm ẩn rủi ro trễ hạn ngầm, khối lượng công việc lớn bị dồn nén gần hạn chót.
  3. **Dự báo chuỗi đường găng (CPM Forecast):** Tính toán đường găng tới hạn, thời gian dự phòng (slack time) và dự báo số ngày trễ hạn dây chuyền của toàn bộ đồ thị.
  4. **Khuyến nghị hành động (Actionable Advice):** Đưa ra chỉ dẫn cụ thể nhằm tái phân bổ nhân lực và giải phóng các nút cản trở luồng công việc.

Tất cả 4 năng lực AI sau khi chạy ngầm sẽ tổng hợp và ghi đè trực tiếp kết quả mới nhất vào cột `PROJECT.latest_ai_analysis` dưới định dạng JSONB.

**Chi tiết cấu trúc mẫu của cột JSONB `latest_ai_analysis`:**
```json
{
  "metrics": {
    "total_nodes": 12,
    "completed_nodes": 5,
    "in_progress_nodes": 3,
    "review_nodes": 1,
    "overdue_nodes": 1,
    "completion_rate": 41.67
  },
  "anomalies": [
    {
      "node_code": "WPE-004",
      "type": "ORPHAN_OR_BOTTLENECK",
      "severity": "HIGH",
      "description": "Nút hội tụ 4 nhánh phụ thuộc nhưng chưa được phân bổ người phụ trách"
    }
  ],
  "traps": [
    {
      "node_code": "WPE-007",
      "trap_type": "DEADLINE_PRESSURE_TRAP",
      "estimated_risk": "Khối lượng công việc lớn nhưng thời gian đến deadline chỉ còn dưới 12 giờ"
    }
  ],
  "cpm_forecast": {
    "critical_path": ["WPE-001", "WPE-003", "WPE-007", "WPE-010"],
    "total_estimated_duration_hours": 96,
    "slack_time_hours": 0,
    "projected_delay_days": 2
  },
  "advice": "Ưu tiên giải phóng tài nguyên cho nút WPE-007 trên đường găng (CPM) và chỉ định người phụ trách ngay cho WPE-004 để tránh làm tắc nghẽn giai đoạn Core.",
  "generated_at": "2026-10-08T20:30:00Z"
}
```

### 7.2 Quy trình Sinh Đồ thị Tự động có Con người Kiểm soát (Human-in-the-loop)
Khi mở rộng tính năng tự động tạo quy trình từ mô tả tự nhiên của người dùng:

```text
[Mô tả văn bản của Người dùng]
              │
              ▼
       [AI Engine Prompt]
              │
              ▼
[Đề xuất Đồ thị bản nháp (PENDING_REVIEW)]
              │
              ▼
[Người dùng Xem xét, Chỉnh sửa Tọa độ & Xác nhận]
              │
              ▼
   [Chạy Thuật toán Kahn Validate DAG]
              │
              ▼
[Ghi nhận vào Cơ sở dữ liệu chính thức]
```

> [!CAUTION]
> **Nguyên tắc cốt lõi:** AI chỉ đóng vai trò đề xuất bản thảo, tuyệt đối không được cấp quyền ghi đè trực tiếp dữ liệu chính thức vào cơ sở dữ liệu nếu chưa qua bước xác nhận của người dùng và thẩm định của thuật toán kiểm tra chu trình.

---

## PHẦN 8: BẢNG TỔNG HỢP THIẾU SÓT VÀ LỘ TRÌNH TRIỂN KHAI

### 8.1 Danh mục Xử lý Thiếu sót Kiến trúc (Gap Analysis)

| Mã Gap | Tên Vấn Đề | Phân Hệ Tiếp Nhận | Giải Pháp Kiến Trúc Đã Chuẩn Hóa |
| :--- | :--- | :--- | :--- |
| **G0-01** | Đăng ký / Đăng nhập / Phiên | Auth Gateway | Bổ sung dịch vụ xác thực tập trung, JWT và xoay vòng token qua bảng `REFRESH_TOKEN`. |
| **G0-02** | Quản lý Guest Link Token | Auth Gateway & Project Workspace | Bổ sung cơ chế kiểm soát thời hạn và tính năng thu hồi tức thời qua bảng riêng `GUEST_LINK`. |
| **G1-01** | Cảnh báo Dọn dẹp Dự án | Admin Portal | Quy trình chuyển sang trạng thái `ARCHIVED` kèm thông báo cảnh báo trước 7 ngày thay vì xóa cứng. |
| **G2-01** | Kiểm tra Hợp lệ Đồ thị | Project Workspace | Tích hợp bắt buộc giải thuật Kahn phát hiện chu trình lặp trước khi cho phép kích hoạt dự án. |
| **G2-02** | Feedback Queue 1 chiều | Overview & Review Portal | Tích hợp khối Feedback Queue 1 chiều trên Overview, hiển thị theo mã Node, quy tắc tiếp thu 1 chiều (bỏ `reply_content`). |
| **G3-01** | Bộ nhớ đệm Kết quả AI | Review Portal & Execution Engine | Chuyển logic tính toán AI về Background Worker và lưu đệm vào cột JSONB `PROJECT.latest_ai_analysis`. |

### 8.2 Phân định Phạm vi Triển khai

#### Giai đoạn 1: Phạm vi Khả thi Tối thiểu (MVP Scope)
* Hiện thực dịch vụ xác thực trung tâm và quản lý quyền người dùng (`USERS`, `REFRESH_TOKEN`).
* Hiện thực chức năng thiết kế đồ thị hai pha (bản nháp `DRAFT` và bản chính thức `ACTIVE`).
* Xây dựng giải thuật Kahn kiểm tra tính hợp lệ của đồ thị DAG.
* Xây dựng máy trạng thái của nút với đầy đủ cơ chế mở khóa theo quy tắc AND-join và OR-join.
* Thực hiện bảng My Tasks cá nhân hóa theo mô hình Direct Push và quy trình nộp Artifact tùy chọn, nghiệm thu 4 cột chuẩn.
* Cung cấp cổng truy cập chỉ xem bằng mã Token tạm thời cho khách đánh giá (`GUEST_LINK`).

#### Giai đoạn 2: Phạm vi Mở rộng (Post-MVP Roadmap)
* Tích hợp tính năng AI tự động sinh cấu trúc quy trình từ văn bản mô tả tự nhiên theo cơ chế Human-in-the-loop.
* Xây dựng lịch sử thay đổi chi tiết của đồ thị phục vụ công tác đối soát và khôi phục phiên bản cũ (Audit Log & Rollback).
* Bổ sung tính năng quản trị nâng cao cho phép khóa hoặc mở tài khoản hàng loạt và xuất dữ liệu báo cáo chuyên sâu.

---

## PHẦN 9: QUY TẮC KỸ THUẬT DÀNH CHO CLAUDE CODE VÀ NHÀ PHÁT TRIỂN

Khi sử dụng tài liệu này để sinh mã nguồn, xây dựng API hoặc viết kiểm thử, cần tuân thủ nghiêm ngặt các quy chuẩn sau:

1. **Ánh xạ Kiểu dữ liệu Chuẩn:**
   * Các trường khóa chính `id` và khóa ngoại `*_id` trong cơ sở dữ liệu đều có kiểu `bigint`, tương ứng với kiểu `Long` trong ngôn ngữ Java / Spring Data JPA.
   * Các trường thời gian phải được định dạng theo chuẩn chuỗi ISO-8601 có múi giờ (`Instant` hoặc `OffsetDateTime` trong Java).
2. **Quản lý Thuộc tính JSONB:**
   * Các trường lưu trữ dạng JSONB bao gồm: `latest_ai_analysis` (trong `PROJECT`), `graph_data` (trong `PIPELINE_TEMPLATE`) và `ui_metadata` (trong `NODE`) phải được ánh xạ qua các lớp cấu trúc dữ liệu hoặc đối tượng DTO cụ thể, tránh xử lý dạng chuỗi thô không an toàn.
   * *(Lưu ý: Đã loại bỏ hoàn toàn thuộc tính JSONB `guest_access` do đã tách thành bảng riêng `GUEST_LINK`).*
3. **Bảo toàn Luồng Máy trạng thái:**
   * Mọi hành động chuyển trạng thái của nút đều phải được kiểm tra điều kiện tiên quyết và xác thực quyền hạn của vai trò người thực hiện thông qua lớp dịch vụ trung gian (Service Layer).
   * **Tuyệt đối không cập nhật trạng thái trực tiếp mà bỏ qua kiểm tra nghiệp vụ.**
   * Bắt buộc sử dụng `@Version` trên entity `Node` để kích hoạt cơ chế khóa lạc quan (Optimistic Locking), chống xung đột dữ liệu khi nhiều thành viên cùng thao tác.
