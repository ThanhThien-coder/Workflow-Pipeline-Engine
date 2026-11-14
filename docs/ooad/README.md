# Bộ sơ đồ OOAD của nhóm

Cách vẽ từng loại sơ đồ: xem [CAM_NANG_VE_SO_DO.md](CAM_NANG_VE_SO_DO.md).
Task tương ứng: [T1](../tasks/chung/T1-hoc-ky-hieu-uml.md), A7, A8 trong [`../tasks/A-tai-khoan/`](../tasks/A-tai-khoan/README.md), tương tự B7–B8, C7–C8, D7–D8 trong thư mục của từng người, [X3](../tasks/chung/X3-rap-bo-so-do-ooad.md), [X4](../tasks/chung/X4-bao-ve-va-luyen-ve.md).

## Cấu trúc thư mục
| Thư mục | Nội dung | Người phụ trách |
| :--- | :--- | :--- |
| `luyen-tap/` | Bài luyện chung "Hàng đợi góp ý" (T1) | cả nhóm |
| `A-tai-khoan/` | Mảng Tài khoản & Bảo mật | A |
| `B-do-thi/` | Mảng Thiết kế quy trình DAG | B |
| `C-thuc-thi/` | Mảng Chạy task & Realtime | C |
| `D-du-an/` | Mảng Dự án, Template, Khách & AI | D |
| `he-thong/` | Sơ đồ toàn hệ thống (X3) | theo bảng dưới |
| `png/` | Ảnh xuất cho báo cáo, tên `<chữ>-<tên file>.png` | người vẽ |

## Danh sách sơ đồ phải có

Mỗi người tự vẽ **đủ các loại sơ đồ chính** cho mảng của mình, nên ai cũng luyện đủ mọi loại.

| Loại sơ đồ | A | B | C | D | Hệ thống (X3) |
| :--- | :---: | :---: | :---: | :---: | :--- |
| Use case | A7 | B7 | C7 | D7 | D vẽ sơ đồ tổng quát |
| Đặc tả use case (3 UC mỗi mảng) | A7 | B7 | C7 | D7 | |
| Activity | A7 | B7 | C7 | D7 | |
| Class phân tích (BCE) | A7 | B7 | C7 | D7 | |
| Sequence (2 mỗi mảng) | A8 | B8 | C8 | D8 | |
| Communication | A8 | B8 | C8 | D8 | |
| Class thiết kế | A8 | B8 | C8 | D8 | B vẽ class miền |
| State machine | A8 (tài khoản, refresh token) | B8 (dự án) | C8 (task) | D8 (lời mời, góp ý) | |
| Object | | B8 (seed DAG) | | | B |
| Component | | | | | C |
| Deployment | | | | | A |
| Package | | | | | A |
| ERD | | | | | B (cập nhật sau các migration mới) |
| BFD (nếu GV yêu cầu) | | | | | D |

Component, deployment, package, ERD chỉ có 1 bản cho cả hệ thống. Ba người còn lại luyện các loại này ở phần "luyện vẽ không nhìn" của X4.

## Mục lục sơ đồ đã vẽ (điền ở X3)

| Sơ đồ | File | Người vẽ | Người review | Mô tả (2 câu) |
| :--- | :--- | :--- | :--- | :--- |
| Use case — Chạy task & Realtime | [uc-thuc-thi.puml](C-thuc-thi/uc-thuc-thi.puml) · [png](png/C-uc-thuc-thi.png) | C | D | Cộng sự làm và nộp bài, Quản lý / Chủ dự án duyệt hoặc từ chối, Chủ dự án mở khóa cưỡng bức, Bộ hẹn giờ quét trễ hạn. Actor và số UC khớp sơ đồ tổng quát và ma trận RBAC (UC13, UC15–UC19). |
| Đặc tả use case — Chạy task | [dac-ta-uc.md](C-thuc-thi/dac-ta-uc.md) | C | D | Đặc tả Nộp bài, Duyệt bài, Từ chối bài. Luồng ngoại lệ khớp mã lỗi trong code (409 xung đột version, 403, 400, 409 PROJECT_ARCHIVED, 404). |
| Activity — Vòng đời một task | [activity-vong-doi-task.puml](C-thuc-thi/activity-vong-doi-task.puml) · [png](png/C-activity-vong-doi-task.png) | C | D | 3 làn Cộng sự / Hệ thống / Chủ dự án – Quản lý, có vòng lặp khi bài bị từ chối. Sau DONE tách song song: mở khóa task con và báo trạng thái. |
| Class phân tích BCE — Chạy task | [bce-thuc-thi.puml](C-thuc-thi/bce-thuc-thi.puml) · [png](png/C-bce-thuc-thi.png) | C | D | Boundary – control – entity của luồng chạy task, kho tài nguyên và realtime. Actor chỉ nối boundary; ghi chú ánh xạ sang lớp code thật. |
| Sequence — Duyệt task, task con tự mở khóa | [seq-duyet-task.puml](C-thuc-thi/seq-duyet-task.puml) · [png](png/C-seq-duyet-task.png) | C | D | Chủ dự án / Quản lý duyệt, sự kiện gửi lên RabbitMQ sau commit, consumer mở khóa task con theo AND/OR join. Kết thúc bằng SSE TASK_UNLOCKED tới trình duyệt người phụ trách. |
| Sequence — Nộp bài kèm minh chứng | [seq-nop-bai.puml](C-thuc-thi/seq-nop-bai.puml) · [png](png/C-seq-nop-bai.png) | C | D | Cộng sự nộp bài, link minh chứng được kiểm trước khi đổi trạng thái. Thông báo cho Chủ dự án đi qua RabbitMQ rồi SSE. |
| Communication — Nộp bài | [comm-nop-bai.puml](C-thuc-thi/comm-nop-bai.puml) · [png](png/C-comm-nop-bai.png) | C | D | Cùng nội dung sequence nộp bài, đánh số theo cấp lồng nhau. Bảng đối chiếu số ở nhat-quan.md. |
| Class thiết kế — Chạy task (2 hình) | [class-thuc-thi.puml](C-thuc-thi/class-thuc-thi.puml) · [png](png/C-class-thuc-thi.png) | C | D | Hình 1: controller, service, sự kiện của mảng C; hình 2 (`png/C-class-thuc-thi-du-lieu.png`): repository, entity, enum, DTO. Tên lớp, phương thức, kiểu giữ đúng như code. |
| State machine — Task | [state-task.puml](C-thuc-thi/state-task.puml) · [png](png/C-state-task.png) | C | D | LOCKED, TODO, IN_PROGRESS, REVIEW, DONE; mỗi chuyển ghi sự kiện, điều kiện, hành động, kể cả chuyển ở code mảng B. Có vùng song song cờ trễ hạn (isOverdue). |
| Ma trận nhất quán — Chạy task | [nhat-quan.md](C-thuc-thi/nhat-quan.md) | C | D | Mỗi message trong sequence → phương thức → file:dòng; mỗi chuyển trạng thái → nhánh code. Kèm các chỗ lệch tìm thấy khi đối chiếu. |
| Component — toàn hệ thống | [component.puml](he-thong/component.puml) · [png](png/C-component.png) | C | cả nhóm (buổi kiểm nhất quán) | Các khối Frontend, Backend, PostgreSQL, RabbitMQ, AI microservice và interface giữa chúng (REST, SSE, JDBC, AMQP). Vẽ theo code thật trên main, ghi chú các controller integration map nhắc tới nhưng chưa có. |
