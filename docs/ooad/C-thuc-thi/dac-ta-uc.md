# Đặc tả Use Case — Mảng Chạy task, FSM & Realtime (WPE)

Tài liệu đặc tả chi tiết 3 Use Case trọng tâm của Phân hệ Mảng C theo chuẩn Single Source of Truth (SSOT), đối chiếu trực tiếp với mã nguồn Spring Boot Backend và React Frontend.

---

## UC1: Nộp bài chờ nghiệm thu (Submit Task Deliverable)

- **Mã use case**: UC18 (Khớp ma trận phân quyền RBAC `docs/specs/system-overview.md` mục 4 và Cụm 5.3 `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md`)
- **Tên use case**: Nộp bài
- **Actor chính**: Cộng sự (Collaborator / Assignee) hoặc Chủ dự án (Project Owner)
- **Actor phụ**: Chủ dự án (Project Owner - nhận thông báo), Hệ thống thông báo bất đồng bộ (RabbitMQ / SSE)
- **Mô tả ngắn**: Người được giao phụ trách tác vụ (hoặc Chủ dự án) thực hiện nộp sản phẩm hoàn thành để chuyển tác vụ từ trạng thái `IN_PROGRESS` sang `REVIEW` chờ Chủ dự án nghiệm thu. Việc đính kèm liên kết minh chứng ngoài (Artifact: GitHub Pull Request, Figma, Swagger, tài liệu kỹ thuật...) là tùy chọn (Optional).
- **Tiền điều kiện**:
  1. Người dùng đã đăng nhập hệ thống và là người phụ trách tác vụ (`assigned_user_id == currentUserId`) hoặc là Chủ dự án (`owner_id == currentUserId`).
  2. Tác vụ đang ở trạng thái đang làm (`status == 'IN_PROGRESS'`).
  3. Dự án chứa tác vụ không ở trạng thái lưu trữ (`status != 'ARCHIVED'`).
- **Hậu điều kiện khi thành công**:
  1. Tác vụ được chuyển sang trạng thái chờ nghiệm thu (`status = 'REVIEW'`), xóa bỏ lý do từ chối cũ (`reject_reason = NULL`), tăng phiên bản khóa lạc quan (`version = version + 1`) trong bảng `NODE`.
  2. Nếu người nộp có điền URL minh chứng, một bản ghi mới được tạo trong bảng `ARTIFACTS`; `is_public_for_guest` theo lựa chọn của người nộp, không gửi thì mặc định `true` (C4).
  3. Hệ thống tạo thông báo `NOTIFICATION` cho Chủ dự án với tiêu đề "Tác vụ chờ nghiệm thu" (loại `REVIEW_REQUESTED`).
  4. Hệ thống đẩy sự kiện thời gian thực SSE `TASK_SUBMITTED` tới Chủ dự án (sau khi giao dịch cơ sở dữ liệu đã commit).
  5. Thẻ tác vụ trên bảng My Tasks của người phụ trách chuyển sang cột In Review.
