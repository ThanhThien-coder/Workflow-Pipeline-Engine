# Đặc tả use case — Mảng B: Thiết kế quy trình DAG (B7)

Ba use case trọng tâm của sơ đồ [uc-do-thi.puml](uc-do-thi.puml). Mã lỗi đối chiếu với code backend (`WorkflowGraphService.java`, `GlobalExceptionHandler.java`) và với "Đặc tả đã chốt" của B2–B4.

Quy ước mã lỗi: body lỗi của backend có trường `error` (ví dụ `CYCLE_DETECTED`). `IllegalArgumentException` trả `400 BAD_REQUEST`, `ResourceNotFoundException` trả `404 RESOURCE_NOT_FOUND`, `ForbiddenException` trả `403 ACCESS_DENIED`.

---

## UC: Nối phụ thuộc

- **Mã:** UC10 (Thiết kế đồ thị DAG), include UC11 (Kiểm tra chu trình)
- **Actor chính:** Chủ dự án. **Actor phụ:** không có.
- **Mô tả ngắn:** Chủ dự án nối hai công việc theo chiều "cha → con": công việc con chỉ được làm sau khi công việc cha xong. Hệ thống từ chối cạnh nào tạo vòng lặp.
- **Endpoint:** `POST /api/v1/projects/{id}/dependencies` với `{ parentNodeId, childNodeId }`
- **Tiền điều kiện:**
  1. Đã đăng nhập, là Chủ dự án của dự án.
  2. Dự án không ở trạng thái `ARCHIVED`.
  3. Hai công việc đã tồn tại trong cùng dự án.
- **Hậu điều kiện khi thành công:**
  1. Có thêm một bản ghi Phụ thuộc công việc (cha, con).
  2. Đồ thị công việc vẫn không có chu trình.
  3. Trạng thái công việc con được tính lại theo chính sách hội tụ: đang `TODO` mà điều kiện không còn thỏa thì về `LOCKED`.
- **Luồng chính:**
  1. Chủ dự án kéo từ công việc cha thả vào công việc con trên màn hình Mindmap.
  2. Hệ thống kiểm tra quyền Chủ dự án và trạng thái dự án.
  3. Hệ thống kiểm tra hai công việc tồn tại, khác nhau và cùng dự án.
  4. Hệ thống **kiểm tra chu trình** (include): đã có đường đi từ con tới cha thì cạnh mới sẽ tạo vòng.
  5. Hệ thống kiểm tra công việc con chưa bắt đầu (đang `LOCKED` hoặc `TODO`).
  6. Hệ thống lưu cạnh, tính lại trạng thái công việc con, trả `201` kèm `{ parentNodeId, childNodeId }`.
  7. Chủ dự án thấy cạnh mới trên đồ thị.
- **Luồng thay thế:**
  - **4a. Cạnh (cha, con) đã có từ trước:** hệ thống không tạo bản ghi mới, trả về cạnh đang có, coi như thành công (lũy đẳng). Use case kết thúc.
  - **1a. Nối từ một công việc ở giai đoạn khác (ghost):** Chủ dự án chọn "Add Ghost Node", chọn giai đoạn nguồn, công việc nguồn và công việc đích. Tiếp tục từ bước 2. Trên Mindmap, cạnh này hiện thành ghost node gắn vào công việc đích.
- **Luồng ngoại lệ:**
  - **E1 (bước 2).** Không phải Chủ dự án → `403 ACCESS_DENIED`. Use case kết thúc.
  - **E2 (bước 2).** Dự án đã lưu trữ → `409 PROJECT_ARCHIVED`. Use case kết thúc.
  - **E3 (bước 3).** Cha trùng con → `400 BAD_REQUEST` ("Không thể nối một công việc phụ thuộc vào chính nó"). Use case kết thúc.
  - **E4 (bước 3).** Không tìm thấy công việc cha hoặc con → `404 RESOURCE_NOT_FOUND`. Use case kết thúc.
  - **E5 (bước 3).** Hai công việc khác dự án → `400 BAD_REQUEST`. Use case kết thúc.
  - **E6 (bước 4).** Cạnh mới tạo vòng → `422 CYCLE_DETECTED` kèm `cycleNodes` (mã các công việc nằm trên vòng). Mở rộng sang "Xem danh sách node gây vòng lặp". Không lưu gì. Use case kết thúc.
  - **E7 (bước 5).** Công việc con đã bắt đầu (`IN_PROGRESS`, `REVIEW`, `DONE`) → `409 NODE_IN_USE`. Use case kết thúc.
