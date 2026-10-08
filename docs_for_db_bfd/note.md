FrontEnd
Xem lại AI overview sao cho hợp lý ( phase 1 overview, 2 coworker ), nhớ sửa giao diện AI hợp lý để mấy thg kia đọc đ bít làm gì
xem xét phân quyền như nào để đáp ứng tính mở rộng hợp lý, mà không bị quá phức tạp chi tiết quá ( hiện tại đẫ ổn, không chỉnh nữa )
hoàn thiện màn hình guest
bổ sung chức năng tạo tẻmplate của admin
Xóa system health của Admin
xem lại mục Workspaces của Admin có xóa sửa hay hợp lý chưa, ko xóa sửa thì đưa vào overview cho admin luôn
system log của admin để đó đi từ từ xem phát triển đc thì làm


Back end
xem đc thì nâng lên java 25 (đã xem lại và quyết định không nâng)
xem lại database, erd, bfd, chốt lại chức năng nghiệp vụ 
xem xét lại đẩy database lên cloud
### 1 số chức năng thấy ổn để áp dụng



| Chức năng | Hiển thị Overview | Vị trí cảnh báo / View | Cơ chế thực thi | Điều kiện kích hoạt (Trigger) |
| --- | --- | --- | --- | --- |
| **1. Bắt lỗi xung đột kiến trúc & Phụ thuộc ngầm**<br> | Có (Widget *Architecture Health Alert*)

 | Cảnh báo trực tiếp trên DAG Canvas (viền đỏ/cam tại Node)

 | Chạy ngầm (Asynchronous Worker)

 | Khi cấu trúc đồ thị thay đổi (thêm node, sửa tech-stack trong mô tả, nối/xóa dây)

 |
| **3. Nhận diện "Task bẫy" & Độ lệch hạt nhân**<br> | Có (Chỉ số *Scope Risk Index* trong Overview)

 | Badge cảnh báo nhỏ trên chính Card ở Kanban và Node Inspector

 | Chạy ngầm (Event-Driven)

 | Khi tạo task mới hoặc khi nội dung (title/description) được cập nhật

 |
| **6. Dự báo rủi ro dây chuyền phi tuyến tính**<br> | Có (*Executive Forecast & Critical Bottlenecks* - Điểm nhấn chính của Overview)

 | Public Audit View (`/share/:token`)

 | Chạy ngầm (Scheduled Job / Batch Worker)

 | Chạy định kỳ hàng đêm (Nightly Cron) hoặc khi có task trên đường găng bị quá hạn (`OVERDUE`)

 |