- **Luồng chính**:
  1. Cộng sự mở bảng My Tasks và bấm nút "Nộp bài" trên thẻ tác vụ đang làm việc (hoặc mở hộp thoại chi tiết `TaskDetailModal` rồi bấm "Nộp bài").
  2. Hệ thống hiển thị hộp thoại nộp bài `SubmitArtifactModal` gồm lựa chọn loại minh chứng (`PR`, `FIGMA`, `DOCS`, `SWAGGER`, `OTHER_LINK`), ô nhập đường dẫn URL (tùy chọn) và ghi chú/tiêu đề sản phẩm bàn giao.
  3. Cộng sự chọn loại minh chứng, nhập URL sản phẩm hoàn thành, nhập ghi chú bổ sung và bấm nút "Submit" (Xác nhận nộp).
  4. Hệ thống gửi yêu cầu HTTP `POST /api/nodes/{taskId}/submit` (hoặc `POST /api/v1/nodes/{taskId}/submit`) kèm body chứa thông tin minh chứng và phiên bản hiện tại `version`.
  5. Controller `NodeController.submitTask` tiếp nhận request, trích xuất định danh người dùng qua `CurrentUserProvider` và chuyển tiếp cho `StateMachineService.submitTaskArtifact(taskId, request, currentUserId)`.
  6. Service kiểm tra sự tồn tại của tác vụ (`NodeRepository.findById`) và dự án (`ProjectRepository.findById`).
  7. Service xác thực nghiệp vụ FSM:
     - Kiểm tra trạng thái tác vụ bắt buộc phải là `IN_PROGRESS`.
     - Kiểm tra xung đột phiên bản Optimistic Locking (`node.getVersion() == request.version()`).
     - Kiểm tra dự án chưa bị lưu trữ thông qua `ensureNotArchived(project)`.
     - Kiểm tra quyền hạn: người gọi bắt buộc là người được giao (`isAssignee`) hoặc là Chủ dự án (`isOwner`).
     - Nếu có URL minh chứng: kiểm bằng `ArtifactUrlValidator.isValid` (chỉ `http`/`https`, có tên miền, tối đa 500 ký tự) **trước** khi đổi trạng thái (C4).
  8. Service cập nhật trạng thái tác vụ sang `NodeStatus.REVIEW`, xóa lý do từ chối (`node.setRejectReason(null)`), lưu vào cơ sở dữ liệu qua `NodeRepository.save(node)` (JPA tự động tăng `version`).
  9. Service kiểm tra nếu request có URL minh chứng hợp lệ, khởi tạo đối tượng `ArtifactEntity` liên kết với `nodeId`, `projectId`, người tải lên (`currentUserId`), gán cờ `isPublicForGuest` theo lựa chọn của người nộp (mặc định `true`) và lưu qua `ArtifactRepository.save(artifact)`.
  10. Service phát hành sự kiện thông báo bất đồng bộ `NotificationEvent` (loại `REVIEW_REQUESTED`) qua hàng đợi RabbitMQ bằng `WorkflowEventPublisher.publishNotification` (hẹn gửi sau khi giao dịch commit).
  11. Service đăng ký hook đồng bộ giao dịch `afterCommit`: đẩy sự kiện thời gian thực `TASK_SUBMITTED` mang `KanbanTaskResponse` xuống trình duyệt của Chủ dự án qua `SseEmitterService.sendToUser(ownerId, "TASK_SUBMITTED", taskResponse)`.
  12. Hệ thống trả về mã HTTP 200 OK kèm payload `SubmitTaskArtifactResponse` chứa thông tin tác vụ và minh chứng vừa tạo.
  13. Giao diện đóng hộp thoại nộp bài, di chuyển thẻ tác vụ sang cột In Review và báo nộp bài thành công.
- **Luồng thay thế**:
  - **3a. Nộp bài không đính kèm liên kết minh chứng**:
    - 3a.1. Cộng sự để trống ô nhập liên kết URL và bấm xác nhận nộp.
    - 3a.2. Hệ thống bỏ qua bước lưu bản ghi vào bảng `ARTIFACTS` (bước 9) và tiếp tục thực hiện bình thường các bước còn lại; trường `artifact` trong response trả về giá trị `null`.
  - **3b. Nộp bài trực tiếp qua thao tác kéo thẻ (Drag & Drop)**:
    - 3b.1. Cộng sự kéo thẻ tác vụ trực tiếp từ cột In Progress thả sang cột In Review trên bảng My Tasks.
    - 3b.2. Hệ thống gọi API `PATCH /api/nodes/{taskId}/status` với body `{ "status": "REVIEW", "version": n }`.
    - 3b.3. Service `StateMachineService.updateStatus` xử lý nhánh chuyển đổi `IN_PROGRESS -> REVIEW`, cập nhật trạng thái, xóa `rejectReason` và phát sự kiện SSE `TASK_STATUS_CHANGED`. Use case hoàn tất.
