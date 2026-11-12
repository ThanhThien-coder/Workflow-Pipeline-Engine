# Ma trận nhất quán giữa Sơ đồ thiết kế OOAD và Mã nguồn (Mảng D - Dự án)

Bảng đối chiếu tuân thủ theo cẩm nang OOAD (Mục 4) nhằm chứng minh mọi message trong sequence diagram, communication diagram và mọi trạng thái trong state machine diagram đều ánh xạ 1-1 tới phương thức và enum trong mã nguồn backend Spring Boot.

---

## 1. Sơ đồ tuần tự: Mời thành viên (`seq-moi-thanh-vien.puml`) & Sơ đồ giao tiếp (`comm-moi-thanh-vien.puml`)

| Sơ đồ | Phần tử / Message | Lớp.phương thức / Kiểu | `file:dòng` | Khớp? |
| :--- | :--- | :--- | :--- | :---: |
| seq-moi-thanh-vien | Message 1: `POST /api/v1/projects/{projectId}/invitations` | `ProjectInvitationController.createInvitation` | `wpe-backend/src/main/java/com/pipeline/wpe/controller/ProjectInvitationController.java:29` | ✔ |
| seq-moi-thanh-vien | Message 2: `sendInvitation(projectId, request, currentUserId)` | `ProjectInvitationService.sendInvitation` | `wpe-backend/src/main/java/com/pipeline/wpe/service/ProjectInvitationService.java:56` | ✔ |
| seq-moi-thanh-vien | Message 3: `findById(projectId)` | `ProjectRepository.findById` (kế thừa `JpaRepository`) | `wpe-backend/src/main/java/com/pipeline/wpe/repository/ProjectRepository.java:13` | ✔ |
| seq-moi-thanh-vien | Message 4: `findById(currentUserId)` | `UserRepository.findById` (kế thừa `JpaRepository`) | `wpe-backend/src/main/java/com/pipeline/wpe/repository/UserRepository.java:10` | ✔ |
| seq-moi-thanh-vien | Message 5: `findByEmail(identifier)` | `UserRepository.findByEmail` | `wpe-backend/src/main/java/com/pipeline/wpe/repository/UserRepository.java:12` | ✔ |
| seq-moi-thanh-vien | Message 6: `findByUsername(identifier)` | `UserRepository.findByUsername` | `wpe-backend/src/main/java/com/pipeline/wpe/repository/UserRepository.java:11` | ✔ |
| seq-moi-thanh-vien | Message 7: `existsByProjectIdAndUserIdAndRemovedAtIsNull(...)` | `ProjectMemberRepository.existsByProjectIdAndUserIdAndRemovedAtIsNull` | `wpe-backend/src/main/java/com/pipeline/wpe/repository/ProjectMemberRepository.java:16` | ✔ |
| seq-moi-thanh-vien | Message 8: `findByProjectIdAndInviteeIdAndStatus(...)` | `ProjectInvitationRepository.findByProjectIdAndInviteeIdAndStatus` | `wpe-backend/src/main/java/com/pipeline/wpe/repository/ProjectInvitationRepository.java:19` | ✔ |
| seq-moi-thanh-vien | Message 9: `saveAndFlush(pendingInvitation [status=EXPIRED])` | `ProjectInvitationRepository.saveAndFlush` (kế thừa `JpaRepository`) | `wpe-backend/src/main/java/com/pipeline/wpe/repository/ProjectInvitationRepository.java:16` | ✔ |
| seq-moi-thanh-vien | Message 10: `save(invitation)` | `ProjectInvitationRepository.save` (kế thừa `JpaRepository`) | `wpe-backend/src/main/java/com/pipeline/wpe/repository/ProjectInvitationRepository.java:16` | ✔ |
| seq-moi-thanh-vien | Message 11: `save(notification)` | `NotificationRepository.save` (kế thừa `JpaRepository`) | `wpe-backend/src/main/java/com/pipeline/wpe/repository/NotificationRepository.java:10` | ✔ |
| seq-moi-thanh-vien | Message 12: `publishInvitationCreated(event)` | `WorkflowEventPublisher.publishInvitationCreated` | `wpe-backend/src/main/java/com/pipeline/wpe/service/event/WorkflowEventPublisher.java:65` | ✔ |
| seq-moi-thanh-vien | Message 13: `handleInvitationCreated(event)` | `InvitationEventConsumer.handleInvitationCreated` | `wpe-backend/src/main/java/com/pipeline/wpe/service/event/InvitationEventConsumer.java:43` | ✔ |
| seq-moi-thanh-vien | Message 14: `POST /api/v1/invitations/{id}/accept` | `ProjectInvitationController.acceptInvitation` | `wpe-backend/src/main/java/com/pipeline/wpe/controller/ProjectInvitationController.java:95` | ✔ |
| seq-moi-thanh-vien | Message 15: `acceptInvitation(invitationId, currentUserId)` | `ProjectInvitationService.acceptInvitation` | `wpe-backend/src/main/java/com/pipeline/wpe/service/ProjectInvitationService.java:192` | ✔ |
| seq-moi-thanh-vien | Message 16: `findById(invitationId)` | `ProjectInvitationRepository.findById` (kế thừa `JpaRepository`) | `wpe-backend/src/main/java/com/pipeline/wpe/repository/ProjectInvitationRepository.java:16` | ✔ |
| seq-moi-thanh-vien | Message 17: `save(invitation [status=EXPIRED])` | `ProjectInvitationRepository.save` (kế thừa `JpaRepository`) | `wpe-backend/src/main/java/com/pipeline/wpe/repository/ProjectInvitationRepository.java:16` | ✔ |
| seq-moi-thanh-vien | Message 18: `save(invitation [status=ACCEPTED])` | `ProjectInvitationRepository.save` (kế thừa `JpaRepository`) | `wpe-backend/src/main/java/com/pipeline/wpe/repository/ProjectInvitationRepository.java:16` | ✔ |
| seq-moi-thanh-vien | Message 19: `existsByProjectIdAndUserIdAndRemovedAtIsNull(...)` | `ProjectMemberRepository.existsByProjectIdAndUserIdAndRemovedAtIsNull` | `wpe-backend/src/main/java/com/pipeline/wpe/repository/ProjectMemberRepository.java:16` | ✔ |
| seq-moi-thanh-vien | Message 20: `save(new ProjectMemberEntity)` | `ProjectMemberRepository.save` (kế thừa `JpaRepository`) | `wpe-backend/src/main/java/com/pipeline/wpe/repository/ProjectMemberRepository.java:11` | ✔ |
| seq-moi-thanh-vien | Message 21: `findByUserIdAndIsReadFalseOrderByCreatedAtDesc(userId)` | `NotificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc` | `wpe-backend/src/main/java/com/pipeline/wpe/repository/NotificationRepository.java:12` | ✔ |
| seq-moi-thanh-vien | Message 22: `save(notification)` | `NotificationRepository.save` (kế thừa `JpaRepository`) | `wpe-backend/src/main/java/com/pipeline/wpe/repository/NotificationRepository.java:10` | ✔ |
| seq-moi-thanh-vien | Message 23: `findById(projectId)` (chấp nhận) | `ProjectRepository.findById` (kế thừa `JpaRepository`) | `wpe-backend/src/main/java/com/pipeline/wpe/repository/ProjectRepository.java:13` | ✔ |
| seq-moi-thanh-vien | Message 24: `findById(currentUserId)` (chấp nhận) | `UserRepository.findById` (kế thừa `JpaRepository`) | `wpe-backend/src/main/java/com/pipeline/wpe/repository/UserRepository.java:10` | ✔ |
| seq-moi-thanh-vien | Message 25: `publishInvitationAccepted(event)` | `WorkflowEventPublisher.publishInvitationAccepted` | `wpe-backend/src/main/java/com/pipeline/wpe/service/event/WorkflowEventPublisher.java:75` | ✔ |
| seq-moi-thanh-vien | Message 26: `handleInvitationAccepted(event)` | `InvitationEventConsumer.handleInvitationAccepted` | `wpe-backend/src/main/java/com/pipeline/wpe/service/event/InvitationEventConsumer.java:64` | ✔ |