- **Quy tắc nghiệp vụ:**
  - BR1. Thêm cạnh cha → con tạo vòng khi và chỉ khi đã có đường đi từ con tới cha. Kiểm bằng duyệt theo chiều rộng từ con, O(V + E).
  - BR2. Không thêm tiền đề mới cho công việc đã bắt đầu làm.
  - BR3. Chính sách hội tụ `ALL_COMPLETED` cần mọi cha `DONE`; `ANY_COMPLETED` cần ít nhất một cha `DONE`.

---

## UC: Xuất bản dự án

- **Mã:** UC11 (Kiểm tra chu trình bằng Kahn), include "Kiểm tra chu trình"
- **Actor chính:** Chủ dự án. **Actor phụ:** Người phụ trách các công việc gốc (nhận thông báo).
- **Mô tả ngắn:** Chủ dự án chuyển dự án từ bản thảo sang vận hành. Hệ thống chạy thuật toán Kahn trên toàn bộ đồ thị. Không có vòng lặp thì dự án thành `ACTIVE` và các công việc gốc được mở khóa.
- **Endpoint:** `POST /api/v1/projects/{id}/publish`
- **Tiền điều kiện:**
  1. Đã đăng nhập, là Chủ dự án của dự án.
  2. Dự án đang ở trạng thái `DRAFT` hoặc `PLANNING`.
- **Hậu điều kiện khi thành công:**
  1. Dự án ở trạng thái `ACTIVE`.
  2. Mọi công việc gốc (in-degree 0) đang `LOCKED` chuyển sang `TODO`.
  3. Người phụ trách mỗi công việc vừa mở khóa nhận SSE `TASK_UNLOCKED` và một thông báo `TASK_READY`, gửi sau khi dữ liệu đã lưu (commit).
- **Luồng chính:**
  1. Chủ dự án chọn "Xuất bản dự án".
  2. Hệ thống kiểm tra quyền Chủ dự án và trạng thái dự án.
  3. Hệ thống nạp toàn bộ công việc và cạnh của dự án, **kiểm tra chu trình** (include) bằng thuật toán Kahn.
  4. Hệ thống chuyển dự án sang `ACTIVE`, mở khóa các công việc gốc đang `LOCKED`.
  5. Hệ thống lưu thay đổi rồi gửi `TASK_UNLOCKED` và thông báo cho người phụ trách.
  6. Hệ thống trả `200` kèm `{ success, status: "ACTIVE", publishedAt, unlockedTaskCount }`.
  7. Chủ dự án thấy dự án ở trạng thái `ACTIVE`.
- **Luồng thay thế:**
  - **4a. Công việc gốc đã `TODO` từ trước** (ví dụ công việc độc lập): không đổi, không tính vào `unlockedTaskCount`, không gửi thông báo.
  - **5a. Công việc vừa mở khóa chưa có người phụ trách:** không gửi gì cho công việc đó.
- **Luồng ngoại lệ:**
  - **E1 (bước 2).** Không phải Chủ dự án → `403 ACCESS_DENIED`. Use case kết thúc.
  - **E2 (bước 2).** Dự án đã lưu trữ → `409 PROJECT_ARCHIVED`. Use case kết thúc.
  - **E3 (bước 2).** Dự án ở `ACTIVE`, `PAUSED`, `COMPLETED` hoặc `INACTIVE` (kể cả xuất bản lần 2) → `409 INVALID_PROJECT_STATUS`. Use case kết thúc.
  - **E4 (bước 3).** Đồ thị có vòng lặp → `422 CYCLE_DETECTED` kèm `cycleNodes`. Mở rộng sang "Xem danh sách node gây vòng lặp". Dự án và công việc không đổi. Use case kết thúc.
  - **E5 (bước 5).** Gửi SSE hoặc thông báo lỗi (mất kết nối, RabbitMQ hỏng) → chỉ ghi log. Dự án vẫn đã xuất bản, request vẫn trả `200`.