- **Luồng ngoại lệ**:
  - **E1. Không tìm thấy tác vụ hoặc dự án (bắt đầu từ bước 6)**: Hệ thống ném `ResourceNotFoundException`, `GlobalExceptionHandler` bắt và trả về HTTP 404 `RESOURCE_NOT_FOUND` kèm thông báo "Không tìm thấy tác vụ ID: ...". Use case kết thúc.
  - **E2. Tác vụ không ở trạng thái IN_PROGRESS (bắt đầu từ bước 7)**: Hệ thống ném `IllegalArgumentException`, trả về HTTP 400 `BAD_REQUEST` với thông báo "Tác vụ phải ở trạng thái IN_PROGRESS mới có thể nộp bài nghiệm thu.". Use case kết thúc.
  - **E3. Xung đột phiên bản dữ liệu Optimistic Locking (bắt đầu từ bước 7)**: Tác vụ đã bị người khác cập nhật trước khiến `version` không khớp, hệ thống ném `OptimisticLockingFailureException`, trả về HTTP 409 `OPTIMISTIC_LOCK_CONFLICT` kèm thông báo "Dữ liệu tác vụ đã bị thay đổi bởi một thành viên khác. Vui lòng làm mới trang.". Use case kết thúc.
  - **E4. Dự án đã bị đóng băng lưu trữ ARCHIVED (bắt đầu từ bước 7)**: `project.getStatus() == ProjectStatus.ARCHIVED`, hệ thống ném `ConflictException("PROJECT_ARCHIVED", ...)`, trả về HTTP 409 `PROJECT_ARCHIVED` kèm thông báo "Dự án đã được lưu trữ, chỉ có thể xem. Không thể thay đổi trạng thái tác vụ.". Use case kết thúc.
  - **E5. Người thực hiện không có quyền nộp bài (bắt đầu từ bước 7)**: Người gọi không phải người phụ trách và cũng không phải Chủ dự án, hệ thống ném `ForbiddenException("ACCESS_DENIED", ...)`, trả về HTTP 403 `ACCESS_DENIED` với thông báo "Bạn không có quyền nộp bài cho tác vụ này.". Use case kết thúc.
  - **E6. Link minh chứng không hợp lệ (bắt đầu từ bước 7)**: URL không phải `http`/`https`, thiếu tên miền (ví dụ `javascript:alert(1)`, `http:///abc`) hoặc dài quá 500 ký tự, hệ thống ném `IllegalArgumentException`, trả về HTTP 400 `BAD_REQUEST`. Tác vụ **vẫn ở `IN_PROGRESS`**, không có bản ghi minh chứng nào được lưu. Use case kết thúc.
- **Quy tắc nghiệp vụ**:
  - **BR1 (Strict Review Gate Pre-condition)**: Không được phép nộp bài khi tác vụ đang ở trạng thái `TODO` hoặc `LOCKED`. Bắt buộc phải bắt đầu làm (`IN_PROGRESS`) trước khi nộp.
  - **BR2 (Optional Deliverable)**: Việc đính kèm liên kết minh chứng ngoài là tùy chọn, không ép buộc phải có URL mới được nộp. Tuy nhiên nếu nhập URL thì phải là `http://` hoặc `https://`, có tên miền, tối đa 500 ký tự (E6).
  - **BR3 (Public for Guest)**: Người nộp chọn minh chứng có công khai cho Khách/Giáo viên (xem qua Token chia sẻ) hay không; không chọn thì mặc định công khai (`is_public_for_guest = true`).
- **Nguồn**:
  - `wpe-backend/src/main/java/com/pipeline/wpe/controller/NodeController.java` (`submitTask`)
  - `wpe-backend/src/main/java/com/pipeline/wpe/service/engine/StateMachineService.java` (`submitTaskArtifact`)
  - `wpe-frontend/src/components/kanban/SubmitArtifactModal.tsx`
  - `docs/specs/system-overview.md` (Mục 4 UC18)
  - `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md` (Cụm 5.3)

---

## UC2: Duyệt bài và tự động mở khóa đồ thị DAG (Approve Task)

- **Mã use case**: UC13a (Khớp ma trận phân quyền RBAC `docs/specs/system-overview.md` mục 4 và Cụm 5.4, 5.6 `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md`)
- **Tên use case**: Duyệt bài
- **Actor chính**: Quản lý (Project Manager) hoặc Chủ dự án (Project Owner, kế thừa Quản lý)
- **Actor phụ**: Cộng sự phụ trách (Assignee - nhận thông báo), Hệ thống RabbitMQ Background Worker & SSE
- **Mô tả ngắn**: Chủ dự án hoặc Quản lý kiểm tra kết quả công việc và minh chứng bàn giao của tác vụ đang chờ duyệt (`REVIEW`), thực hiện phê duyệt nghiệm thu hoàn thành (`DONE`). Khi được duyệt, tác vụ bị đóng băng vĩnh viễn và hệ thống kích hoạt tiến trình nền tự động mở khóa các tác vụ con kế tiếp trong đồ thị DAG theo chính sách hội tụ (AND/OR join).
- **Tiền điều kiện**:
  1. Người dùng đã đăng nhập hệ thống và là Chủ dự án (`owner_id == currentUserId`) hoặc là thành viên còn hiệu lực có vai trò `MANAGER` (`project_member.role = 'MANAGER'`, `removed_at IS NULL`).
  2. Tác vụ đang ở trạng thái chờ duyệt (`status == 'REVIEW'`).
  3. Dự án chứa tác vụ không ở trạng thái lưu trữ (`status != 'ARCHIVED'`).
