# Workflow Pipeline Engine (WPE)

> **Hệ thống điều phối quy trình công việc thông minh theo mô hình Đồ thị có hướng không chu trình (DAG), State Machine 5 trạng thái với Cổng kiểm duyệt nghiêm ngặt (Strict Review Gate) và Trợ lý Chẩn đoán AI Gemini.**

---

## 🚀 Tính Năng Nổi Bật (Core Highlights)

- 🔄 **Workflow State Machine**: 5 trạng thái (`LOCKED` ➔ `TODO` ➔ `IN_PROGRESS` ➔ `REVIEW` ➔ `DONE`) với cơ chế **Strict Review Gate** (chỉ Owner dự án được phê duyệt/từ chối).
- 🕸️ **DAG Engine & Kahn Algorithm**: Tự động phát hiện chu trình (Cycle Detection), giải quyết phụ thuộc đa nhánh với chính sách gom nút (`AND` / `OR` Join) và tự động mở khóa downstream tasks khi tiền đề hoàn tất.
- 🤖 **AI Diagnostics Worker**: Tích hợp Google Gemini API tự động phân tích nút thắt cổ chai, log sự cố và đề xuất giải pháp kỹ thuật lưu trữ đệm trong JSONB.
- 👥 **Quản lý Không gian Dự án & RBAC**: Phân quyền chi tiết theo vai trò (`OWNER`, `COLLABORATOR`, `VIEWER`), chia sẻ báo cáo khách thông qua `GuestLink` có hạn sử dụng.
- 🗄️ **Chuẩn Hóa Database 3NF & Flyway**: 12 bảng thực thể chuẩn hóa, tự động tạo cấu trúc và nạp dữ liệu mẫu ban đầu qua Flyway migration trong 0.2 giây.
- 📖 **Interactive Swagger UI**: Kiểm thử API trực quan ngay trên trình duyệt mà không cần cài đặt Postman.

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

| Phân hệ | Công nghệ |
| :--- | :--- |
| **Backend** | Java 17, Spring Boot 3.2.4, Spring Data JPA, Spring Security, Flyway, MapStruct, Lombok, JJWT, SpringDoc OpenAPI 3 |
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons, Zustand |
| **Database** | PostgreSQL 15 Alpine (Dockerized) |
| **DevOps & Tooling** | Docker Desktop, Maven 3.9+, DBeaver, IntelliJ IDEA |

---

## ⚡ Hướng Dẫn Khởi Động Nhanh Trong 1 Phút (Quick Start)

### 1. Bật Database PostgreSQL (Docker)
```bash
cd wpe-backend
docker compose up -d
```
*(Database `wpe_db` sẽ khởi động ngầm trên cổng `5432`)*

### 2. Chạy Backend Spring Boot
Mở `wpe-backend` bằng IntelliJ IDEA và bấm **Run** file `WpeApplication.java`  
*(Hoặc dùng lệnh Terminal)*:
```bash
cd wpe-backend
mvn spring-boot:run
```
*Flyway sẽ tự động tạo đủ 12 bảng và nạp sẵn dữ liệu test.*

### 3. Mở Swagger UI để Test API
Truy cập ngay trên trình duyệt:  
👉 **[http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html)**

### 4. Chạy Frontend React (Tùy chọn)
```bash
cd wpe-frontend
npm install
npm run dev
```
Truy cập giao diện:  
👉 **[http://localhost:5173](http://localhost:5173)**

---

## 🔑 Tài Khoản Test Sẵn Có (Seed Accounts)

Hệ thống đã nạp sẵn 3 tài khoản trong database để nhóm test ngay:
* **Mật khẩu chung cho tất cả tài khoản**: `Password123!`

| Username | Email | Quyền Hệ thống | Quyền trong Project mẫu |
| :--- | :--- | :---: | :---: |
| `admin` | admin@pipeline.engine | `ADMIN` | — |
| `alex.kim` | alex.kim@pipeline.engine | `USER` | `OWNER` |
| `sarah.chen` | sarah.chen@pipeline.engine | `USER` | `COLLABORATOR` |

---

## 📚 Bản Đồ Tài Liệu Kỹ Thuật (Documentation Hub)

Toàn bộ tài liệu đặc tả chuẩn (SSOT) và hướng dẫn chi tiết nằm trong thư mục `docs/`:

- 🧭 **[GEMINI.md](file:///c:/Users/Admin/Desktop/J2EE/Workflow-Pipeline-Engine/GEMINI.md)**: File chỉ đường trung tâm dành cho AI Agent & Kỹ sư khi tiếp cận dự án.
- 👨‍💻 **[Cẩm Nang Cho Thành Viên Nhóm (TEAM_DEVELOPMENT_GUIDE.md)](file:///c:/Users/Admin/Desktop/J2EE/Workflow-Pipeline-Engine/docs/TEAM_DEVELOPMENT_GUIDE.md)**: Hướng dẫn cài đặt từ A-Z, bảng bắt bệnh FAQ và quy tắc Git.
- 🏛️ **[Kiến Trúc Backend Phân Tầng (backend-architecture.md)](file:///c:/Users/Admin/Desktop/J2EE/Workflow-Pipeline-Engine/docs/specs/backend-architecture.md)**: Cẩm nang tổ chức code Entity ➔ Repo ➔ Service ➔ DTO ➔ Controller.
- 🔌 **[Cẩm Nang Tích Hợp FE-BE (FRONTEND_BACKEND_INTEGRATION_MAP.md)](file:///c:/Users/Admin/Desktop/J2EE/Workflow-Pipeline-Engine/docs/FRONTEND_BACKEND_INTEGRATION_MAP.md)**: Danh sách 27 API, DTO và mã lỗi chuẩn.
- 🗄️ **[Cơ Sở Dữ Liệu 3NF & ERD (database-schema.md)](file:///c:/Users/Admin/Desktop/J2EE/Workflow-Pipeline-Engine/docs/specs/database-schema.md)**: Đặc tả chi tiết 12 bảng và ràng buộc toàn vẹn.
- ⚙️ **[Đặc Tả Động Cơ Quy Trình (workflow-engine.md)](file:///c:/Users/Admin/Desktop/J2EE/Workflow-Pipeline-Engine/docs/specs/workflow-engine.md)**: Máy trạng thái FSM & Thuật toán Kahn DAG.
- 🤖 **[Đặc Tả Trợ Lý AI (ai-diagnostics.md)](file:///c:/Users/Admin/Desktop/J2EE/Workflow-Pipeline-Engine/docs/specs/ai-diagnostics.md)**: Cấu trúc JSON & cơ chế worker Gemini.

---

## ⚖️ Giấy Phép & Đồ Án
Dự án được xây dựng phục vụ môn học **OOAD (Phân tích Thiết kế Hướng đối tượng)** và **J2EE (Lập trình Java Doanh nghiệp)**.