---

## 2. Sơ đồ tuần tự: Khách gửi góp ý (`seq-gop-y-khach.puml`)

| Sơ đồ | Phần tử / Message | Lớp.phương thức / Kiểu | `file:dòng` | Khớp? |
| :--- | :--- | :--- | :--- | :---: |
| seq-gop-y-khach | Message 1: `POST /api/v1/guest/{token}/feedback` | `GuestGatewayController.submitGuestFeedback` | `wpe-backend/src/main/java/com/pipeline/wpe/controller/GuestGatewayController.java:65` | ✔ |
| seq-gop-y-khach | Message 2: `submitGuestFeedback(token, request)` | `FeedbackQueueService.submitGuestFeedback` | `wpe-backend/src/main/java/com/pipeline/wpe/service/FeedbackQueueService.java:52` | ✔ |
| seq-gop-y-khach | Message 3: `validateAndGetActiveGuestLink(token)` | `GuestGatewayService.validateAndGetActiveGuestLink` | `wpe-backend/src/main/java/com/pipeline/wpe/service/GuestGatewayService.java:202` | ✔ |
| seq-gop-y-khach | Message 4: `findByToken(token)` | `GuestLinkRepository.findByToken` | `wpe-backend/src/main/java/com/pipeline/wpe/repository/GuestLinkRepository.java:11` | ✔ |
| seq-gop-y-khach | Message 5: `getProjectOrThrow(projectId)` | `ProjectAuthorizationService.getProjectOrThrow` | `wpe-backend/src/main/java/com/pipeline/wpe/service/ProjectAuthorizationService.java:22` | ✔ |
| seq-gop-y-khach | Message 6: `findById(projectId)` | `ProjectRepository.findById` (kế thừa `JpaRepository`) | `wpe-backend/src/main/java/com/pipeline/wpe/repository/ProjectRepository.java:13` | ✔ |
| seq-gop-y-khach | Message 7: `countByProjectIdAndCreatedAtAfter(projectId, since)` | `ProjectFeedbackRepository.countByProjectIdAndCreatedAtAfter` | `wpe-backend/src/main/java/com/pipeline/wpe/repository/ProjectFeedbackRepository.java:17` | ✔ |
| seq-gop-y-khach | Message 8: `findFirstByProjectIdAndCreatedAtAfterOrderByCreatedAtAsc(...)` | `ProjectFeedbackRepository.findFirstByProjectIdAndCreatedAtAfterOrderByCreatedAtAsc` | `wpe-backend/src/main/java/com/pipeline/wpe/repository/ProjectFeedbackRepository.java:18` | ✔ |
| seq-gop-y-khach | Message 9: `findById(request.nodeId())` | `NodeRepository.findById` (kế thừa `JpaRepository`) | `wpe-backend/src/main/java/com/pipeline/wpe/repository/NodeRepository.java:17` | ✔ |
| seq-gop-y-khach | Message 10: `save(feedback)` | `ProjectFeedbackRepository.save` (kế thừa `JpaRepository`) | `wpe-backend/src/main/java/com/pipeline/wpe/repository/ProjectFeedbackRepository.java:13` | ✔ |
| seq-gop-y-khach | Message 11: `publishNotification(notificationEvent)` | `WorkflowEventPublisher.publishNotification` | `wpe-backend/src/main/java/com/pipeline/wpe/service/event/WorkflowEventPublisher.java:45` | ✔ |