- **Hậu điều kiện khi thành công**:
  1. Tác vụ chuyển sang trạng thái hoàn tất (`status = 'DONE'`), tăng `version` trong bảng `NODE`; trên giao diện thẻ tác vụ không kéo được nữa (`TaskCard`: `draggable={!frozen && ...}`).
  2. Sự kiện `TaskCompletedEvent` được phát lên RabbitMQ exchange (sau khi giao dịch commit).
  3. Hệ thống đẩy sự kiện thời gian thực SSE `TASK_STATUS_CHANGED` xuống trình duyệt của người phụ trách tác vụ, và của Chủ dự án nếu người duyệt không phải Chủ dự án (ví dụ Quản lý duyệt).
  4. Tiến trình nền `WorkflowEventConsumer.handleTaskCompleted` mở khóa các tác vụ con từ `LOCKED` sang `TODO` nếu thỏa mãn điều kiện hội tụ `join_policy` (`ALL_COMPLETED` hoặc `ANY_COMPLETED`).
  5. Người phụ trách các tác vụ con vừa mở khóa nhận thông báo chuông `TASK_READY` và nhận sự kiện thời gian thực SSE `TASK_UNLOCKED` mà không cần tải lại trang.
- **Luồng chính**:
  1. Người duyệt (Chủ dự án hoặc Quản lý) mở màn hình bảng Kanban hoặc hộp thoại chi tiết tác vụ `TaskDetailModal` của một tác vụ đang nằm ở cột In Review.
  2. Người duyệt xem xét các thông tin bàn giao, mở kiểm tra các liên kết minh chứng ngoài (Artifacts) đính kèm.
  3. Người duyệt bấm nút "Duyệt hoàn thành" (hoặc kéo thẻ từ cột In Review thả sang cột Done).
  4. Hệ thống gửi yêu cầu HTTP `PATCH /api/nodes/{taskId}/status` kèm body `{ "status": "DONE", "version": n }`.
  5. Controller `NodeController.updateStatus` tiếp nhận yêu cầu, lấy định danh người thực hiện từ `CurrentUserProvider` và gọi `StateMachineService.updateStatus(taskId, request, currentUserId)`.
  6. Service kiểm tra tác vụ tồn tại trong cơ sở dữ liệu (`NodeRepository.findById`) và kiểm tra dự án liên kết (`ProjectRepository.findById`).
  7. Service kiểm tra các quy tắc FSM & bảo mật:
     - Kiểm tra Optimistic Locking: `node.getVersion() == request.version()`.
     - Kiểm tra trạng thái hiện tại: nếu đã là `DONE` (Terminal State) thì chặn không cho sửa đổi.
     - Kiểm tra dự án chưa bị đóng băng qua `ensureNotArchived(project)`.
     - Kiểm tra chuyển đổi trạng thái: tác vụ bắt buộc phải đang ở `REVIEW` (chặn nhảy cóc từ `TODO` hoặc `IN_PROGRESS` sang `DONE`).
     - **Strict Review Gate**: Thẩm định quyền hạn `canReview`: caller là Chủ dự án (`project.getOwnerId().equals(currentUserId)`) **hoặc** là `MANAGER` còn hiệu lực (`ProjectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull`).
  8. Service cập nhật `node.setStatus(NodeStatus.DONE)`, lưu vào CSDL qua `NodeRepository.save(node)` (tăng `version`).
  9. Service gọi `WorkflowEventPublisher.publishTaskCompleted(event)` tạo `TaskCompletedEvent` chứa `taskId`, `projectId`, `taskCode`, `actorId`. Nhờ cơ chế gửi sau commit (`sendAfterCommit`), sự kiện được xếp hàng chờ giao dịch commit an toàn trước khi đẩy lên RabbitMQ exchange `wpe.workflow.exchange`.
  10. Service đăng ký hook sau commit: đẩy sự kiện thời gian thực SSE `TASK_STATUS_CHANGED` tới người phụ trách tác vụ (`assigneeId`), và tới Chủ dự án nếu người duyệt không phải Chủ dự án, qua `SseEmitterService.sendToUser`.
  11. Hệ thống hoàn tất giao dịch và trả về HTTP 200 OK kèm dữ liệu `KanbanTaskResponse` của tác vụ đã hoàn thành cho người duyệt.
  12. Giao diện của người duyệt cập nhật thẻ tác vụ sang cột Done và thẻ không kéo được nữa.
  13. [Tiến trình ngầm] Ngay sau khi commit, `TaskCompletedEvent` được gửi lên RabbitMQ queue `wpe.task.completed.queue`.
  14. [Tiến trình ngầm] `WorkflowEventConsumer.handleTaskCompleted` lắng nghe hàng đợi, tiếp nhận sự kiện và gọi `StateMachineService.unlockDownstreamTasks(parentTaskId)`.
  15. [Tiến trình ngầm] Engine truy vấn danh sách các cạnh phụ thuộc trong bảng `NODE_DEPENDENCY` có `parent_node_id = parentTaskId`.
  16. [Tiến trình ngầm] Với từng tác vụ con đang ở trạng thái `LOCKED`:
      - Truy vấn danh sách toàn bộ các nút cha của tác vụ con đó.
      - Đánh giá chính sách hội tụ:
        + Nếu `join_policy == ALL_COMPLETED` (AND-join): kiểm tra 100% nút cha đã đạt `DONE`.
        + Nếu `join_policy == ANY_COMPLETED` (OR-join): kiểm tra có ít nhất 1 nút cha đã đạt `DONE`.
      - Nếu thỏa mãn điều kiện mở khóa:
        + Cập nhật tác vụ con từ `LOCKED` sang `TODO` và lưu CSDL qua `NodeRepository.save(childNode)`.
        + Phát thông báo `NotificationEvent` (loại `TASK_READY`) cho người phụ trách tác vụ con.
        + Đẩy sự kiện thời gian thực SSE `TASK_UNLOCKED` kèm `KanbanTaskResponse` xuống trình duyệt của người phụ trách tác vụ con.
  17. Trình duyệt của người phụ trách tác vụ con bắt sự kiện SSE `TASK_UNLOCKED`, tự động hiển thị thẻ tác vụ mới vào cột TODO trên bảng My Tasks của mình mà không cần bấm F5.
