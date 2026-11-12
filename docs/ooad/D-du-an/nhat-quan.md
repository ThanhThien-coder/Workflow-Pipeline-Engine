# Ma trận nhất quán giữa Sơ đồ thiết kế OOAD và Mã nguồn (Mảng D - Dự án)

Bảng đối chiếu tuân thủ theo cẩm nang OOAD (Mục 4) nhằm chứng minh mọi message trong sequence diagram, communication diagram và mọi trạng thái trong state machine diagram đều ánh xạ 1-1 tới phương thức và enum trong mã nguồn backend Spring Boot.

---

## 1. Sơ đồ tuần tự: Mời thành viên (`seq-moi-thanh-vien.puml`) & Sơ đồ giao tiếp (`comm-moi-thanh-vien.puml`)

| Sơ đồ | Phần tử / Message | Lớp.phương thức / Kiểu | `file:dòng` | Khớp? |
| :--- | :--- | :--- | :--- | :---: |
| seq-moi-thanh-vien | Message 1: `POST /api/v1/projects/{projectId}/invitations` | `ProjectInvitationController.createInvitation` | `wpe-backend/src/main/java/com/pipeline/wpe/controller/ProjectInvitationController.java:29` | ✔ |
| seq-moi-thanh-vien | Message 2: `sendInvitation(projectId, request, currentUserId)` | `ProjectInvitationService.sendInvitation` | `wpe-backend/src/main/java/com/pipeline/wpe/service/ProjectInvitationService.java:52` | ✔ |
| seq-moi-thanh-vien | Message 3: `findById(projectId)` | `ProjectRepository.findById` (kế thừa `JpaRepository`) | `wpe-backend/src/main/java/com/pipeline/wpe/repository/ProjectRepository.java:13` | ✔ |
| seq-moi-thanh-vien | Message 4: `findById(currentUserId)` | `UserRepository.findById` (kế thừa `JpaRepository`) | `wpe-backend/src/main/java/com/pipeline/wpe/repository/UserRepository.java:10` | ✔ |
| seq-moi-thanh-vien | Message 5: `findByEmail(identifier)` | `UserRepository.findByEmail` | `wpe-backend/src/main/java/com/pipeline/wpe/repository/UserRepository.java:12` | ✔ |
| seq-moi-thanh-vien | Message 6: `findByUsername(identifier)` | `UserRepository.findByUsername` | `wpe-backend/src/main/java/com/pipeline/wpe/repository/UserRepository.java:11` | ✔ |
| seq-moi-thanh-vien | Message 7: `existsByProjectIdAndUserIdAndRemovedAtIsNull(...)` | `ProjectMemberRepository.existsByProjectIdAndUserIdAndRemovedAtIsNull` | `wpe-backend/src/main/java/com/pipeline/wpe/repository/ProjectMemberRepository.java:16` | ✔ |
| seq-moi-thanh-vien | Message 8: `existsByProjectIdAndInviteeIdAndStatus(...)` | `ProjectInvitationRepository.existsByProjectIdAndInviteeIdAndStatus` | `wpe-backend/src/main/java/com/pipeline/wpe/repository/ProjectInvitationRepository.java:16` | ✔ |
| seq-moi-thanh-vien | Message 9: `save(invitation)` | `ProjectInvitationRepository.save` (kế thừa `JpaRepository`) | `wpe-backend/src/main/java/com/pipeline/wpe/repository/ProjectInvitationRepository.java:12` | ✔ |
| seq-moi-thanh-vien | Message 10: `save(notification)` | `NotificationRepository.save` (kế thừa `JpaRepository`) | `wpe-backend/src/main/java/com/pipeline/wpe/repository/NotificationRepository.java:10` | ✔ |
| seq-moi-thanh-vien | Message 11: `publishInvitationCreated(event)` | `WorkflowEventPublisher.publishInvitationCreated` | `wpe-backend/src/main/java/com/pipeline/wpe/service/event/WorkflowEventPublisher.java:66` | ✔ |
| seq-moi-thanh-vien | Message 12: `POST /api/v1/invitations/{id}/accept` | `ProjectInvitationController.acceptInvitation` | `wpe-backend/src/main/java/com/pipeline/wpe/controller/ProjectInvitationController.java:95` | ✔ |
| seq-moi-thanh-vien | Message 13: `acceptInvitation(invitationId, currentUserId)` | `ProjectInvitationService.acceptInvitation` | `wpe-backend/src/main/java/com/pipeline/wpe/service/ProjectInvitationService.java:182` | ✔ |
| seq-moi-thanh-vien | Message 14: `findById(invitationId)` | `ProjectInvitationRepository.findById` (kế thừa `JpaRepository`) | `wpe-backend/src/main/java/com/pipeline/wpe/repository/ProjectInvitationRepository.java:12` | ✔ |
| seq-moi-thanh-vien | Message 15: `save(invitation [status=EXPIRED])` | `ProjectInvitationRepository.save` (kế thừa `JpaRepository`) | `wpe-backend/src/main/java/com/pipeline/wpe/repository/ProjectInvitationRepository.java:12` | ⚠ lệch: bị rollback |
| seq-moi-thanh-vien | Message 16: `save(invitation [status=ACCEPTED])` | `ProjectInvitationRepository.save` (kế thừa `JpaRepository`) | `wpe-backend/src/main/java/com/pipeline/wpe/repository/ProjectInvitationRepository.java:12` | ✔ |
| seq-moi-thanh-vien | Message 17: `findByProjectIdAndUserId(projectId, userId)` | `ProjectMemberRepository.findByProjectIdAndUserId` | `wpe-backend/src/main/java/com/pipeline/wpe/repository/ProjectMemberRepository.java:15` | ✔ |
| seq-moi-thanh-vien | Message 18: `save(member)` | `ProjectMemberRepository.save` (kế thừa `JpaRepository`) | `wpe-backend/src/main/java/com/pipeline/wpe/repository/ProjectMemberRepository.java:11` | ✔ |
| seq-moi-thanh-vien | Message 19: `findByUserIdAndIsReadFalseOrderByCreatedAtDesc(userId)` | `NotificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc` | `wpe-backend/src/main/java/com/pipeline/wpe/repository/NotificationRepository.java:12` | ✔ |
| seq-moi-thanh-vien | Message 20: `save(notification)` | `NotificationRepository.save` (kế thừa `JpaRepository`) | `wpe-backend/src/main/java/com/pipeline/wpe/repository/NotificationRepository.java:10` | ✔ |
| seq-moi-thanh-vien | Message 21: `findById(projectId)` (chấp nhận) | `ProjectRepository.findById` (kế thừa `JpaRepository`) | `wpe-backend/src/main/java/com/pipeline/wpe/repository/ProjectRepository.java:13` | ✔ |
| seq-moi-thanh-vien | Message 22: `findById(currentUserId)` (chấp nhận) | `UserRepository.findById` (kế thừa `JpaRepository`) | `wpe-backend/src/main/java/com/pipeline/wpe/repository/UserRepository.java:10` | ✔ |
| seq-moi-thanh-vien | Message 23: `publishInvitationAccepted(event)` | `WorkflowEventPublisher.publishInvitationAccepted` | `wpe-backend/src/main/java/com/pipeline/wpe/service/event/WorkflowEventPublisher.java:79` | ✔ |

