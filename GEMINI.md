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
│   │   └── ai-diagnostics.md        (Cấu trúc JSON & Worker Gemini)
│   ├── frontend/                    <-- Specs màn hình & prototype demo (.html)
│   │   ├── screens/                 (Wireframes & layout specifications)
│   │   └── prototypes/              (Bản demo HTML độc lập trực quan)
│   └── archive/                     <-- Gom toàn bộ file nháp cũ (answered, note, old...)
│       ├── docs-demo/               (Tech specs cũ & audit reports)
│       └── docs_for_db_bfd/         (Q&A DB, Business logic sơ khai, Use cases)
├── frontend/                        <-- Source code React
└── wpe-backend/                     <-- Source code Spring Boot
```

---

## 2. Bản đồ Tài liệu Đặc tả (Documentation Map & SSOT)

Toàn bộ thông số kỹ thuật chuẩn (Single Source of Truth - SSOT) nằm tại [docs/specs/](file:///c:/Users/Minh%20Dang/Desktop/Ky_thuat_phan_mem/nam_3/HKI/OOAD/PROJECT/Workflow-Pipeline-Engine/docs/specs):

| Tài liệu | Mô tả | Liên kết |
| :--- | :--- | :--- |
| **System Overview & RBAC** | Kiến trúc 5 phân hệ cốt lõi & ma trận phân quyền RBAC | [system-overview.md](file:///c:/Users/Minh%20Dang/Desktop/Ky_thuat_phan_mem/nam_3/HKI/OOAD/PROJECT/Workflow-Pipeline-Engine/docs/specs/system-overview.md) |
| **Database Schema** | 12 bảng chuẩn hóa 3NF, ràng buộc toàn vẹn & Mermaid ERD | [database-schema.md](file:///c:/Users/Minh%20Dang/Desktop/Ky_thuat_phan_mem/nam_3/HKI/OOAD/PROJECT/Workflow-Pipeline-Engine/docs/specs/database-schema.md) |
| **Workflow Engine** | State Machine 4 cột trạng thái & Thuật toán Kahn (DAG Sort) | [workflow-engine.md](file:///c:/Users/Minh%20Dang/Desktop/Ky_thuat_phan_mem/nam_3/HKI/OOAD/PROJECT/Workflow-Pipeline-Engine/docs/specs/workflow-engine.md) |
| **AI Diagnostics** | Schema JSON chẩn đoán sự cố & Cơ chế Gemini Worker | [ai-diagnostics.md](file:///c:/Users/Minh%20Dang/Desktop/Ky_thuat_phan_mem/nam_3/HKI/OOAD/PROJECT/Workflow-Pipeline-Engine/docs/specs/ai-diagnostics.md) |

---

## 3. Kho Lưu trữ Lịch sử (Archive)

Khi cần tra cứu lý do đằng sau các quyết định thiết kế cũ, các câu trả lời phản biện hoặc code nháp:
- [docs/archive/README.md](file:///c:/Users/Minh%20Dang/Desktop/Ky_thuat_phan_mem/nam_3/HKI/OOAD/PROJECT/Workflow-Pipeline-Engine/docs/archive/README.md)
- [docs/archive/docs_for_db_bfd/](file:///c:/Users/Minh%20Dang/Desktop/Ky_thuat_phan_mem/nam_3/HKI/OOAD/PROJECT/Workflow-Pipeline-Engine/docs/archive/docs_for_db_bfd): Phân tích logic nghiệp vụ, Q&A cơ sở dữ liệu ban đầu.
- [docs/archive/docs-demo/](file:///c:/Users/Minh%20Dang/Desktop/Ky_thuat_phan_mem/nam_3/HKI/OOAD/PROJECT/Workflow-Pipeline-Engine/docs/archive/docs-demo): Báo cáo kiểm định kiến trúc và đặc tả frontend cũ.

---

## 4. Công nghệ & Nguyên tắc Cốt lõi (Tech Stack & Core Principles)

1. **Frontend**: React (Vite / TypeScript / Modern UI).
2. **Backend**: Java Spring Boot 3 (Spring Security, Spring Data JPA, RESTful API).
3. **Mô hình Trạng thái**: State Machine 4 cột (`TODO`, `IN PROGRESS`, `REVIEW / BLOCKED`, `DONE`).
4. **Giải quyết Phụ thuộc (DAG)**: Thuật toán Kahn (Topological Sorting) để phát hiện chu trình (cycle detection) và kích hoạt task downstream khi in-degree = 0.
5. **AI Assistant**: Google Gemini API Worker phân tích log sự cố và đề xuất hướng xử lý.

---

## 5. Quy tắc Hành xử cho AI Agent (Agent Rules of Engagement)

1. **Luôn bắt đầu từ GEMINI.md**: Định vị chính xác phân hệ và file đặc tả liên quan trước khi đọc hoặc sửa code.
2. **SSOT là tối thượng**: Mọi quyết định thay đổi cấu trúc DB, logic DAG hoặc API contract phải tuân thủ nghiêm ngặt các file trong [docs/specs/](file:///c:/Users/Minh%20Dang/Desktop/Ky_thuat_phan_mem/nam_3/HKI/OOAD/PROJECT/Workflow-Pipeline-Engine/docs/specs).
3. **Không xóa dữ liệu Archive**: Thư mục [docs/archive/](file:///c:/Users/Minh%20Dang/Desktop/Ky_thuat_phan_mem/nam_3/HKI/OOAD/PROJECT/Workflow-Pipeline-Engine/docs/archive) là dữ liệu đối chiếu lịch sử, không tự ý chỉnh sửa hay ghi đè.
4. **Đồng bộ hóa Tài liệu**: Khi cập nhật API hoặc logic mới, luôn cập nhật ngược lại đặc tả tương ứng trong `docs/specs/`.