- **Luồng thay thế**:
  - Không có luồng thay thế. Nếu người duyệt thấy bài nộp chưa đạt yêu cầu, người duyệt thực hiện use case "Từ chối bài" (`<<extend>>` "Duyệt bài" với điều kiện [kết quả chưa đạt], khớp sơ đồ use case tổng quát X3).
- **Luồng ngoại lệ**:
  - **E1. Không tìm thấy tác vụ hoặc dự án (bắt đầu từ bước 6)**: Hệ thống ném `ResourceNotFoundException`, trả về HTTP 404 `RESOURCE_NOT_FOUND`. Use case kết thúc.
  - **E2. Xung đột phiên bản dữ liệu Optimistic Locking (bắt đầu từ bước 7)**: `node.getVersion() != request.version()`, hệ thống ném `OptimisticLockingFailureException`, trả về HTTP 409 `OPTIMISTIC_LOCK_CONFLICT`. Use case kết thúc.
  - **E3. Tác vụ đã ở trạng thái DONE từ trước (bắt đầu từ bước 7)**: Tác vụ đã đóng băng, hệ thống ném `IllegalArgumentException`, trả về HTTP 400 `BAD_REQUEST` với thông báo "Tác vụ đã hoàn tất và đóng băng, không thể thay đổi.". Use case kết thúc.
  - **E4. Dự án đã bị đóng băng lưu trữ ARCHIVED (bắt đầu từ bước 7)**: Hệ thống ném `ConflictException("PROJECT_ARCHIVED", ...)`, trả về HTTP 409 `PROJECT_ARCHIVED`. Use case kết thúc.
  - **E5. Tác vụ chưa qua bước REVIEW (bắt đầu từ bước 7)**: Người dùng cố tình duyệt trực tiếp từ `TODO` hoặc `IN_PROGRESS`, hệ thống ném `IllegalArgumentException`, trả về HTTP 400 `BAD_REQUEST` với thông báo "Tác vụ bắt buộc phải qua bước REVIEW trước khi nghiệm thu.". Use case kết thúc.
  - **E6. Người duyệt không phải Chủ dự án hoặc Quản lý (bắt đầu từ bước 7)**: Cộng sự, Người xem, Quản lý đã bị loại khỏi dự án hoặc người ngoài gọi API duyệt, hệ thống ném `ForbiddenException("ACCESS_DENIED", ...)`, trả về HTTP 403 `ACCESS_DENIED` với thông báo "Chỉ Chủ dự án hoặc Quản lý mới có thẩm quyền phê duyệt hoàn thành tác vụ.". Use case kết thúc.