---

## 3. Sơ đồ tuần tự: Chạy chẩn đoán AI (`seq-chan-doan-ai.puml`)

| Sơ đồ | Phần tử / Message | Lớp.phương thức / Kiểu | `file:dòng` | Khớp? |
| :--- | :--- | :--- | :--- | :---: |
| seq-chan-doan-ai | Message 1: `POST /api/v1/projects/{id}/ai-diagnostics` | `AiDiagnosticController.triggerAiDiagnostics` | `wpe-backend/src/main/java/com/pipeline/wpe/controller/AiDiagnosticController.java:30` | ✔ |
| seq-chan-doan-ai | Message 2: `triggerAiDiagnostics(id)` | `AiDiagnosticService.triggerAiDiagnostics` | `wpe-backend/src/main/java/com/pipeline/wpe/service/ai/AiDiagnosticService.java:65` | ✔ |
| seq-chan-doan-ai | Message 3: `verifyProjectMemberOrOwner(projectId, userId)` | `ProjectAuthorizationService.verifyProjectMemberOrOwner` | `wpe-backend/src/main/java/com/pipeline/wpe/service/ProjectAuthorizationService.java:42` | ✔ |
| seq-chan-doan-ai | Message 4: `findByProjectId(projectId)` | `NodeRepository.findByProjectId` | `wpe-backend/src/main/java/com/pipeline/wpe/repository/NodeRepository.java:18` | ✔ |
| seq-chan-doan-ai | Message 5: `findByProjectIdAndStatus(projectId, OPEN)` | `ProjectFeedbackRepository.findByProjectIdAndStatus` | `wpe-backend/src/main/java/com/pipeline/wpe/repository/ProjectFeedbackRepository.java:15` | ✔ |
| seq-chan-doan-ai | Message 6: `requestDiagnosis(project, nodes, openFeedbacks)` | `AiServiceClient.requestDiagnosis` | `wpe-backend/src/main/java/com/pipeline/wpe/service/ai/AiServiceClient.java:24` | ✔ |
| seq-chan-doan-ai | Message 7: `save(project)` | `ProjectRepository.save` (kế thừa `JpaRepository`) | `wpe-backend/src/main/java/com/pipeline/wpe/repository/ProjectRepository.java:13` | ✔ |