---

## 2. Sơ đồ tuần tự: Khách gửi góp ý (`seq-gop-y-khach.puml`)

| Sơ đồ | Phần tử / Message | Lớp.phương thức / Kiểu | `file:dòng` | Khớp? |
| :--- | :--- | :--- | :--- | :---: |
| seq-gop-y-khach | Message 1: `POST /api/v1/guest/{token}/feedback` | `GuestGatewayController.submitGuestFeedback` | `wpe-backend/src/main/java/com/pipeline/wpe/controller/GuestGatewayController.java:65` | ✔ |
| seq-gop-y-khach | Message 2: `submitGuestFeedback(token, request)` | `FeedbackQueueService.submitGuestFeedback` | `wpe-backend/src/main/java/com/pipeline/wpe/service/FeedbackQueueService.java:52` | ✔ |
| seq-gop-y-khach | Message 3: `validateAndGetActiveGuestLink(token)` | `GuestGatewayService.validateAndGetActiveGuestLink` | `wpe-backend/src/main/java/com/pipeline/wpe/service/GuestGatewayService.java:202` | ✔ |
| seq-gop-y-khach | Message 4: `findByToken(token)` | `GuestLinkRepository.findByToken` | `wpe-backend/src/main/java/com/pipeline/wpe/repository/GuestLinkRepository.java:11` | ✔ |
| seq-gop-y-khach | Message 5: `getProjectOrThrow(projectId)` | `ProjectAuthorizationService.getProjectOrThrow` | `wpe-backend/src/main/java/com/pipeline/wpe/service/ProjectAuthorizationService.java:21` | ✔ |
| seq-gop-y-khach | Message 6: `findById(projectId)` | `ProjectRepository.findById` (kế thừa `JpaRepository`) | `wpe-backend/src/main/java/com/pipeline/wpe/repository/ProjectRepository.java:13` | ✔ |
| seq-gop-y-khach | Message 7: `countByProjectIdAndCreatedAtAfter(projectId, since)` | `ProjectFeedbackRepository.countByProjectIdAndCreatedAtAfter` | `wpe-backend/src/main/java/com/pipeline/wpe/repository/ProjectFeedbackRepository.java:17` | ✔ |
| seq-gop-y-khach | Message 8: `findFirstByProjectIdAndCreatedAtAfterOrderByCreatedAtAsc(...)` | `ProjectFeedbackRepository.findFirstByProjectIdAndCreatedAtAfterOrderByCreatedAtAsc` | `wpe-backend/src/main/java/com/pipeline/wpe/repository/ProjectFeedbackRepository.java:18` | ✔ |
| seq-gop-y-khach | Message 9: `findById(request.nodeId())` | `NodeRepository.findById` (kế thừa `JpaRepository`) | `wpe-backend/src/main/java/com/pipeline/wpe/repository/NodeRepository.java:15` | ✔ |
| seq-gop-y-khach | Message 10: `save(feedback)` | `ProjectFeedbackRepository.save` (kế thừa `JpaRepository`) | `wpe-backend/src/main/java/com/pipeline/wpe/repository/ProjectFeedbackRepository.java:13` | ✔ |
| seq-gop-y-khach | Message 11: `publishNotification(notificationEvent)` | `WorkflowEventPublisher.publishNotification` | `wpe-backend/src/main/java/com/pipeline/wpe/service/event/WorkflowEventPublisher.java:40` | ✔ |