- **Quy tắc nghiệp vụ**:
  - **BR1 (Strict Review Gate)**: Chỉ Chủ dự án hoặc thành viên `MANAGER` còn hiệu lực mới có thẩm quyền duyệt tác vụ hoàn thành (`DONE`). Cộng sự không thể tự duyệt bài của mình.
  - **BR2 (Terminal State & Immutability)**: Trạng thái `DONE` là trạng thái kết thúc (Terminal State). Khi đã đạt `DONE`, tác vụ bị đóng băng vĩnh viễn, không thể kéo ngược hay chỉnh sửa trạng thái.
  - **BR3 (Non-blocking Asynchronous DAG Unlock)**: Việc tính toán đồ thị và mở khóa các tác vụ con được đẩy sang RabbitMQ xử lý ngầm, nên request duyệt trả về ngay mà không phải chờ tính toán đồ thị (chưa đo thời gian thực tế).
  - **BR4 (Transaction Boundary & After-Commit Eventing)**: Mọi sự kiện phát lên RabbitMQ và SSE chỉ được gửi sau khi giao dịch cơ sở dữ liệu đã commit thành công (`STATUS_COMMITTED`), ngăn chặn hoàn toàn tình trạng gửi sự kiện sai lệch khi giao dịch bị rollback.
- **Nguồn**:
  - `wpe-backend/src/main/java/com/pipeline/wpe/controller/NodeController.java` (`updateStatus`)
  - `wpe-backend/src/main/java/com/pipeline/wpe/service/engine/StateMachineService.java` (`updateStatus`, `unlockDownstreamTasks`)
  - `wpe-backend/src/main/java/com/pipeline/wpe/service/event/WorkflowEventPublisher.java`
  - `wpe-backend/src/main/java/com/pipeline/wpe/service/event/WorkflowEventConsumer.java`
  - `wpe-backend/src/main/java/com/pipeline/wpe/service/event/SseEmitterService.java`
  - `docs/specs/system-overview.md` (Mục 4 UC13)
  - `docs/specs/workflow-engine.md` (Mục 1, 2, 3)
  - `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md` (Cụm 5.4, 5.6, 5.7)

---

## UC3: Từ chối bài nộp và yêu cầu làm lại (Reject Task)

- **Mã use case**: UC13b (Khớp ma trận phân quyền RBAC `docs/specs/system-overview.md` mục 4 và Cụm 5.5 `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md`)
- **Tên use case**: Từ chối bài
- **Actor chính**: Quản lý (Project Manager) hoặc Chủ dự án (Project Owner, kế thừa Quản lý)
- **Actor phụ**: Cộng sự phụ trách (Assignee - nhận thông báo & SSE)
- **Mô tả ngắn**: Chủ dự án hoặc Quản lý đánh giá kết quả bàn giao của tác vụ ở trạng thái `REVIEW` là chưa đạt yêu cầu, thực hiện từ chối nghiệm thu, bắt buộc nhập lý do vào trường `reject_reason` và chuyển tác vụ quay trở lại trạng thái `IN_PROGRESS` để người phụ trách tiến hành chỉnh sửa, làm lại.
- **Tiền điều kiện**:
  1. Người dùng đã đăng nhập hệ thống và là Chủ dự án (`owner_id == currentUserId`) hoặc thành viên `MANAGER` còn hiệu lực.
  2. Tác vụ đang ở trạng thái chờ duyệt (`status == 'REVIEW'`).
  3. Dự án chứa tác vụ không ở trạng thái lưu trữ (`status != 'ARCHIVED'`).
