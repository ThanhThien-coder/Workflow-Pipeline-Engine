# BÁO CÁO TIẾN ĐỘ ĐỒ ÁN GIỮA KỲ — PHÂN TÍCH THIẾT KẾ HỆ THỐNG (OOAD)

> **Môn học**: Phân tích & Thiết kế Hướng đối tượng (OOAD)  
> **Đề tài**: **Workflow-Pipeline-Engine (WPE)** — Nền tảng Quản trị & Điều phối Quy trình Kỹ thuật theo Mô hình Đồ thị DAG & Máy Trạng Thái FSM  
> **Thời điểm báo cáo**: Tuần 7 / 10 (Mốc chuyển giao OOD sang Triển khai Lập trình MVP)  
> **Hạn chót hoàn thành đồ án**: 15/11/2026 (Mốc Nộp Đồ án & Báo cáo Cuối kỳ)

---

## MỤC LỤC TỔNG QUAN

1. [PHẦN 1: TỔNG QUAN VỀ SẢN PHẨM & ĐỐI TƯỢNG HƯỚNG TỚI](#phần-1-tổng-quan-về-sản-phẩm--đối-tượng-hướng-tới)
   - 1.1 Bài toán thực tế & Lý do chọn đề tài
   - 1.2 Hệ thống Workflow-Pipeline-Engine là gì?
   - 1.3 Mục tiêu & Giá trị cốt lõi mang lại
   - 1.4 Chân dung đối tượng sử dụng (Target Personas & Actors)
2. [PHẦN 2: BÁO CÁO TIẾN ĐỘ CÔNG VIỆC (LỘ TRÌNH GANTT VS THỰC TẾ)](#phần-2-báo-cáo-tiến-độ-công-việc-lộ-trình-gantt-vs-thực-tế)
   - 2.1 Bảng đối chiếu tiến độ chi tiết theo Lộ trình 10 Tuần
   - 2.2 Những kết quả đã hoàn thành (Done)
   - 2.3 Những hạng mục còn thiếu & Đang triển khai (In Progress / Backlog)
   - 2.4 Đánh giá tỷ lệ hoàn thành (%) và Kế hoạch về đích
3. [PHẦN 3: KỊCH BẢN THUYẾT TRÌNH BÁO CÁO GIỮA KỲ THEO TỪNG SLIDE (SLIDE-BY-SLIDE BLUEPRINT) & SCRIPT](#phần-3-kịch-bản-thuyết-trình-báo-cáo-giữa-kỳ-theo-từng-slide-slide-by-slide-blueprint--script)
   - 3.1 Bảng Phân Bổ Thời Lượng & Cấu Trúc 12 Slides
   - 3.2 Chi Tiết Nội Dung Từng Slide & Lời Thoại Thuyết Minh (Speaker Script)
4. [PHẦN 4: CẨM NANG ÔN TẬP & PHÒNG THỦ ĐỒ ÁN OOAD CHO CẢ NHÓM](#phần-4-cẩm-nang-ôn-tập--phòng-thủ-đồ-án-ooad-cho-cả-nhóm)
   - 4.1 Bảng tra cứu các loại sơ đồ UML cốt lõi trong đồ án
   - 4.2 Chuyên đề: Lý thuyết & Quy tắc chuyển đổi Sequence Diagram ⇄ Collaboration Diagram
   - 4.3 Bộ câu hỏi "Bẫy" thường gặp của Giảng viên & Hướng trả lời chuẩn

---

# PHẦN 1: TỔNG QUAN VỀ SẢN PHẨM & ĐỐI TƯỢNG HƯỚNG TỚI

### 1.1 Bài toán thực tế & Lý do chọn đề tài
Trong các dự án kỹ thuật phần mềm, đồ án tốt nghiệp hoặc quy trình sản xuất đa công đoạn:
* **Sự phụ thuộc chéo phức tạp (Dependency Deadlock)**: Công việc B chỉ được bắt đầu khi Công việc A xong; Công việc C cần cả A và B hoàn tất (AND-join). Các công cụ truyền thống (Trello, Jira mức cơ bản) chỉ quản lý dạng thẻ phẳng (Flat Kanban), không thể hiện được luồng phụ thuộc có hướng, dẫn tới tình trạng thành viên làm trước các task chưa đủ điều kiện tiền đề.
* **Quy trình nghiệm thu lỏng lẻo**: Thiếu cổng kiểm duyệt sản phẩm bàn giao (Deliverables/Artifacts), dẫn tới việc thành viên tự ý kéo thẻ sang "Done" khi chưa được Trưởng nhóm/Chủ dự án thẩm định.
* **Giáo viên / Chuyên gia khó giám sát tiến độ**: Giáo viên muốn xem đồ án phải xin cấp tài khoản rườm rà, hoặc chỉ xem được báo cáo dạng text tĩnh mà không thấy được cấu trúc quy trình, điểm nghẽn và đường găng (Critical Path).

### 1.2 Hệ thống Workflow-Pipeline-Engine là gì?
**Workflow-Pipeline-Engine (WPE)** là nền tảng điều phối và thực thi quy trình kỹ thuật thông minh, hoạt động dựa trên 2 nguyên lý toán học và khoa học máy tính cốt lõi:
1. **Mô hình Đồ thị có hướng không chu trình (DAG - Directed Acyclic Graph)**: Biểu diễn toàn bộ quy trình dưới dạng các Node (Tác vụ) và Edge (Quan hệ phụ thuộc). Áp dụng **Thuật toán Kahn** để tự động phát hiện chu trình lặp (chống deadlock) và tính toán đường găng (CPM - Critical Path Method).
2. **Máy trạng thái hữu hạn (FSM - Finite State Machine)**: Quản lý nghiêm ngặt vòng đời của từng tác vụ qua 5 trạng thái (`LOCKED` ➔ `TODO` ➔ `IN_PROGRESS` ➔ `REVIEW` ➔ `DONE`) với cơ chế **Strict Review Gate** (Chỉ Chủ dự án mới có quyền duyệt sang `DONE`).

### 1.3 Mục tiêu & Giá trị cốt lõi mang lại
* **Tự động mở khóa tác vụ (Auto-unlocked Pipeline)**: Khi task tiền nhiệm được duyệt `DONE`, động cơ FSM tự động giải phóng điều kiện hội tụ (AND-join / OR-join) và chuyển các task kế tiếp từ `LOCKED` sang `TODO` mà không cần con người can thiệp thủ công.
* **Giao việc tức thì (Direct Push Model)**: Tác vụ mở khóa sẽ tự động xuất hiện trên bảng Kanban cá nhân (`My Tasks`) của đúng người được phân công (`assignedUserId === me`).
* **Kho liên kết minh chứng (Artifacts Hub)**: Quản lý sản phẩm bàn giao bằng URL tài nguyên ngoài (GitHub PR, Figma, Swagger, Docs), loại bỏ việc lưu trữ file vật lý nặng nề trên máy chủ.
* **Giám sát thông minh không cần tài khoản (Guest Share Gateway)**: Sinh liên kết chia sẻ mang Token bảo mật cao (64 ký tự) có thời hạn để Giáo viên truy cập trực tiếp xem tiến độ, xem báo cáo chẩn đoán AI và gửi góp ý 1 chiều.

### 1.4 Chân dung đối tượng sử dụng (Target Personas & Actors)

| Actor / Tác nhân | Vai trò trong hệ thống | Mục tiêu & Nhu cầu cốt lõi |
| :--- | :--- | :--- |
| **Project Owner** *(Trưởng nhóm / Chủ dự án)* | Toàn quyền quản trị Workspace | Thiết kế sơ đồ DAG trên Canvas SVG, phân công task, kiểm tra đường găng CPM, mời thành viên, **nghiệm thu bài nộp (Approve/Reject)** và tạo Guest Link cho giáo viên. |
| **Collaborator** *(Thành viên thực thi)* | Thực hiện các task được giao | Vào bảng **My Tasks** cá nhân, bấm `Start Task`, thực hiện công việc, nộp link minh chứng (Artifact URL + Handover Notes) để xin duyệt. |
| **Teacher / Guest** *(Giáo viên / Chuyên gia)* | Thẩm định & Giám sát tiến độ | Mở **Guest Link** (không cần đăng nhập), xem đồ thị DAG trực quan, đọc báo cáo phân tích AI Gemini, **gửi góp ý 1 chiều tại Feedback Queue**. |
| **Project Viewer** *(Người xem nội bộ)* | Thành viên quan sát trong dự án | Đọc tiến độ, xem cấu trúc quy trình, tra cứu tài liệu chung (Read-only). |
| **System Admin** *(Quản trị viên nền tảng)* | Vận hành toàn bộ hệ thống | Quản lý người dùng (Khóa/Mở tài khoản), quản trị kho mẫu quy trình chuẩn (**System Template Studio**), giám sát KPI hệ thống. |

---

# PHẦN 2: BÁO CÁO TIẾN ĐỘ CÔNG VIỆC (LỘ TRÌNH GANTT VS THỰC TẾ)

Dựa trên bản kế hoạch tiến độ 10 tuần ban đầu (Sơ đồ Gantt), nhóm đối chiếu tình hình triển khai thực tế tính đến thời điểm hiện tại (**Tuần 7 - 25/10/2026**):

```text
[TIẾN ĐỘ TỔNG THỂ 10 TUẦN - VỊ TRÍ HIỆN TẠI: TUẦN 7]
Tuần 1 - 2 : I. KHỞI TẠO    ████████████████████ [100% - XONG]
Tuần 3 - 5 : II. PHÂN TÍCH  ████████████████████ [100% - XONG - Mốc OOA]
Tuần 6 - 7 : III. THIẾT KẾ  ██████████████████░░ [ 95% - HOÀN THIỆN - Mốc OOD] ◄── [VỊ TRÍ HIỆN TẠI]
Tuần 8 - 9 : IV. LẬP TRÌNH  ██████████░░░░░░░░░░ [ 50% - ĐANG RÁP NỐI FE-BE - Mốc MVP]
Tuần 9 - 10: V. KIỂM THỬ    ░░░░░░░░░░░░░░░░░░░░ [  5% - CHUẨN BỊ TEST PLAN]
```

### 2.1 Bảng đối chiếu tiến độ chi tiết theo Lộ trình 10 Tuần

| Giai đoạn | Hạng mục theo Kế hoạch ban đầu | Tình trạng thực tế | Đánh giá & Ghi chú |
| :--- | :--- | :---: | :--- |
| **I. Khởi tạo** *(T1 - T2)* | - Khảo sát bài toán & BFD sơ đồ luồng<br>- Lập kế hoạch tiến độ Gantt | **100%** | Hoàn thành đúng hạn mốc Khởi tạo. |
| **II. Phân tích (OOA)** *(T3 - T5)* | - Mô hình Use Case tổng quát (23 UC)<br>- Đặc tả chi tiết Use Case (Specs)<br>- Sơ đồ Activity cho các luồng nghiệp vụ<br>- Xây dựng Domain Model | **100%** | Hoàn thành toàn diện mốc OOA. Đã chuẩn hóa ma trận RBAC và quy chuẩn 5 trạng thái FSM. |
| **III. Thiết kế (OOD)** *(T6 - T7)* | - Sơ đồ Sequence (17 sơ đồ tương tác)<br>- Sơ đồ State Machine (Máy trạng thái FSM)<br>- Thiết kế CSDL (12 bảng chuẩn 3NF)<br>- Sơ đồ Design Class Diagram<br>- Thiết kế Mockup UI/UX hoàn chỉnh | **95%** | **Đạt mốc OOD**. UI/UX đã được nâng cấp vượt tiến độ từ Mockup tĩnh thành **Interactive Prototype chạy trên trình duyệt** (Vite + React + Tailwind + SVG Bézier wires). |
| **IV. Lập trình (Code)** *(T7 - T9)* | - Dựng khung Spring Boot 3 Core Backend<br>- Dựng giao diện React 18 Canvas DAG<br>- Kết nối Google Gemini AI Diagnostics | **50%** | **Đang bám sát tiến độ**: Frontend đã xong toàn bộ giao diện Dual-View, Store Zustand và Mock Service Container. Backend đã tạo xong Entity, Flyway Migration, Repository, Controller Cụm 7, 8, 9. |
| **V. Kiểm thử & Đóng gói** *(T9 - T10)* | - Unit Test & System Integration Test<br>- Đóng gói Demo & Slide Báo cáo | **5%** | Đã chuẩn bị kịch bản kiểm thử API bằng Swagger và Test Data mẫu. |

### 2.2 Những kết quả đã hoàn thành (Done)
1. **Bộ tài liệu đặc tả chuẩn hóa (Single Source of Truth - SSOT)**:
   - Hệ thống 23 Use Case và Ma trận phân quyền 6 Actor chi tiết.
   - 12 Bảng CSDL quan hệ chuẩn 3NF, tích hợp JSONB linh hoạt (`ui_metadata`, `latest_ai_analysis`).
   - Đặc tả thuật toán Kahn kiểm tra chu trình đồ thị và FSM State Engine 5 bước.
2. **Giao diện người dùng (Frontend Interactive System)**:
   - Màn hình Canvas SVG Bézier kéo thả, hiển thị cụm Phase vĩ mô và Task vi mô.
   - Giao diện Dual-View: Chuyển đổi 1-click giữa Graph đồ thị và Kanban phân tầng.
   - Bảng `My Tasks` 4 cột phân quyền theo đúng ID người đăng nhập.
   - Module `GuestView` dành riêng cho Giáo viên thẩm định không cần đăng nhập.
   - Toàn bộ bảng điều khiển Quản trị viên `AdminPortal` (4 tab: Analytics, User, Workspaces, Template Studio).
3. **Kiến trúc phần mềm Clean Architecture**:
   - Áp dụng thành công cơ chế **Plug & Play Service Container (Dependency Injection)** trên Frontend, cho phép chuyển đổi giữa Chế độ Demo Mock và Server Thật chỉ bằng 1 dòng cờ cấu hình.

### 2.3 Những hạng mục còn thiếu & Đang triển khai (In Progress)
1. **Ráp nối API thật (Frontend - Backend Integration)**: Đang thay thế dần các Mock Service bằng HTTP Service gọi trực tiếp vào Spring Boot REST Controller theo tài liệu `FRONTEND_BACKEND_INTEGRATION_MAP.md`.
2. **Đấu nối Live Worker Gemini API**: Hoàn thiện Worker ngầm gửi dữ liệu DAG sang Google Gemini để sinh báo cáo phân tích tự động.
3. **Bộ kiểm thử tự động (Unit Test / Postman Test Collection)**: Kiểm thử tải và kiểm tra biên cho thuật toán Kahn phát hiện chu trình khi đồ thị có > 100 node.

### 2.4 Đánh giá tỷ lệ hoàn thành & Dự kiến về đích
* **Tỷ lệ hoàn thành tổng thể đồ án**: **~ 68%** (Tài liệu Phân tích Thiết kế đạt 95%, Lập trình & Prototype đạt 55%).
* **Thời gian dự kiến hoàn thành 100%**: Còn **20 - 22 ngày** (Dự kiến đóng gói toàn bộ và nghiệm thử nội bộ vào ngày **10/11/2026**, sẵn sàng bảo vệ chính thức vào **15/11/2026**).

---

# PHẦN 3: KỊCH BẢN THUYẾT TRÌNH BÁO CÁO GIỮA KỲ THEO TỪNG SLIDE (SLIDE-BY-SLIDE BLUEPRINT & SCRIPT)

> **Tổng thời lượng ước tính**: 12 - 15 phút  
> **Cấu trúc bộ Slide**: 12 Slides chuẩn mực học thuật, phân chia cân đối giữa Báo cáo Tiến độ OOAD và Trình chiếu Hiện thực hóa Sản phẩm (Live Demo).

---

### 3.1 Bảng Phân Bổ Thời Lượng & Cấu Trúc 12 Slides

| Slide | Tên Slide | Thời lượng | Trọng tâm nội dung & Minh chứng |
| :---: | :--- | :---: | :--- |
| **01** | Tiêu đề Đồ án & Giới thiệu Nhóm | 1.0 phút | Thông tin thành viên, đề tài Workflow-Pipeline-Engine |
| **02** | Đặt vấn đề & Lý do chọn đề tài (Pain Points) | 1.5 phút | 3 nút thắt: Deadlock phụ thuộc, Nghiệm thu lỏng lẻo, Giám sát khó khăn |
| **03** | Giải pháp Hệ thống: Đồ thị DAG & Máy trạng thái FSM | 1.5 phút | 2 trụ cột cốt lõi: DAG Kahn Engine & FSM 5 bước Strict Review Gate |
| **04** | Mô hình Tác nhân (Actors) & Phân quyền RBAC | 1.0 phút | 6 Actors, Ma trận phân quyền 23 Use Case |
| **05** | Báo cáo Tiến độ Lộ trình Gantt 10 Tuần (Thực tế Tuần 7) | 1.5 phút | Đối chiếu 5 giai đoạn: OOA 100%, OOD 95%, Code 50%, Tiến độ tổng ~68% |
| **06** | Trọng tâm Phân tích & Thiết kế OOAD (Mốc OOA & OOD) | 1.5 phút | State Machine FSM, Thuật toán Kahn, CSDL 12 bảng chuẩn 3NF |
| **07** | Kiến trúc Phần mềm & Cơ chế Chuyển đổi Plug & Play | 1.0 phút | Clean Architecture, Spring Boot 3 + React 18, DI Service Container |
| **08** | **LIVE DEMO 1**: Quản trị Workspace & Canvas DAG Dual-View | 2.0 phút | Tạo pipeline từ template, đồ thị SVG Bézier, Ghost Node liên-phase |
| **09** | **LIVE DEMO 2**: Bắt chu trình lặp (Kahn), CPM & AI Diagnostics | 1.5 phút | Thử nối dây lặp (bắn lỗi), tô sáng đường găng CPM, phân tích AI Gemini |
| **10** | **LIVE DEMO 3**: My Tasks Kanban & Cổng nghiệm thu Strict Review | 1.5 phút | Bắt đầu task ➔ Nộp link Artifact ➔ Owner duyệt ➔ Tự động mở khóa DAG |
| **11** | **LIVE DEMO 4**: Guest Gateway (Khách ngoài) & Feedback Queue 1 chiều | 1.0 phút | Mở Guest Link qua token 64 ký tự, xem tiến độ, gửi góp ý 1 chiều |
| **12** | Tổng kết Tiến độ, Khó khăn & Kế hoạch 3 Tuần Về đích | 1.0 phút | Kế hoạch hoàn thành Unit Test & MVP trước 10/11, sẵn sàng nộp 15/11 |
| **--** | **Hội đồng Phản biện & Q&A** | 3.0 - 5.0 phút | Trả lời chất vấn của Giảng viên (Dùng Phần 4 làm vũ khí phòng thủ) |

---

### 3.2 Chi Tiết Nội Dung Từng Slide & Lời Thoại Thuyết Minh (Speaker Script)

#### SLIDE 01: TRANG TIÊU ĐỀ & THÀNH VIÊN THỰC HIỆN
* **Thời lượng**: 1.0 phút
* **Bố cục & Nội dung trên Slide**:
  * Tên trường/khoa: Trường Đại học - Khoa Kỹ thuật Phần mềm.
  * Tên môn học: Phân tích & Thiết kế Hướng đối tượng (OOAD).
  * Tiêu đề đề tài: **Workflow-Pipeline-Engine (WPE)**.
  * Phụ đề: *Nền tảng Quản trị & Điều phối Quy trình Kỹ thuật theo Mô hình Đồ thị DAG & Máy Trạng Thái FSM*.
  * Thông tin Giảng viên hướng dẫn & Danh sách thành viên nhóm (Họ tên, MSSV, Phân công vai trò).
* **Lời thoại người thuyết trình (Speaker Script)**:
  > *"Kính thưa Thầy/Cô và các bạn, hôm nay nhóm chúng em xin phép được báo cáo tiến độ đồ án giữa kỳ môn Phân tích và Thiết kế Hướng đối tượng với đề tài: **Workflow-Pipeline-Engine**.  
  > Dự án của nhóm tập trung giải quyết bài toán quản trị và tự động hóa quy trình kỹ thuật dựa trên hai nền tảng toán học và kỹ thuật phần mềm cốt lõi là **Đồ thị có hướng không chu trình (DAG)** và **Máy trạng thái hữu hạn (FSM)**. Tính đến thời điểm hiện tại là Tuần thứ 7 của đồ án, nhóm đã hoàn thành toàn diện giai đoạn Phân tích OOA, cơ bản hoàn tất giai đoạn Thiết kế OOD và đã hiện thực hóa thành công một phiên bản chạy tương tác trực quan trên nền tảng Web."*

---

#### SLIDE 02: BÀI TOÁN THỰC TẾ & LÝ DO CHỌN ĐỀ TÀI (PAIN POINTS)
* **Thời lượng**: 1.5 phút
* **Bố cục & Nội dung trên Slide**:
  * 3 Khối so sánh (Thách thức thực tế vs Hậu quả):
    1. **Sự phụ thuộc chéo (Dependency Chaos)**: Công việc sau phụ thuộc công việc trước nhưng công cụ phẳng (Flat Kanban) không thể hiện được luồng luân chuyển ➔ Thành viên làm trước task chưa đủ điều kiện.
    2. **Nghiệm thu lỏng lẻo (No Review Gate)**: Thành viên tự ý kéo thẻ sang "Done" mà không cần nộp sản phẩm minh chứng ➔ Đồ án trễ hạn hoặc sản phẩm không đạt chất lượng.
    3. **Giám sát thụ động (Isolated Stakeholders)**: Giáo viên hướng dẫn hoặc chuyên gia muốn theo dõi phải xin cấp tài khoản rườm rà, chỉ đọc báo cáo tĩnh ➔ Không phát hiện được rủi ro đường găng (Critical Path).
* **Lời thoại người thuyết trình (Speaker Script)**:
  > *"Khi bắt đầu môn học, nhóm nhận thấy một vấn đề rất lớn trong các dự án đồ án hoặc quy trình phần mềm: Các công cụ như Trello hay Jira dạng cơ bản chỉ quản lý các thẻ công việc đơn lẻ. Khi Task B cần Task A xong mới được làm, hoặc Task C cần cả A và B cùng hoàn tất (AND-join), các công cụ phẳng không thể kiểm soát được. Thành viên rất dễ làm ẩu, tự ý kéo sang Done. Đồng thời, Thầy/Cô hướng dẫn muốn xem tiến độ thì rất khó tiếp cận trực tiếp.  
  > Chính vì vậy, nhóm quyết định xây dựng một Pipeline Engine chuyên biệt nhằm đưa tính kỷ luật kỹ thuật, tự động hóa mở khóa tác vụ và cổng nghiệm thu nghiêm ngặt vào quy trình làm việc nhóm."*

---

#### SLIDE 03: GIẢI PHÁP WPE — 2 TRỤ CỘT TOÁN HỌC & KỸ THUẬT CỐT LÕI
* **Thời lượng**: 1.5 phút
* **Bố cục & Nội dung trên Slide**:
  * Hình minh họa 2 trụ cột:
    * **Trụ cột 1: Đồ thị DAG (Directed Acyclic Graph)**: Cấu trúc 2 tầng (Phase vĩ mô ➔ Task vi mô); Thuật toán Kahn bắt chu trình; Ghost Node liên-phase.
    * **Trụ cột 2: Máy trạng thái FSM (5 Trạng thái Chuẩn)**: `LOCKED` ➔ `TODO` ➔ `IN_PROGRESS` ➔ `REVIEW` ➔ `DONE`.
  * Huy hiệu nguyên tắc: *Strict Review Gate (Chỉ Owner được duyệt)* & *Artifact Link Hub (Không lưu file vật lý)*.
* **Lời thoại người thuyết trình (Speaker Script)**:
  > *"Giải pháp của nhóm dựa trên 2 trụ cột chính:  
  > Thứ nhất là **Đồ thị DAG**: Mọi công việc được kết nối có hướng. Chúng em tích hợp thuật toán Kahn để đảm bảo đồ thị không bao giờ bị vòng lặp bế tắc (Deadlock) và tính toán đường găng CPM.  
  > Thứ hai là **Máy trạng thái FSM 5 bước**: Task khởi đầu ở trạng thái LOCKED, khi task cha hoàn thành thì tự mở khóa sang TODO. Khi làm xong, thành viên chỉ được nộp bài để chuyển sang REVIEW chứ tuyệt đối không được tự ý sang DONE. Chỉ duy nhất Chủ dự án (Project Owner) mới có quyền bấm Approve để chuyển sang DONE, từ đó hệ thống tự động giải phóng điều kiện mở khóa các task tiếp theo."*

---

#### SLIDE 04: MÔ HÌNH TÁC NHÂN (ACTORS) & MA TRẬN PHÂN QUYỀN RBAC
* **Thời lượng**: 1.0 phút
* **Bố cục & Nội dung trên Slide**:
  * Sơ đồ phân cấp 6 Tác nhân:
    * `Anonymous User` ➔ `Project Viewer` ➔ `Collaborator` ➔ `Project Owner`.
    * Hai nhánh độc lập: `System Admin` (Quản trị nền tảng) & `Guest via Token` (Khách / Giáo viên).
  * Con số thống kê: **23 Use Cases cốt lõi** được chuẩn hóa trên Ma trận phân quyền RBAC.
* **Lời thoại người thuyết trình (Speaker Script)**:
  > *"Về mặt mô hình hóa tác nhân, hệ thống phân định rõ ràng 6 vai trò. Đáng chú ý là sự kế thừa quyền hạn: Collaborator kế thừa Viewer, Owner kế thừa Collaborator.  
  > Hai tác nhân rất đặc biệt là: **System Admin** — chỉ quản trị cấp cao như User và Kho mẫu quy trình chuẩn (Template Studio) mà không can thiệp vào task nội bộ; và **Guest via Token** — dành riêng cho Giáo viên truy cập qua liên kết mang Token bảo mật cao 64 ký tự để xem tiến độ mà không cần tạo tài khoản."*

---

#### SLIDE 05: ĐỐI CHIẾU TIẾN ĐỘ THEO LỘ TRÌNH GANTT 10 TUẦN
* **Thời lượng**: 1.5 phút
* **Bố cục & Nội dung trên Slide**:
  * Chèn ảnh **Sơ đồ Gantt Kế hoạch 10 Tuần**.
  * Bảng con số tiến độ thực tế tại Tuần 7:
    * Giai đoạn I (Khởi tạo): **100%** (Xong BFD, Gantt).
    * Giai đoạn II (Phân tích OOA): **100%** (23 Use Case specs, Activity Diagrams, Domain Model).
    * Giai đoạn III (Thiết kế OOD): **95%** (Sequence 17 sơ đồ, State Machine, CSDL 12 bảng 3NF, UI/UX Prototype).
    * Giai đoạn IV (Lập trình MVP): **50%** (React Dual-View Canvas, Spring Boot 3 Core).
    * **Tiến độ tổng thể**: **~ 68%** | **Dự kiến hoàn thành**: **20 - 22 ngày** (Trước 15/11/2026).
* **Lời thoại người thuyết trình (Speaker Script)**:
  > *"Đối chiếu với lộ trình Gantt 10 tuần mà nhóm đã cam kết, tính đến hôm nay (Tuần 7), nhóm đã hoàn thành 100% mốc OOA và 95% mốc OOD.  
  > Điểm đặc biệt là ở mốc Mockup UI/UX, nhóm đã chủ động đẩy mạnh tiến độ: Thay vì chỉ dừng lại ở bản vẽ tĩnh Figma, nhóm đã hiện thực hóa thành **Interactive Prototype hoàn chỉnh chạy trên Web** với công nghệ React 18, Zustand Store và SVG Bézier. Tổng tiến độ toàn đồ án hiện đạt khoảng 68%, hoàn toàn đảm bảo tiến độ đóng gói thử nghiệm vào ngày 10/11 và nộp chính thức vào 15/11."*

---

#### SLIDE 06: TRỌNG TÂM THIẾT KẾ OOAD (OOA & OOD HIGHLIGHTS)
* **Thời lượng**: 1.5 phút
* **Bố cục & Nội dung trên Slide**:
  * Trích xuất các sơ đồ kỹ thuật tiêu biểu:
    * Hình 1: Sơ đồ Máy trạng thái FSM 5 bước (`State Machine Diagram`).
    * Hình 2: Trực quan hóa Thuật toán Kahn kiểm tra chu trình đồ thị DAG.
    * Hình 3: Cấu trúc CSDL 12 bảng chuẩn hóa 3NF kết hợp cột JSONB linh hoạt.
* **Lời thoại người thuyết trình (Speaker Script)**:
  > *"Về mặt học thuật OOAD, nhóm đã hoàn thiện toàn bộ các lược đồ tiêu chuẩn:  
  > Bắt đầu từ 23 đặc tả Use Case chi tiết, sơ đồ Hoạt động Activity phân làn, đến 17 lược đồ Tuần tự Sequence biểu diễn chính xác luồng dữ liệu giữa Actor, Frontend, Backend API và CSDL.  
  > Đồ thị trạng thái State Machine của Task được ràng buộc chặt chẽ với các điều kiện logic Guard Condition, bảo đảm tính toàn vẹn nghiệp vụ trước khi bước vào giai đoạn code sâu."*

---

#### SLIDE 07: CHUYỂN GIAO THỰC THI — KIẾN TRÚC PHẦN MỀM & LIVE DEMO
* **Thời lượng**: 1.0 phút
* **Bố cục & Nội dung trên Slide**:
  * Sơ đồ Phân tầng Clean Layered Architecture:
    * `React View` ➔ `Zustand Store` ➔ `Service Container (DI)` ➔ `Spring Boot Controller` ➔ `Service & DAG Engine` ➔ `PostgreSQL`.
  * Khẩu hiệu chuyển tiếp: *"Từ Mô hình Phân tích đến Sản phẩm Thực tế"* ➔ Bắt đầu phiên Live Demo.
* **Lời thoại người thuyết trình (Speaker Script)**:
  > *"Để chứng minh tính khả thi của bản thiết kế OOAD, nhóm đã áp dụng mô hình Clean Architecture và Dependency Injection. Kiến trúc này cho phép hệ thống cắm - rút linh hoạt giữa Mock Service và API Backend thật chỉ qua 1 dòng cấu hình.  
  > Ngay sau đây, nhóm xin phép được mở trực tiếp sản phẩm trên trình duyệt để demo 4 luồng nghiệp vụ cốt lõi nhất trước Thầy/Cô."*

---

#### SLIDE 08 [DEMO 1]: QUẢN TRỊ WORKSPACE & THIẾT KẾ DAG CANVAS
* **Thời lượng**: 2.0 phút
* **Hành động Live Demo trên máy chiếu**:
  1. Đăng nhập tài khoản `Project Owner`.
  2. Bấm `+ New Pipeline` ➔ Chọn mẫu `SDLC Standard Pipeline` từ thư viện template ➔ Bấm Tạo.
  3. Mở Canvas thiết kế quy trình đồ thị: Giới thiệu các Phase lớn và Task con.
  4. Nối đường dây cong Bézier SVG giữa 2 node.
  5. Thao tác thêm `Ghost Node` để nối phụ thuộc từ Task của Phase này sang Phase khác.
* **Lời thoại người thuyết trình (Speaker Script)**:
  > *"Đầu tiên, Chủ dự án tạo một pipeline mới từ kho mẫu chuẩn. Toàn bộ cấu trúc được clone tự động.  
  > Trên giao diện Canvas DAG, quy trình được phân tầng 2 lớp: Tầng vĩ mô là Phase và tầng vi mô là Task. Để giải quyết bài toán nối phụ thuộc giữa 2 phase khác nhau mà không làm rối đồ thị, hệ thống đưa ra giải pháp **Ghost Node** — đóng vai trò như một Proxy Node đại diện, bảo đảm tính độc lập mô-đun trong thiết kế hướng đối tượng."*

---

#### SLIDE 09 [DEMO 2]: BẮT VÒNG LẶP (THUẬT TOÁN KAHN), CPM & TRỢ LÝ AI
* **Thời lượng**: 1.5 phút
* **Hành động Live Demo trên máy chiếu**:
  1. Cố tình kéo 1 đường nối từ Task cuối quay ngược về Task đầu tạo thành vòng lặp kín (A ➔ B ➔ C ➔ A).
  2. Bấm nút *Kiểm tra đồ thị / Kích hoạt* ➔ Hệ thống lập tức bật Modal cảnh báo: `Phát hiện chu trình lặp (Cycle Detected)`.
  3. Xóa đường dây lặp, bấm nút *AI Diagnostics* ➔ Hệ thống tô sáng các node thuộc **Đường găng (Critical Path)** màu đỏ và hiển thị phân tích điểm nghẽn của Gemini Assistant.
* **Lời thoại người thuyết trình (Speaker Script)**:
  > *"Tiếp theo, nhóm xin minh họa cơ chế bảo vệ của Thuật toán Kahn: Khi em cố tình nối một dây phụ thuộc ngược tạo thành chu trình lặp kín, thuật toán duyệt bậc vào (in-degree) phát hiện chu trình ngay lập tức và từ chối xuất bản. Điều này loại trừ 100% nguy cơ Deadlock khi vận hành.  
  > Đồng thời, khi bấm AI Diagnostics, hệ thống tính toán đường găng CPM dài nhất, giúp Chủ dự án biết được những công việc nào nếu chậm trễ 1 ngày thì cả dự án sẽ bị chậm 1 ngày."*

---

#### SLIDE 10 [DEMO 3]: BẢNG MY TASKS & CỔNG NGHIỆM THU STRICT REVIEW GATE
* **Thời lượng**: 1.5 phút
* **Hành động Live Demo trên máy chiếu**:
  1. Đổi sang tài khoản Thành viên (`Collaborator`).
  2. Vào màn hình `My Tasks`: Thấy đúng các task được giao cho mình (Direct Push Model).
  3. Bấm *Start Task* ➔ Task chuyển từ `TODO` sang `IN_PROGRESS`.
  4. Bấm *Submit Deliverable*: Điền loại tài nguyên (GitHub PR), URL và Handover Notes ➔ Task chuyển sang `REVIEW`.
  5. Đổi lại tài khoản `Owner`: Mở phần Review ➔ Bấm *Approve* ➔ Task thành `DONE` ➔ Task con phụ thuộc tự động chuyển từ `LOCKED` sang `TODO`.
* **Lời thoại người thuyết trình (Speaker Script)**:
  > *"Bây giờ nhóm chuyển sang góc nhìn của Thành viên: Thành viên chỉ thấy các việc thuộc trách nhiệm của mình trên bảng Kanban cá nhân.  
  > Khi làm xong, thành viên bắt buộc phải nộp link Artifact minh chứng (như link GitHub PR hay Figma) và chuyển sang REVIEW. Thành viên không thể tự ý bấm Done.  
  > Khi Chủ dự án kiểm tra sản phẩm và bấm Approve, máy trạng thái FSM ngầm lập tức giải phóng điều kiện AND-join, tự động mở khóa các node con tiếp theo từ LOCKED sang TODO mà không cần thao tác thủ công."*

---

#### SLIDE 11 [DEMO 4]: CỔNG CHIA SẺ GUEST GATEWAY & FEEDBACK 1 CHIỀU
* **Thời lượng**: 1.0 phút
* **Hành động Live Demo trên máy chiếu**:
  1. Tại tài khoản Owner: Vào `Settings` ➔ Bấm *Generate Guest Link* (hiển thị chuỗi token 64 ký tự).
  2. Mở trình duyệt ẩn danh (Incognito), dán đường link ➔ Giao diện `GuestView` hiển thị đầy đủ tiến độ và DAG (Read-only).
  3. Nhập một nhận xét vào khung *Send Feedback* và gửi.
  4. Quay lại màn hình Owner: Mở mục *Feedback Queue*, thấy nhận xét xuất hiện và nhấn nút *Mark as Resolved*.
* **Lời thoại người thuyết trình (Speaker Script)**:
  > *"Cuối cùng là Cổng chia sẻ dành cho Giáo viên hướng dẫn. Thầy/Cô chỉ cần click vào Guest Link mang mã Token bảo mật có thời hạn, không cần đăng nhập vẫn nắm được toàn bộ tiến độ và đồ thị quy trình.  
  > Khi Thầy/Cô gửi góp ý, dữ liệu đẩy về hàng đợi Feedback Queue. Nhóm thực thi tuân thủ nguyên tắc 'Tiếp thu một chiều': Đọc góp ý, tiếp thu công việc và bấm 'Mark as Resolved', không có cơ chế nhắn tin tranh luận ngược lại, đảm bảo tính chuẩn mực trong hướng dẫn đồ án."*

---

#### SLIDE 12: ĐÁNH GIÁ TIẾN ĐỘ, KHÓ KHĂN & KẾ HOẠCH 3 TUẦN VỀ ĐÍCH
* **Thời lượng**: 1.0 phút
* **Bố cục & Nội dung trên Slide**:
  * 2 Khó khăn kỹ thuật đã vượt qua (Thuật toán Kahn đa tầng, SVG Bézier kết nối mượt mà).
  * Kế hoạch 3 tuần nước rút (Tuần 8 ➔ Tuần 10):
    * **Tuần 8 (26/10 - 01/11)**: Hoàn tất ráp nối toàn bộ 27 API Backend Spring Boot theo Contract Map.
    * **Tuần 9 (02/11 - 08/11)**: Đấu nối Live Gemini Worker & Viết bộ kiểm thử Unit Test / Testcontainers.
    * **Tuần 10 (09/11 - 15/11)**: Đóng gói Docker, nghiệm thử người dùng (User Acceptance Test) và nộp đồ án hoàn chỉnh.
* **Lời thoại người thuyết trình (Speaker Script)**:
  > *"Để đạt được kết quả hôm nay, nhóm đã vượt qua thách thức lớn về xử lý thuật toán đồ thị và đồng bộ trạng thái FSM thời gian thực.  
  > Trong 3 tuần còn lại, nhóm sẽ tập trung 100% sức lực để nối API Backend thực tế, viết Unit Test đạt độ bao phủ tiêu chuẩn và đóng gói Docker container hoàn chỉnh để nộp đồ án vào ngày 15/11 tới."*

---

#### SLIDE 13: LỜI CẢM ƠN & PHẦN HỎI ĐÁP (Q&A)
* **Thời lượng**: 0.5 phút (+ 3 - 5 phút phản biện của Hội đồng)
* **Bố cục & Nội dung trên Slide**:
  * Dòng chữ: *"Xin chân thành cảm ơn Thầy/Cô đã lắng nghe!"*
  * Thông tin liên hệ nhóm & Mã QR liên kết tới GitHub Repository / Swagger API Docs.
  * Sẵn sàng tài liệu BTH5-7 để mở ngay khi Giảng viên chất vấn.
* **Lời thoại người thuyết trình (Speaker Script)**:
  > *"Trên đây là toàn bộ báo cáo tiến độ đồ án giữa kỳ của nhóm. Chúng em xin trân trọng cảm ơn Thầy/Cô đã dành thời gian theo dõi. Nhóm rất mong nhận được những góp ý quý báu từ Thầy/Cô và sẵn sàng trả lời các câu hỏi phản biện ạ!"*


---

# PHẦN 4: CẨM NANG ÔN TẬP & PHÒNG THỦ ĐỒ ÁN OOAD CHO CẢ NHÓM

> [!IMPORTANT]
> **Dành cho tất cả thành viên trong nhóm**: Khi giảng viên mở tài liệu BTH5-7 lên hỏi bất kỳ sơ đồ nào, toàn đội phải nắm chắc các định nghĩa và nguyên lý chuyển đổi dưới đây để trả lời dứt khoát, đồng nhất.

### 4.1 Bảng tra cứu các loại sơ đồ UML cốt lõi trong đồ án

| Loại sơ đồ | Tên tiếng Anh | Thuộc nhóm | Mục đích trong đồ án WPE |
| :--- | :--- | :--- | :--- |
| **Sơ đồ Use Case** | Use Case Diagram | Hành vi (Behavior) | Khái quát 23 chức năng của hệ thống và phạm vi phân quyền của 6 Actor (RBAC). |
| **Đặc tả Use Case** | Use Case Specification | Tài liệu mô tả | Đặc tả chi tiết từng bước: Tiền điều kiện, Luồng chính, Luồng phụ, Hậu điều kiện của từng tính năng. |
| **Sơ đồ Hoạt động** | Activity Diagram | Hành vi (Behavior) | Mô tả dòng dữ liệu và luồng điều khiển nghiệp vụ (quy trình nộp bài, kích hoạt pipeline, xử lý feedback). |
| **Sơ đồ Tuần tự** | Sequence Diagram | Tương tác (Interaction) | Mô tả chi tiết việc truyền nhận thông điệp (Messages) giữa các đối tượng theo **trục thời gian thẳng đứng**. |
| **Sơ đồ Giao tiếp** | Collaboration / Communication | Tương tác (Interaction) | Mô tả tương tác giữa các đối tượng nhấn mạnh vào **cấu trúc liên kết không gian** và số thứ tự thông điệp. |
| **Sơ đồ Máy trạng thái**| State Machine Diagram | Hành vi (Behavior) | Mô tả vòng đời và các điều kiện chuyển trạng thái của Task (`LOCKED` ➔ `TODO` ➔ `IN_PROGRESS` ➔ `REVIEW` ➔ `DONE`). |
| **Sơ đồ Lớp** | Design Class Diagram | Cấu trúc (Structure) | Thể hiện các lớp đối tượng, thuộc tính, phương thức và mối quan hệ (Inheritance, Association, Dependency). |

---

### 4.2 Chuyên đề: Lý thuyết & Quy tắc chuyển đổi Sequence Diagram ⇄ Collaboration Diagram

Đây là **câu hỏi kinh điển của các giảng viên bộ môn OOAD**. Giảng viên thường chỉ vào một sơ đồ Sequence và yêu cầu: *"Vẽ lại sơ đồ này dưới dạng Collaboration Diagram (hoặc ngược lại) và giải thích sự khác nhau!"*

```text
       ┌─────────────────────────────────────────────────────────┐
       │             HAI MẶT CỦA MỘT ĐỒNG XU (ISOMORPHIC)        │
       ├────────────────────────────┬────────────────────────────┤
       │      SEQUENCE DIAGRAM      │   COLLABORATION DIAGRAM    │
       │   (Nhấn mạnh THỜI GIAN)    │    (Nhấn mạnh KHÔNG GIAN)  │
       │                            │                            │
       │   Lifeline A   Lifeline B  │       [Object A]           │
       │       │            │       │           │                │
       │       │──msg 1.0──>│       │      1.0: msg()            │
       │       │            │       │           ▼                │
       │       │<─msg 1.1───│       │       [Object B]           │
       │       ▼ (Thời gian trôi)   │                            │
       └────────────────────────────┴────────────────────────────┘
```

#### 1. Bản chất lý thuyết
* Cả hai sơ đồ đều thuộc nhóm **Interaction Diagrams (Sơ đồ tương tác)** trong UML.
* Chúng có tính chất **đẳng cấu ngữ nghĩa (Isomorphic)**: Nghĩa là chứa cùng một lượng thông tin như nhau về các đối tượng và các thông điệp trao đổi, chỉ khác nhau ở **góc độ biểu diễn trực quan**.
  * **Sequence Diagram**: Ưu tiên thể hiện **thứ tự thời gian** (Time sequence). Trục tung hướng từ trên xuống dưới biểu diễn thời gian trôi đi.
  * **Collaboration Diagram**: Ưu tiên thể hiện **mối quan hệ cấu trúc không gian** (Spatial organization) giữa các đối tượng tham gia tương tác.

#### 2. Quy tắc chuyển đổi từ Sequence Diagram ➔ Collaboration Diagram
Khi muốn chuyển một sơ đồ Tuần tự sang sơ đồ Giao tiếp:
* **Bước 1 (Xác định Đối tượng)**: Lấy tất cả các đối tượng (Lifelines) trên Sequence Diagram vẽ thành các hình chữ nhật (Object nodes) trên mặt phẳng.
* **Bước 2 (Thiết lập Liên kết)**: Nếu giữa Đối tượng A và Đối tượng B có ít nhất một mũi tên gửi thông điệp qua lại trên Sequence Diagram, vẽ một đường liên kết (Link line) nối A và B.
* **Bước 3 (Đánh số thứ tự thông điệp)**: 
  * Thay vì vẽ mũi tên ngang theo chiều từ trên xuống dưới, ta đặt mũi tên chỉ hướng nằm dọc theo đường liên kết.
  * **Quy tắc đánh số phân cấp (Nested Decimal Numbering)**: Ghi nhãn thông điệp theo cú pháp: `Số_thứ_tự: Tên_hàm(tham_số)`.
    - Thông điệp chính: `1: Đăng nhập()`, `2: Kiểm tra mật khẩu()`.
    - Thông điệp lồng nhau (gọi tiếp theo từ thông điệp trước): `1.1: Tìm user theo email()`, `1.2: So sánh chuỗi hash()`.

#### 3. Quy tắc chuyển đổi từ Collaboration Diagram ➔ Sequence Diagram
Khi muốn chuyển một sơ đồ Giao tiếp sang sơ đồ Tuần tự:
* **Bước 1**: Đặt các đối tượng thành một hàng ngang ở đầu trang, từ mỗi đối tượng kẻ một đường nét đứt thẳng đứng xuống dưới (**Lifeline**).
* **Bước 2**: Nhìn vào **số thứ tự thông điệp** trên các đường liên kết của Collaboration Diagram (`1, 1.1, 1.2, 2, 2.1...`).
* **Bước 3**: Vẽ lần lượt các mũi tên thông điệp từ Lifeline của đối tượng gửi sang Lifeline của đối tượng nhận, xếp tuần tự từ đỉnh trang dần xuống chân trang theo đúng thứ tự số đã đánh.

#### 4. Bảng so sánh ưu - nhược điểm khi trả lời vấn đáp

| Tiêu chí | Sequence Diagram (Sơ đồ Tuần tự) | Collaboration Diagram (Sơ đồ Giao tiếp) |
| :--- | :--- | :--- |
| **Trọng tâm thể hiện** | Thứ tự thời gian của các lời gọi hàm. | Cấu trúc quan hệ mạng lưới giữa các đối tượng. |
| **Ưu điểm lớn nhất** | Rất trực quan để lập trình viên nhìn vào viết code xử lý tuần tự (dễ map vào Controller ➔ Service ➔ Repo). | Dễ dàng nhận diện đối tượng nào là trung tâm (Hub/God Object) nhận quá nhiều liên kết để tái cấu trúc thiết kế. |
| **Nhược điểm** | Khi có quá nhiều đối tượng tham gia, sơ đồ bị bè ngang rất rộng và khó đọc. | Khi luồng nghiệp vụ phức tạp, việc dò theo các con số `1.2.1, 1.2.2` rất dễ rối mắt và mất dấu thời gian. |

---

### 4.3 Bộ câu hỏi "Bẫy" thường gặp của Giảng viên & Hướng trả lời chuẩn

#### ❓ Câu hỏi 1: *"Tại sao hệ thống của các em lại dùng thuật toán Kahn mà không dùng DFS để kiểm tra chu trình đồ thị?"*
> **Trả lời chuẩn**:  
> *"Dạ thưa Thầy/Cô, cả Kahn và DFS đều có độ phức tạp là $O(V + E)$ để phát hiện chu trình. Tuy nhiên, hệ thống của chúng em chọn **Thuật toán Kahn** vì 2 lý do quyết định:  
> 1. Kahn hoạt động dựa trên cơ chế xóa dần các đỉnh có bậc vào bằng 0 (`in-degree == 0`), thuật toán này trả về chính xác **Thứ tự Tô-pô (Topological Sort)** — đây chính là thứ tự kích hoạt mở khóa thực thi của các task trong thực tế.  
> 2. DFS dùng đệ quy, khi đồ thị lớn có thể dẫn tới tràn ngăn xếp (Stack Overflow), trong khi Kahn dùng hàng đợi (Queue) lặp tuần tự nên an toàn và tối ưu tuyệt đối cho kiến trúc Web Backend."*

#### ❓ Câu hỏi 2: *"Cổng nghiệm thu Strict Review Gate khác gì với việc kéo thả thẻ trên Trello thông thường?"*
> **Trả lời chuẩn**:  
> *"Dạ thưa Thầy/Cô, trên Trello thông thường, mọi thành viên đều có thể tự do kéo thẻ từ 'In Progress' sang 'Done'. Nhưng trong các dự án kỹ thuật nghiêm ngặt, việc này dẫn tới rủi ro nộp ẩu hoặc gian lận tiến độ.  
> Hệ thống của chúng em thiết lập **Cổng nghiệm thu nghiêm ngặt (Strict Review Gate)**: Thành viên chỉ được kéo sang `REVIEW` kèm link Artifact minh chứng. Duy nhất tài khoản có vai trò `OWNER` mới có quyền kích hoạt chuyển sang `DONE`. Nếu từ chối, Owner bắt buộc phải nhập lý do (`reject_reason`) để task bị trả ngược về `IN_PROGRESS` làm lại."*

#### ❓ Câu hỏi 3: *"Tại sao trong Use Case và CSDL không có chức năng Upload file `.zip`, `.pdf` mà chỉ lưu link URL?"*
> **Trả lời chuẩn**:  
> *"Dạ thưa Thầy/Cô, đây là quyết định kiến trúc có chủ đích (Design Trade-off) dựa trên mô hình **Artifact Hub**:  
> 1. Tránh biến máy chủ Backend thành nơi chứa mã độc hoặc file rác gây quá tải dung lượng ổ cứng.  
> 2. Các sản phẩm kỹ thuật thực tế ngày nay đều nằm trên các nền tảng chuyên dụng: Code nằm trên GitHub PR, bản vẽ nằm trên Figma, tài liệu API nằm trên Swagger/Postman, báo cáo nằm trên Google Docs.  
> Do đó, hệ thống chỉ quản lý Metadata và URL liên kết, vừa an toàn, nhẹ hệ thống, vừa liên kết trực tiếp tới môi trường làm việc thật của kỹ sư."*

#### ❓ Câu hỏi 4: *"Sơ đồ State Machine của các em có mấy trạng thái? Trạng thái LOCKED khác TODO chỗ nào?"*
> **Trả lời chuẩn**:  
> *"Dạ thưa Thầy/Cô, State Machine của chúng em có đúng **5 trạng thái**: `LOCKED`, `TODO`, `IN_PROGRESS`, `REVIEW`, `DONE`.  
> Sự khác biệt cốt lõi:  
> - `LOCKED`: Task đang bị khóa vì các task tiền nhiệm trong đồ thị DAG chưa hoàn thành (chưa thỏa mãn AND-join). Thành viên không thể bấm Start.  
> - `TODO`: Khi tất cả các task tiền nhiệm đã được Owner duyệt `DONE`, động cơ FSM tự động chuyển task con sang `TODO`. Lúc này task đã sẵn sàng và thành viên mới được phép bấm nút 'Start Task' để bắt đầu làm việc."*

---

### PHẦN KẾT: HÀNH ĐỘNG CỦA CẢ NHÓM TRƯỚC BUỔI BÁO CÁO
1. **Luyện tập trình diễn Demo (10 - 15 phút)**: Thực hành theo đúng 5 bước tại [Phần 3](#phần-3-kịch-bản-báo-cáo--trình-chiếu-demo-frontend-live-demo-script), một bạn thao tác click chuột mượt mà, một bạn thuyết minh lời thoại dứt khoát.
2. **Mỗi thành viên tự đọc kỹ [Phần 4](#phần-4-cẩm-nang-ôn-tập--phòng-thủ-đồ-án-ooad-cho-cả-nhóm)** để nắm chắc cách đổi Sequence sang Collaboration và phản xạ nhanh các câu hỏi vặn của Giảng viên.
3. **Mở sẵn 2 tab trình duyệt**: 1 tab là Frontend chạy thực tế (`http://localhost:5173`), 1 tab là Swagger UI API Backend (`http://localhost:8080/swagger-ui.html`) để chứng minh hệ thống đã có code chạy thật.