---

## 4. Sơ đồ máy trạng thái: Vòng đời Lời mời & Góp ý (`state-loi-moi.puml`)

| Sơ đồ | Trạng thái (State) | Enum trong Code Java | `file:dòng` | Khớp? |
| :--- | :--- | :--- | :--- | :---: |
| state-loi-moi | `PENDING` | `InvitationStatus.PENDING` | `wpe-backend/src/main/java/com/pipeline/wpe/common/enums/InvitationStatus.java:4` | ✔ |
| state-loi-moi | `ACCEPTED` | `InvitationStatus.ACCEPTED` | `wpe-backend/src/main/java/com/pipeline/wpe/common/enums/InvitationStatus.java:5` | ✔ |
| state-loi-moi | `REJECTED` | `InvitationStatus.REJECTED` | `wpe-backend/src/main/java/com/pipeline/wpe/common/enums/InvitationStatus.java:6` | ✔ |
| state-loi-moi | `REVOKED` | `InvitationStatus.REVOKED` | `wpe-backend/src/main/java/com/pipeline/wpe/common/enums/InvitationStatus.java:7` | ✔ |
| state-loi-moi | `EXPIRED` | `InvitationStatus.EXPIRED` | `wpe-backend/src/main/java/com/pipeline/wpe/common/enums/InvitationStatus.java:8` | ✔ |
| state-loi-moi | `OPEN` | `FeedbackStatus.OPEN` | `wpe-backend/src/main/java/com/pipeline/wpe/common/enums/FeedbackStatus.java:4` | ✔ |
| state-loi-moi | `RESOLVED` | `FeedbackStatus.RESOLVED` | `wpe-backend/src/main/java/com/pipeline/wpe/common/enums/FeedbackStatus.java:5` | ✔ |