- **Hậu điều kiện khi thành công**:
  1. Tác vụ chuyển từ `REVIEW` quay về `IN_PROGRESS`, ghi nhận nội dung lý do vào cột `reject_reason`, tăng `version` trong bảng `NODE`.
  2. Bản ghi thông báo `NOTIFICATION` được tạo cho người phụ trách với tiêu đề "Tác vụ yêu cầu làm lại" kèm nội dung lý do từ chối (loại `REJECTED`).
  3. Hệ thống đẩy sự kiện thời gian thực SSE `TASK_REJECTED` và `TASK_STATUS_CHANGED` xuống trình duyệt của người phụ trách (sau khi commit).
  4. Bảng My Tasks của người phụ trách cập nhật thẻ tác vụ về cột In Progress; mở chi tiết thẻ thấy lý do từ chối.
- **Luồng chính**:
  1. Người duyệt (Chủ dự án hoặc Quản lý) mở hộp thoại chi tiết tác vụ `TaskDetailModal` của một tác vụ đang ở cột In Review và bấm nút "Từ chối / Yêu cầu làm lại" (Reject).
  2. Hệ thống hiển thị hộp thoại con yêu cầu nhập lý do từ chối (Rejection Reason Submodal).
  3. Người duyệt nhập nội dung nhận xét chi tiết những điểm cần làm lại (ví dụ: "Thiếu unit test cho phần kiểm tra JWT rotation và refresh token") và bấm nút "Xác nhận từ chối".
  4. Hệ thống gửi yêu cầu HTTP `PATCH /api/nodes/{taskId}/status` kèm body `{ "status": "IN_PROGRESS", "rejectReason": "...", "version": n }`.
  5. Controller `NodeController.updateStatus` tiếp nhận yêu cầu, trích xuất định danh người dùng qua `CurrentUserProvider` và gọi `StateMachineService.updateStatus(taskId, request, currentUserId)`.
  6. Service kiểm tra tác vụ tồn tại (`NodeRepository.findById`) và dự án (`ProjectRepository.findById`).
  7. Service xác thực các điều kiện nghiệp vụ FSM:
     - Kiểm tra Optimistic Locking: `node.getVersion() == request.version()`.
     - Kiểm tra trạng thái hiện tại không phải `DONE`.
     - Kiểm tra dự án chưa bị đóng băng qua `ensureNotArchived(project)`.
     - Kiểm tra trạng thái hiện tại là `REVIEW` (cặp `REVIEW → IN_PROGRESS` mới là nhánh từ chối).
     - **Strict Review Gate**: Xác thực `canReview` (Chủ dự án hoặc `MANAGER` còn hiệu lực).
     - **Mandatory Rejection Reason**: Kiểm tra trường `rejectReason` trong request không được rỗng hoặc chỉ chứa khoảng trắng trắng (`request.rejectReason().trim().isEmpty()`).
  8. Service cập nhật `node.setStatus(NodeStatus.IN_PROGRESS)` và gán lý do `node.setRejectReason(request.rejectReason().trim())`.
  9. Service lưu thay đổi vào cơ sở dữ liệu qua `NodeRepository.save(node)` (JPA tự động tăng `version`).
  10. Service phát hành sự kiện thông báo bất đồng bộ `NotificationEvent` (loại `REJECTED`) qua RabbitMQ bằng `WorkflowEventPublisher.publishNotification` gửi tới người phụ trách (`node.getAssignedUserId()`).
  11. Service đăng ký hook sau commit: đẩy sự kiện thời gian thực SSE `TASK_REJECTED` và `TASK_STATUS_CHANGED` mang dữ liệu `KanbanTaskResponse` tới người phụ trách qua `SseEmitterService.sendToUser`.
  12. Hệ thống hoàn tất giao dịch và trả về HTTP 200 OK kèm payload `KanbanTaskResponse` cho người duyệt.
  13. Giao diện của người duyệt đóng hộp thoại, di chuyển thẻ tác vụ từ In Review quay về In Progress.
  14. Trình duyệt của người phụ trách nhận sự kiện SSE, tự động di chuyển thẻ tác vụ từ In Review về cột In Progress mà không cần tải lại trang; lý do từ chối hiện ở banner trong chi tiết thẻ.
- **Luồng thay thế**:
  - Không có luồng thay thế.