- **Quy tắc nghiệp vụ:**
  - BR1. Dù từng cạnh đã được kiểm khi nối, xuất bản vẫn chạy Kahn cho cả dự án, vì dữ liệu có thể vào DB không qua API (seed, clone template, SQL gõ tay).
  - BR2. `cycleNodes` chỉ gồm công việc **nằm trên** vòng lặp, không gồm công việc chỉ đứng sau vòng lặp (B1).
  - BR3. Độ phức tạp O(V + E), V là số công việc, E là số cạnh.
  - BR4. Sự kiện chỉ gửi sau khi commit: rollback thì không ai nhận tin sai.

> Đặc tả này khớp code trên main (`7ed530d`, sau khi PR B4 #31 merge): `409 INVALID_PROJECT_STATUS`, sự kiện gửi trong `TransactionSynchronization.afterCommit` của `publishPipeline`.

---

## UC: Xóa giai đoạn

- **Mã:** UC10 (Thiết kế đồ thị DAG)
- **Actor chính:** Chủ dự án. **Actor phụ:** không có.
- **Mô tả ngắn:** Chủ dự án xóa một giai đoạn khỏi đồ thị Macro. Công việc bên trong **không bị xóa** mà trở thành công việc độc lập.
- **Endpoint:** `DELETE /api/v1/projects/{id}/phases/{phaseId}`
- **Tiền điều kiện:**
  1. Đã đăng nhập, là Chủ dự án của dự án.
  2. Dự án không ở trạng thái `ARCHIVED`.
- **Hậu điều kiện khi thành công:**
  1. Giai đoạn không còn trong dự án.
  2. Mọi công việc của giai đoạn đó có `phase_id = null` (công việc độc lập), giữ nguyên trạng thái và các cạnh phụ thuộc công việc.
  3. Giai đoạn con trỏ tới nó qua cột cũ `parent_phase_id` được gỡ liên kết; các bản ghi Phụ thuộc giai đoạn liên quan bị xóa theo (ON DELETE CASCADE).
- **Luồng chính:**
  1. Chủ dự án chọn biểu tượng xóa trên thẻ giai đoạn.
  2. Hệ thống hỏi xác nhận.
  3. Chủ dự án xác nhận xóa.
  4. Hệ thống kiểm tra quyền Chủ dự án, trạng thái dự án, giai đoạn tồn tại và thuộc dự án.
  5. Hệ thống chuyển công việc của giai đoạn thành công việc độc lập, gỡ liên kết với giai đoạn con, xóa giai đoạn, trả `204`.
  6. Chủ dự án thấy giai đoạn và các cạnh nối với nó biến mất khỏi đồ thị Macro.
- **Luồng thay thế:**
  - **3a. Chủ dự án hủy ở bước xác nhận:** không gửi request. Use case kết thúc.
  - **5a. Giai đoạn đã bị xóa từ trước (`404`):** giao diện coi như đã xóa xong, gỡ thẻ khỏi màn hình.
- **Luồng ngoại lệ:**
  - **E1 (bước 4).** Không phải Chủ dự án → `403 ACCESS_DENIED`. Use case kết thúc.
  - **E2 (bước 4).** Dự án đã lưu trữ → `409 PROJECT_ARCHIVED`. Use case kết thúc.
  - **E3 (bước 4).** Giai đoạn thuộc dự án khác → `400 BAD_REQUEST`. Use case kết thúc.
- **Quy tắc nghiệp vụ:**
  - BR1. Xóa giai đoạn không bao giờ xóa công việc (bảo toàn dữ liệu). Vì vậy use case này **không** có lỗi `NODE_IN_USE`: công việc đang làm dở vẫn còn nguyên, chỉ rời khỏi giai đoạn.