> **Ghi chú về xử lý trạng thái EXPIRED:**
> - Trong `ProjectInvitationService.java:191,258`, cả hai phương thức `acceptInvitation` và `rejectInvitation` đều khai báo `@Transactional(noRollbackFor = ConflictException.class)`. Khi phát hiện lời mời quá hạn, hệ thống đặt `status = EXPIRED`, lưu vào DB rồi ném `ConflictException("INVITATION_EXPIRED")` (HTTP 409). Do ngoại lệ thuộc danh sách `noRollbackFor`, giao dịch được commit và trạng thái `EXPIRED` được ghi nhận vĩnh viễn vào CSDL.
> - Đồng thời, tiến trình định kỳ `InvitationExpiryJob.expireOverdueInvitations` (`InvitationExpiryJob.java:22`) chạy nền mỗi 1 giờ để quét và cập nhật hàng loạt các lời mời quá hạn sang `EXPIRED`.
> - Khi gửi lời mời mới (`sendInvitation`), nếu tồn tại lời mời PENDING cũ đã quá hạn, hệ thống gọi `saveAndFlush` đóng lời mời cũ sang `EXPIRED` trước khi tạo lời mời mới.

---

## 5. Danh mục Xử lý Ngoại lệ & Mã lỗi HTTP (Exception Mapping)

| Tình huống nghiệp vụ | Exception ném ra | Handler trong GlobalExceptionHandler | Mã lỗi & HTTP Status |
| :--- | :--- | :--- | :---: |
| Không phải chủ dự án gửi lời mời | `ForbiddenException("ACCESS_DENIED")` | `handleForbidden` (`GlobalExceptionHandler.java:30`) | `403 ACCESS_DENIED` |
| Người dùng đã có lời mời PENDING còn hạn | `ConflictException("INVITATION_ALREADY_PENDING")` | `handleConflict` (`GlobalExceptionHandler.java:87`) | `409 INVITATION_ALREADY_PENDING` |
| Lời mời quá hạn khi chấp nhận / từ chối | `ConflictException("INVITATION_EXPIRED")` | `handleConflict` (`GlobalExceptionHandler.java:87`) | `409 INVITATION_EXPIRED` |
| Lời mời không còn ở trạng thái PENDING | `ConflictException("INVITATION_NOT_PENDING")` | `handleConflict` (`GlobalExceptionHandler.java:87`) | `409 INVITATION_NOT_PENDING` |
| Xung đột version khi cập nhật lời mời đồng thời | `OptimisticLockingFailureException` | `handleOptimisticLock` (`GlobalExceptionHandler.java:76`) | `409 OPTIMISTIC_LOCK_CONFLICT` |
| Token khách bị thu hồi / hết hạn / không tồn tại | `ForbiddenException("REVOKED_GUEST")` | `handleForbidden` (`GlobalExceptionHandler.java:30`) | `403 REVOKED_GUEST` |
| Góp ý khách quá 2000 ký tự | `IllegalArgumentException("Nội dung góp ý tối đa 2000 ký tự.")` | `handleIllegalArgument` (`GlobalExceptionHandler.java:123`) | `400 BAD_REQUEST` |
| Vượt quá 10 góp ý trong 1 giờ (Rate limit) | `CooldownActiveException(retryAfter)` | `handleCooldownActive` (`GlobalExceptionHandler.java:52`) | `429 COOLDOWN_ACTIVE` |
| Chẩn đoán AI chưa hết cooldown 180s | `CooldownActiveException(remainingSeconds)` | `handleCooldownActive` (`GlobalExceptionHandler.java:52`) | `429 COOLDOWN_ACTIVE` |
| Không có quyền đổi người làm / hạn chót | `ForbiddenException("ACCESS_DENIED")` | `handleForbidden` (`GlobalExceptionHandler.java:30`) | `403 ACCESS_DENIED` |
| Template riêng truy cập trái phép | `ResourceNotFoundException` | `handleResourceNotFound` (`GlobalExceptionHandler.java:19`) | `404 RESOURCE_NOT_FOUND` |

---

## 6. Danh mục Lớp và Phương thức mới bổ sung (D8 Class Diagram)