---

## 3. Sơ đồ tuần tự: Chạy chẩn đoán AI (`seq-chan-doan-ai.puml`)

| Sơ đồ | Phần tử / Message | Lớp.phương thức / Kiểu | `file:dòng` | Khớp? |
| :--- | :--- | :--- | :--- | :---: |
| seq-chan-doan-ai | Message 1: `POST /api/v1/projects/{id}/ai-diagnostics` | `AiDiagnosticController.triggerAiDiagnostics` | `wpe-backend/src/main/java/com/pipeline/wpe/controller/AiDiagnosticController.java:30` | ✔ |
| seq-chan-doan-ai | Message 2: `triggerAiDiagnostics(id)` | `AiDiagnosticService.triggerAiDiagnostics` | `wpe-backend/src/main/java/com/pipeline/wpe/service/ai/AiDiagnosticService.java:65` | ✔ |
| seq-chan-doan-ai | Message 3: `verifyProjectMemberOrOwner(projectId, userId)` | `ProjectAuthorizationService.verifyProjectMemberOrOwner` | `wpe-backend/src/main/java/com/pipeline/wpe/service/ProjectAuthorizationService.java:41` | ✔ |
| seq-chan-doan-ai | Message 4: `findByProjectId(projectId)` | `NodeRepository.findByProjectId` | `wpe-backend/src/main/java/com/pipeline/wpe/repository/NodeRepository.java:16` | ✔ |
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
| state-loi-moi | `EXPIRED` | `InvitationStatus.EXPIRED` | `wpe-backend/src/main/java/com/pipeline/wpe/common/enums/InvitationStatus.java:8` | ⚠ lệch: bị rollback |
| state-loi-moi | `OPEN` | `FeedbackStatus.OPEN` | `wpe-backend/src/main/java/com/pipeline/wpe/common/enums/FeedbackStatus.java:4` | ✔ |
| state-loi-moi | `RESOLVED` | `FeedbackStatus.RESOLVED` | `wpe-backend/src/main/java/com/pipeline/wpe/common/enums/FeedbackStatus.java:5` | ✔ |

