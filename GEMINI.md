# GEMINI.md — Central Hub & Agent Navigation Guide

> **Mục đích**: Đây là file "chỉ đường" trung tâm ([HUB]) dành cho AI Agent và các kỹ sư khi tiếp cận dự án **Workflow-Pipeline-Engine**. Luôn đọc file này đầu tiên để nắm bắt kiến trúc tổng thể, sơ đồ thư mục và quy tắc làm việc.

---

## 1. Cấu trúc Dự án (Project Topology)

```text
Workflow-Pipeline-Engine/
├── GEMINI.md                        <-- [HUB] File "chỉ đường" trung tâm (Agent đọc đầu tiên)
├── docs/
│   ├── specs/                       <-- [SPOKES - SSOT] Đặc tả chuẩn đã chốt 100%
│   │   ├── system-overview.md       (5 phân hệ & RBAC)
│   │   ├── database-schema.md       (12 bảng chuẩn 3NF & ERD Mermaid)
│   │   ├── workflow-engine.md       (State Machine 4 cột & Thuật toán Kahn)
│   │   ├── ai-diagnostics.md        (Cấu trúc JSON & Worker Gemini)
│   │   └── backend-architecture.md  (Kiến trúc phân tầng Spring Boot 3 & Cẩm nang thư mục)
│   ├── FRONTEND_BACKEND_INTEGRATION_MAP.md <-- [SSOT] Cẩm nang tích hợp FE-BE (27 chức năng & 10 cụm)
│   ├── frontend/                    <-- Specs màn hình & prototype demo (.html)
│   │   ├── screens/                 (Wireframes & layout specifications)
│   │   └── prototypes/              (Bản demo HTML độc lập trực quan)
│   └── archive/                     <-- Gom toàn bộ file nháp cũ (answered, note, old...)
│       ├── docs-demo/               (Tech specs cũ & audit reports)
│       └── docs_for_db_bfd/         (Q&A DB, Business logic sơ khai, Use cases)
├── wpe-frontend/                    <-- Source code React (Vite / TypeScript / Tailwind)
└── wpe-backend/                     <-- Source code Spring Boot
```

---

## 2. Bản đồ Tài liệu Đặc tả (Documentation Map & SSOT)

Toàn bộ thông số kỹ thuật chuẩn (Single Source of Truth - SSOT) nằm tại docs:

| Tài liệu | Mô tả | Liên kết |
| :--- | :--- | :--- |
| **System Overview & RBAC** | Kiến trúc 5 phân hệ cốt lõi & ma trận phân quyền RBAC | [system-overview.md](file:///c:/Users/Admin/Desktop/J2EE/Workflow-Pipeline-Engine/docs/specs/system-overview.md) |
| **Database Schema** | 12 bảng chuẩn hóa 3NF, ràng buộc toàn vẹn & Mermaid ERD | [database-schema.md](file:///c:/Users/Admin/Desktop/J2EE/Workflow-Pipeline-Engine/docs/specs/database-schema.md) |
| **Workflow Engine** | State Machine 4 cột trạng thái & Thuật toán Kahn (DAG Sort) | [workflow-engine.md](file:///c:/Users/Admin/Desktop/J2EE/Workflow-Pipeline-Engine/docs/specs/workflow-engine.md) |
| **AI Diagnostics** | Schema JSON chẩn đoán sự cố & Cơ chế Gemini Worker | [ai-diagnostics.md](file:///c:/Users/Admin/Desktop/J2EE/Workflow-Pipeline-Engine/docs/specs/ai-diagnostics.md) |
| **Backend Architecture** | Hướng dẫn phân tầng Spring Boot 3 & cẩm nang vận hành thư mục | [backend-architecture.md](file:///c:/Users/Admin/Desktop/J2EE/Workflow-Pipeline-Engine/docs/specs/backend-architecture.md) |
| **FE-BE Integration Map** | Cẩm nang tích hợp chi tiết 10 cụm nghiệp vụ, 27 tính năng, DTO & Error Map | [FRONTEND_BACKEND_INTEGRATION_MAP.md](file:///c:/Users/Admin/Desktop/J2EE/Workflow-Pipeline-Engine/docs/FRONTEND_BACKEND_INTEGRATION_MAP.md) |
| **Team Development Guide** | Nhập môn HTTP API & Swagger, hướng dẫn cài môi trường, luật chơi Flyway & troubleshooting | [TEAM_DEVELOPMENT_GUIDE.md](file:///c:/Users/Admin/Desktop/J2EE/Workflow-Pipeline-Engine/docs/TEAM_DEVELOPMENT_GUIDE.md) |

---

## 3. Lộ trình Đọc Tài liệu Chuẩn (Recommended Reading Roadmap)

> **Dành cho Người mới (Newbie Dev) & AI Agent khi bắt đầu phiên chat mới**: Để không bị "ngợp" hoặc hỏi lan man, **BẮT BUỘC** đọc tài liệu theo đúng thứ tự 5 bước dưới đây:

```text
[BƯỚC 1: BỨC TRANH TỔNG THỂ]
   GEMINI.md ───────────────► Nắm cấu trúc thư mục, triết lý dự án & bản đồ tài liệu.
       │
       ▼
[BƯỚC 2: NGHIỆP VỤ & PHÂN QUYỀN]
   system-overview.md ──────► Hiểu 5 phân hệ cốt lõi & Ma trận phân quyền 23 Use Case (RBAC).
       │
       ▼
[BƯỚC 3: CÀI ĐẶT MÔI TRƯỜNG & CHẠY THỬ]
   TEAM_DEVELOPMENT_GUIDE.md ► Cài JDK 17, bật Docker PostgreSQL, chạy Flyway & soi DBeaver.
       │
       ▼
[BƯỚC 4: QUY CHUẨN KIẾN TRÚC CODE]
   backend-architecture.md ──► Hiểu kiến trúc phân tầng (Entity, Repo, Service, DTO, Controller).
       │
       ▼
[BƯỚC 5: TRA CỨU KHI BẮT TAY VÀO CODE CỤ THỂ]
   ├── FRONTEND_BACKEND_INTEGRATION_MAP.md ──► [TRA CỨU API] Tra cứu 27 API, DTO & mã lỗi.
   ├── database-schema.md                  ──► [TRA CỨU DB] Tra cứu 12 bảng 3NF & ràng buộc khóa.
   ├── workflow-engine.md                  ──► [TRA CỨU ENGINE] Máy trạng thái FSM 5 bước & Thuật toán Kahn DAG.
   └── ai-diagnostics.md                   ──► [TRA CỨU AI] Schema JSON phân tích & Gemini Worker.
```

---

## 4. Kho Lưu trữ Lịch sử (Archive)

Khi cần tra cứu lý do đằng sau các quyết định thiết kế cũ, các câu trả lời phản biện hoặc code nháp:
- [docs/archive/README.md](file:///c:/Users/Admin/Desktop/J2EE/Workflow-Pipeline-Engine/docs/archive/README.md)
- [docs/archive/docs_for_db_bfd/](file:///c:/Users/Admin/Desktop/J2EE/Workflow-Pipeline-Engine/docs/archive/docs_for_db_bfd): Phân tích logic nghiệp vụ, Q&A cơ sở dữ liệu ban đầu.
- [docs/archive/docs-demo/](file:///c:/Users/Admin/Desktop/J2EE/Workflow-Pipeline-Engine/docs/archive/docs-demo): Báo cáo kiểm định kiến trúc và đặc tả frontend cũ.

---

## 5. Công nghệ & Nguyên tắc Cốt lõi (Tech Stack & Core Principles)

1. **Frontend**: React 18 (Vite / TypeScript / Modern UI / Zustand).
2. **Backend**: Java 17 + Spring Boot 3.2.4 (Spring Security, Spring Data JPA, RESTful API).
3. **Cơ sở dữ liệu**: PostgreSQL 15+ (chạy bằng Docker Compose, quản lý schema tự động qua Flyway).
4. **Mô hình Trạng thái**: State Machine 5 trạng thái (`LOCKED`, `TODO`, `IN_PROGRESS`, `REVIEW`, `DONE`) với **Strict Review Gate** (chỉ Owner được duyệt).
5. **Giải quyết Phụ thuộc (DAG)**: Thuật toán Kahn (Topological Sorting) để phát hiện chu trình (cycle detection) và tự động mở khóa downstream tasks (AND/OR join).
6. **AI Assistant**: Google Gemini API Worker phân tích log sự cố, tính toán đường găng CPM và lưu đệm vào cột `latest_ai_analysis` (JSONB).
7. **Message Broker (Event-Driven)**: RabbitMQ 3.13 (Spring AMQP) xử lý bất đồng bộ (Non-blocking) cho việc tự động mở khóa DAG downstream nodes, phát tín hiệu thông báo và xếp hàng phân tích AI mà không làm nghẽn kết nối RESTful API.
8. **Real-time Event Streaming (SSE)**: `SseEmitter` (Spring Web) duy trì kết nối HTTP Stream 1 chiều từ Server xuống Client. Khi RabbitMQ Worker hoàn thành mở khóa node con hoặc phát hiện thay đổi trạng thái, hệ thống đẩy trực tiếp sự kiện (`TASK_UNLOCKED`, `TASK_STATUS_CHANGED`, `NOTIFICATION_RECEIVED`) xuống trình duyệt mà không yêu cầu người dùng phải tự reload (F5) trang.

---

## 6. Quy tắc Hành xử cho AI Agent (Agent Rules of Engagement)

> **Cảnh báo dành cho AI Agent khi khởi động phiên chat mới**: Dự án này đã hoàn thiện 100% tài liệu đặc tả kiến trúc (SSOT). **TUYỆT ĐỐI KHÔNG HỎI LẠI** người dùng các câu hỏi về nghiệp vụ, cấu trúc bảng, hay các quyết định đã được chốt trong tài liệu. (hỏi cũng được nhưng mà nhớ là xứng đáng thì hãy hỏi, nó làm hệ thống bị dở đi thì hỏi)

1. **Luôn bắt đầu từ GEMINI.md**: Định vị chính xác phân hệ và file đặc tả liên quan trước khi đọc hoặc sửa code.
2. **SSOT là tối thượng**: Mọi cấu trúc Database (12 bảng), logic DAG Kahn (phát hiện chu trình, AND/OR join), State Machine 5 trạng thái (`LOCKED`, `TODO`, `IN_PROGRESS`, `REVIEW`, `DONE`) và 27 endpoint API phải tuân thủ nghiêm ngặt các file trong [docs/specs/](file:///c:/Users/Admin/Desktop/J2EE/Workflow-Pipeline-Engine/docs/specs) và [FRONTEND_BACKEND_INTEGRATION_MAP.md](file:///c:/Users/Admin/Desktop/J2EE/Workflow-Pipeline-Engine/docs/FRONTEND_BACKEND_INTEGRATION_MAP.md).
3. **Không tự ý sửa file Migration đã chạy**: Tuyệt đối không sửa `V1` và `V2` trong Flyway. Muốn đổi DB, tạo file mới `V3...`.
4. **Không xóa dữ liệu Archive**: Thư mục [docs/archive/](file:///c:/Users/Admin/Desktop/J2EE/Workflow-Pipeline-Engine/docs/archive) là dữ liệu đối chiếu lịch sử, không tự ý chỉnh sửa hay ghi đè.
5. **Đồng bộ hóa Tài liệu**: Khi cập nhật API hoặc logic mới, luôn cập nhật ngược lại đặc tả tương ứng trong `docs/specs/` và bản đồ `GEMINI.md`.
6. **Chuẩn mực Code Java/Spring Boot**:
   * **CẤM** dùng `@Data` trên JPA Entity (dùng `@Getter`, `@Setter`, `@NoArgsConstructor`, `@AllArgsConstructor`, `@Builder`).
   * **CẤM** trả thẳng JPA Entity ra ngoài Controller (bắt buộc dùng Java `record` DTO).
   * Dùng `@JdbcTypeCode(SqlTypes.JSON)` cho các trường JSONB (`ui_metadata`, `latest_ai_analysis`, `graph_data`).
   * **Kiến trúc Bất đồng bộ với RabbitMQ & Real-time SSE**: Các tác vụ tính toán nặng sau khi đổi trạng thái Task (như quét mở khóa node con DAG, phát thông báo, xếp hàng phân tích AI) bắt buộc bắn event qua `WorkflowEventPublisher` và xử lý ngầm tại `WorkflowEventConsumer.java`. Khi mở khóa hoặc đổi trạng thái, đẩy dữ liệu real-time qua `SseEmitterService` xuống trình duyệt mà không bắt người dùng phải F5. Tuyệt đối không để HTTP Request bị block quá 50ms.
   * Kiểm thử API tương tác trực tiếp qua Swagger UI: `http://localhost:8080/swagger-ui.html`.
   * Quản trị RabbitMQ trực quan qua Dashboard: `http://localhost:15672` (User/Pass: `wpe_rabbit` / `wpe_rabbit_pass`).
