# FB8 — Chạy trọn luồng: tạo dự án → đồ thị → xuất bản → giao task → làm → nộp → duyệt → xong

Người làm: B
Trạng thái: chưa làm
Lỗi xử lý: kiểm lại toàn bộ luồng chính sau FB1–FB7, tìm lỗi chưa được ghi
Nhánh git: fix-fb8-tron-luong
Làm trước: FB1–FB6 đã merge

> Viết tắt như FB1.

## Mục tiêu
Một dự án đi được từ lúc tạo tới khi mọi task DONE **chỉ bằng giao diện**, ở chế độ API thật (`VITE_USE_MOCK=false`), không dùng Swagger. Bước nào hỏng thì sửa (nếu thuộc file của B) hoặc ghi rõ cho người chủ.

## Kịch bản (Claude chạy phần API bằng dòng lệnh trước, rồi liệt kê phần trình duyệt cho người làm bấm)
| # | Ai | Thao tác | Phải thấy |
| :--- | :--- | :--- | :--- |
| 1 | alex | Tạo dự án từ `tpl-sdlc` | Dự án DRAFT, đủ phase/task |
| 2 | alex | Thêm 1 phase con, 1 task gốc, 1 subtask, 1 ghost | Vị trí phase đúng (FB2); F5 vẫn đủ (FB3) |
| 3 | alex | Thử nối tạo chu trình | Báo lỗi chu trình, đồ thị không đổi |
| 4 | alex | Mời sarah và meomeo; họ chấp nhận | Có trong danh sách thành viên |
| 5 | alex | Giao task đầu cho sarah, task thứ hai cho meomeo | F5 vẫn đúng người (FB4) |
| 6 | alex | Xuất bản | Dự án ACTIVE; task đầu TODO, task sau LOCKED |
| 7 | sarah | My Tasks → bắt đầu task đầu → nộp kèm link minh chứng | Task chờ duyệt; artifact xuất hiện trong drawer (FB6) |
| 8 | alex | Từ chối kèm lý do | sarah thấy lý do, task quay về đang làm |
| 9 | sarah | Nộp lại; alex duyệt | Task DONE; task của meomeo tự mở khóa (TODO), meomeo nhận sự kiện realtime |
| 10 | — | Đổi tab qua lại, F5 ở mọi bước | Trạng thái không bị nhảy (FB5) |
| 11 | meomeo, alex | Làm hết các task còn lại | Mọi task DONE; tiến độ phase/dự án 100% |

## Cách làm
1. Claude chạy bước 1–11 bằng API (curl hoặc test tích hợp) với token thật của từng user, ghi kết quả từng bước vào bảng "Kết quả".
2. Bước hỏng ở backend/FE thuộc luồng của B (đồ thị, kanban, artifact, giao task, tạo dự án) → viết test tái hiện, sửa, ghi lại.
3. Bước hỏng ở phần người khác (máy trạng thái, realtime, lời mời, thông báo) → **không sửa**, ghi rõ: bước, request, response, file nghi ngờ, rồi báo người chủ.
4. Liệt kê các bước cần bấm trình duyệt để người làm kiểm lại.

## Được sửa
- File của các task FB1–FB7 và `FE/views/MyTasksView.tsx`, `FE/components/kanban/**`, `FE/components/workflow/**`, `FE/components/mindmap/**`
- `BE/service/WorkflowGraphService.java`, `BE/controller/WorkflowGraphController.java`, `BE/service/NodeAssignmentService.java`
- Test liên quan
- Các file khác: chỉ ghi lỗi, không sửa

## Kết quả (Claude ghi, dán output thật)
| # | Đạt? | Ghi chú / lỗi / người chủ |
| :--- | :--- | :--- |
| 1 | | |
| 2 | | |
| 3 | | |
| 4 | | |
| 5 | | |
| 6 | | |
| 7 | | |
| 8 | | |
| 9 | | |
| 10 | | |
| 11 | | |