- **Luồng ngoại lệ**:
  - **E1. Không tìm thấy tác vụ hoặc dự án (bắt đầu từ bước 6)**: Hệ thống ném `ResourceNotFoundException`, trả về HTTP 404 `RESOURCE_NOT_FOUND`. Use case kết thúc.
  - **E2. Xung đột phiên bản dữ liệu Optimistic Locking (bắt đầu từ bước 7)**: `node.getVersion() != request.version()`, hệ thống ném `OptimisticLockingFailureException`, trả về HTTP 409 `OPTIMISTIC_LOCK_CONFLICT`. Use case kết thúc.
  - **E3. Tác vụ đã ở trạng thái DONE từ trước (bắt đầu từ bước 7)**: Hệ thống ném `IllegalArgumentException`, trả về HTTP 400 `BAD_REQUEST`. Use case kết thúc.
  - **E4. Dự án đã bị đóng băng lưu trữ ARCHIVED (bắt đầu từ bước 7)**: Hệ thống ném `ConflictException("PROJECT_ARCHIVED", ...)`, trả về HTTP 409 `PROJECT_ARCHIVED`. Use case kết thúc.
  - **E5. Người thực hiện không phải Chủ dự án hoặc Quản lý (bắt đầu từ bước 7)**: Hệ thống ném `ForbiddenException("ACCESS_DENIED", ...)`, trả về HTTP 403 `ACCESS_DENIED` với thông báo "Chỉ Chủ dự án hoặc Quản lý mới có quyền yêu cầu làm lại tác vụ.". Use case kết thúc.
  - **E6. Thiếu lý do từ chối hoặc lý do để trống (bắt đầu từ bước 7)**: `request.rejectReason() == null` hoặc chỉ toàn khoảng trắng, hệ thống ném `IllegalArgumentException`, trả về HTTP 400 `BAD_REQUEST` với thông báo "Bắt buộc phải nhập lý do từ chối (rejectReason).". Use case kết thúc.
  - **E7. Tác vụ không ở trạng thái REVIEW khi từ chối (bắt đầu từ bước 7)**: Tác vụ đang `LOCKED`, hệ thống ném `IllegalArgumentException`, trả về HTTP 400 `BAD_REQUEST` với thông báo "Luồng chuyển đổi trạng thái từ LOCKED sang IN_PROGRESS không hợp lệ.". Use case kết thúc. *Lưu ý:* nếu tác vụ đang `TODO` thì cùng request `status = IN_PROGRESS` được hiểu là **Bắt đầu làm** (UC16, cần là người phụ trách hoặc Chủ dự án), `rejectReason` bị bỏ qua — đây không còn là use case Từ chối bài.
- **Quy tắc nghiệp vụ**:
  - **BR1 (Mandatory Reason)**: Lý do từ chối (`rejectReason`) là thông tin bắt buộc, không được để trống, giúp người thực hiện nắm rõ nguyên nhân bài nộp chưa đạt và phương hướng khắc phục.
  - **BR2 (Strict Review Gate)**: Chỉ Chủ dự án hoặc Quản lý (`MANAGER` còn hiệu lực) mới có quyền từ chối bài nộp và yêu cầu làm lại. Người thực hiện không thể tự kéo thẻ lùi từ `REVIEW` về `IN_PROGRESS`.
  - **BR3 (Feedback Loop)**: Tác vụ sau khi bị từ chối sẽ trở lại vòng đời `IN_PROGRESS`, cho phép người phụ trách chỉnh sửa, bổ sung minh chứng và thực hiện nộp bài lại (Use case UC18).
- **Nguồn**:
  - `wpe-backend/src/main/java/com/pipeline/wpe/controller/NodeController.java` (`updateStatus`)
  - `wpe-backend/src/main/java/com/pipeline/wpe/service/engine/StateMachineService.java` (`updateStatus`)
  - `wpe-backend/src/main/java/com/pipeline/wpe/service/event/WorkflowEventPublisher.java`
  - `wpe-backend/src/main/java/com/pipeline/wpe/service/event/SseEmitterService.java`
  - `wpe-frontend/src/components/kanban/TaskDetailModal.tsx`
  - `docs/specs/system-overview.md` (Mục 4 UC13)
  - `docs/specs/workflow-engine.md` (Mục 1, 2)
  - `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md` (Cụm 5.5)