> ⚠ **Ghi chú về rollback trạng thái EXPIRED:** Trong `ProjectInvitationService.java:194-199`, khi phát hiện lời mời quá hạn, code gán `invitation.setStatus(InvitationStatus.EXPIRED)` và `save(invitation)`, nhưng ngay sau đó lại ném `throw new IllegalArgumentException(...)` trong phương thức có `@Transactional`. Điều này khiến Spring rollback toàn bộ transaction, do đó trạng thái `EXPIRED` KHÔNG được lưu vào DB (lỗi code, cần nhóm sửa); đồng thời hiện tại hệ thống chưa có background job quét hết hạn tự động sau 7 ngày.

---

## 5. Danh mục Xử lý Ngoại lệ & Mã lỗi HTTP (Exception Mapping)

| Tình huống nghiệp vụ | Exception ném ra | Handler trong GlobalExceptionHandler | Mã lỗi & HTTP Status |
| :--- | :--- | :--- | :---: |
| Không phải chủ dự án gửi lời mời | `ForbiddenException("ACCESS_DENIED")` | `handleForbidden` (`GlobalExceptionHandler.java:30`) | `403 ACCESS_DENIED` |
| Người dùng đã có lời mời PENDING | `ConflictException("INVITATION_ALREADY_PENDING")` | `handleConflict` (`GlobalExceptionHandler.java:87`) | `409 INVITATION_ALREADY_PENDING` |
| Lời mời quá hạn khi chấp nhận | `IllegalArgumentException("Lời mời tham gia dự án đã hết hạn.")` | `handleIllegalArgument` (`GlobalExceptionHandler.java:123`) | `400 BAD_REQUEST` |
| Xung đột version khi cập nhật lời mời đồng thời | `OptimisticLockingFailureException` | `handleOptimisticLock` (`GlobalExceptionHandler.java:76`) | `409 OPTIMISTIC_LOCK_CONFLICT` |
| Token khách bị thu hồi / hết hạn / không tồn tại | `ForbiddenException("REVOKED_GUEST")` | `handleForbidden` (`GlobalExceptionHandler.java:30`) | `403 REVOKED_GUEST` |
| Góp ý khách quá 2000 ký tự | `IllegalArgumentException("Nội dung góp ý tối đa 2000 ký tự.")` | `handleIllegalArgument` (`GlobalExceptionHandler.java:123`) | `400 BAD_REQUEST` |
| Vượt quá 10 góp ý trong 1 giờ (Rate limit) | `CooldownActiveException(retryAfter)` | `handleCooldownActive` (`GlobalExceptionHandler.java:52`) | `429 COOLDOWN_ACTIVE` |
| Chẩn đoán AI chưa hết cooldown 180s | `CooldownActiveException(remainingSeconds)` | `handleCooldownActive` (`GlobalExceptionHandler.java:52`) | `429 COOLDOWN_ACTIVE` |