| Lớp | Phương thức / Phần tử mới | Mục đích nghiệp vụ | `file:dòng` |
| :--- | :--- | :--- | :--- |
| `NodeAssignmentController` | `updateAssignment` | Đổi người phụ trách hoặc hạn chót của công việc (`PATCH /nodes/{id}/assignment`) | `wpe-backend/src/main/java/com/pipeline/wpe/controller/NodeAssignmentController.java:27` |
| `NodeAssignmentService` | `updateAssignment` | Thực hiện đổi người phụ trách/deadline kèm kiểm tra quyền OWNER hoặc MANAGER | `wpe-backend/src/main/java/com/pipeline/wpe/service/NodeAssignmentService.java:32` |
| `ProjectAuthorizationService` | `isOwnerOrManager` | Kiểm tra người dùng có vai trò OWNER hoặc MANAGER | `wpe-backend/src/main/java/com/pipeline/wpe/service/ProjectAuthorizationService.java:58` |
| `ProjectAuthorizationService` | `verifyProjectOwnerOrManager` | Thẩm định quyền OWNER hoặc MANAGER, ném 403 nếu không thỏa | `wpe-backend/src/main/java/com/pipeline/wpe/service/ProjectAuthorizationService.java:70` |
| `ProjectMemberController` | `getMemberHistory` | API lấy toàn bộ lịch sử thành viên dự án (`GET /projects/{id}/members/history`) | `wpe-backend/src/main/java/com/pipeline/wpe/controller/ProjectMemberController.java:36` |
| `ProjectMemberService` | `getMemberHistory` | Lấy lịch sử thành viên dự án (mỗi lần tham gia là một dòng theo Cách B) | `wpe-backend/src/main/java/com/pipeline/wpe/service/ProjectMemberService.java:98` |
| `PipelineTemplateController` | `saveProjectAsTemplate` | API lưu dự án thành template cá nhân (`POST /projects/{id}/save-as-template`) | `wpe-backend/src/main/java/com/pipeline/wpe/controller/PipelineTemplateController.java:112` |
| `PipelineTemplateService` | `saveProjectAsTemplate` | Trích xuất DAG dự án và lưu thành template riêng tư (`PRIVATE`) | `wpe-backend/src/main/java/com/pipeline/wpe/service/PipelineTemplateService.java:226` |
| `InvitationExpiryJob` | `expireOverdueInvitations` | Scheduled job định kỳ mỗi 1 giờ quét chuyển lời mời quá hạn sang EXPIRED | `wpe-backend/src/main/java/com/pipeline/wpe/service/InvitationExpiryJob.java:22` |
| `InvitationEventConsumer` | `handleInvitationCreated` | Consumer nhận sự kiện lời mời mới và đẩy SSE `NOTIFICATION_RECEIVED` | `wpe-backend/src/main/java/com/pipeline/wpe/service/event/InvitationEventConsumer.java:43` |
| `InvitationEventConsumer` | `handleInvitationAccepted` | Consumer nhận sự kiện lời mời được chấp nhận | `wpe-backend/src/main/java/com/pipeline/wpe/service/event/InvitationEventConsumer.java:64` |
| `HttpAiServiceClient` | `requestDiagnosis` | Kết nối HTTP sang microservice AI Python, tự fallback về mock khi có sự cố | `wpe-backend/src/main/java/com/pipeline/wpe/service/ai/HttpAiServiceClient.java:58` |
| `AiDiagnosisRequest` | `from` | Hàm static sinh payload JSON gửi sang Python AI microservice | `wpe-backend/src/main/java/com/pipeline/wpe/service/ai/AiDiagnosisRequest.java:47` |
| `ProjectRole` | `MANAGER` | Vai trò Quản lý dự án mới (được duyệt task, đổi người làm/deadline, xử lý góp ý) | `wpe-backend/src/main/java/com/pipeline/wpe/common/enums/ProjectRole.java:5` |
| `TemplateVisibility` | `PUBLIC`, `PRIVATE` | Enum phạm vi hiển thị của template quy trình mẫu | `wpe-backend/src/main/java/com/pipeline/wpe/common/enums/TemplateVisibility.java:4-5` |
