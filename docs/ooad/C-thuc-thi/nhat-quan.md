# Ma trận nhất quán — Mảng C: Chạy task & Realtime (C8)

Mỗi message trong sơ đồ sequence ứng với một phương thức thật; mỗi chuyển trạng thái ứng với một nhánh code.
`BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.

**Số dòng lấy ở đâu:** FE và BE lấy trên main `7d5a5b1`; `BE/controller/NodeController.java` lấy trên main sau #56 (`1895969`); riêng `BE/service/engine/StateMachineService.java` và `BE/dto/artifact/ArtifactUrlValidator.java` lấy trên nhánh `c4-artifacts` (`2fe00a3`, PR #49). Từ lúc C4 tách nhánh, main không sửa file backend nào của mảng C, nên khi #49 merge thì số dòng ở đây là số dòng trên main.

Cột "Dòng gọi" là chỗ lời gọi nằm trong code của bên gửi; cột "Định nghĩa" là chỗ phương thức được khai báo ở lớp nhận. "Spring" = phương thức của thư viện (JPA, Spring TX, Spring AMQP), không có trong repo.

## 1. `seq-duyet-task.puml` — Duyệt task → task con tự mở khóa

| # | Message | Lớp nhận.phương thức | Dòng gọi | Định nghĩa | Khớp? |
| :-: | :--- | :--- | :--- | :--- | :-: |
| 1 | bấm "Approve" | nút trong `TaskDetailModal` | — | `FE/components/kanban/TaskDetailModal.tsx:591–596` | ✔ |
| 2 | `moveTask(taskId, "DONE")` | `usePhaseKanban.moveTask` (prop `onMove`) | `FE/components/kanban/TaskDetailModal.tsx:595` → `FE/components/workflow/MindmapDrawer.tsx:468` | `FE/hooks/usePhaseKanban.ts:188` | ✔ |
| 3 | `evaluateTransition(task, "DONE", actor)` | hàm `evaluateTransition` | `FE/hooks/usePhaseKanban.ts:197` | `FE/domain/taskTransitions.ts:3` | ✔ |
| 4 | `updateTaskStatus(taskId, "DONE")` | `HttpWorkflowService.updateTaskStatus` | `FE/hooks/usePhaseKanban.ts:237` | `FE/services/impl/HttpWorkflowService.ts:132` | ✔ |
| 5 | `PATCH /api/v1/nodes/{taskId}/status` | `NodeController.updateStatus` | `FE/services/impl/HttpWorkflowService.ts:134` (`apiRequest`) | `BE/controller/NodeController.java:54–59` | ✔ |
| 6 | `updateStatus(taskId, request, actorId)` | `StateMachineService.updateStatus` | `BE/controller/NodeController.java:64` | `BE/service/engine/StateMachineService.java:104` | ✔ |
| 7–8 | `findById(taskId)` | `NodeRepository.findById` | `StateMachineService.java:105` | Spring (`JpaRepository`) | ✔ |
| 9–10 | `findById(projectId)` | `ProjectRepository.findById` | `StateMachineService.java:130` | Spring (`JpaRepository`) | ✔ |
| 11 | `ensureNotArchived(project)` | `StateMachineService.ensureNotArchived` (private) | `StateMachineService.java:132` | `StateMachineService.java:450` | ✔ |
| 12–13 | `findByProjectIdAndUserIdAndRemovedAtIsNull` | `ProjectMemberRepository` | `StateMachineService.java:136` (chỉ chạy khi không phải Owner: `isOwner \|\| …`) | `BE/repository/ProjectMemberRepository.java:14` | ✔ |
| 14 | `publishTaskCompleted(event)` | `WorkflowEventPublisher.publishTaskCompleted` | `StateMachineService.java:153` | `BE/service/event/WorkflowEventPublisher.java:36` | ✔ |
| 15 | `sendAfterCommit(routingKey, event, mô tả)` | `WorkflowEventPublisher.sendAfterCommit` (private) | `WorkflowEventPublisher.java:39` | `WorkflowEventPublisher.java:94` | ✔ |
| 16 | `registerSynchronization(afterCompletion)` | `TransactionSynchronizationManager` | `WorkflowEventPublisher.java:99` | Spring | ✔ |
| 18–19 | `save(node)` | `NodeRepository.save` | `StateMachineService.java:221` | Spring (`JpaRepository`) | ✔ |
| 20 | `afterCommit(...)` | `StateMachineService.afterCommit` (private) | `StateMachineService.java:227` | `StateMachineService.java:464` | ✔ |
| 21 | `registerSynchronization(afterCompletion)` | `TransactionSynchronizationManager` | `StateMachineService.java:469` | Spring | ✔ |
| 22 | `afterCompletion(STATUS_COMMITTED)` | lớp vô danh trong `sendAfterCommit` | Spring gọi sau commit | `WorkflowEventPublisher.java:101` | ✔ |
| 23 | `convertAndSend(exchange, "wpe.task.completed", event)` | `RabbitTemplate.convertAndSend` | `WorkflowEventPublisher.java:106` | Spring AMQP; binding `BE/config/RabbitMQConfig.java:73` | ✔ |
| 24 | `afterCompletion(STATUS_COMMITTED)` | lớp vô danh trong `afterCommit` | Spring gọi sau commit | `StateMachineService.java:471` | ✔ |
| 25 | `sendToUser(assigneeId, "TASK_STATUS_CHANGED", …)` | `SseEmitterService.sendToUser` | `StateMachineService.java:229` (Owner: `:232`) | `BE/service/event/SseEmitterService.java:89` | ✔ |
| 26 | trả `KanbanTaskResponse` | — | `StateMachineService.java:236` | — | ✔ |
| 27 | 200 `KanbanTaskResponse` | — | `NodeController.java:65` | — | ✔ |
| 28 | trả `KanbanTask` | — | `HttpWorkflowService.ts:142` | — | ✔ |
| 29 | thẻ ở cột Done | — | `usePhaseKanban.ts:239` (`setAllTasks`) | — | ✔ |
| 30 | `handleTaskCompleted(event)` | `WorkflowEventConsumer.handleTaskCompleted` | RabbitMQ giao (`@RabbitListener` queue `wpe.task.completed.queue`) | `BE/service/event/WorkflowEventConsumer.java:33–34` | ✔ |
| 31 | `unlockDownstreamTasks(event.taskId())` | `StateMachineService.unlockDownstreamTasks` | `WorkflowEventConsumer.java:41` | `StateMachineService.java:392` | ✔ |
| 32–33 | `findByParentNodeId(parentTaskId)` | `NodeDependencyRepository` | `StateMachineService.java:394` | `BE/repository/NodeDependencyRepository.java:13` | ✔ |
| loop | mỗi cạnh tới task con | vòng `for` | `StateMachineService.java:396` | — | ✔ |
| 34–35 | `findById(childId)` | `NodeRepository.findById` | `StateMachineService.java:398` | Spring | ✔ |
| opt | task con đang LOCKED | `if` | `StateMachineService.java:401` | — | ✔ |
| 36–37 | `findByChildNodeId(childId)` | `NodeDependencyRepository` | `StateMachineService.java:402` | `NodeDependencyRepository.java:14` | ✔ |
| alt / 38–39 | `[ALL_COMPLETED]` `findById(parentNodeId)` trong `allMatch` | `NodeRepository.findById` | `StateMachineService.java:405–408` | Spring | ✔ |
| alt / 40–41 | `[ANY_COMPLETED]` `findById(parentNodeId)` trong `anyMatch` | `NodeRepository.findById` | `StateMachineService.java:411–414` | Spring | ✔ |
| 42–43 | `save(childNode)` | `NodeRepository.save` | `StateMachineService.java:422` | Spring | ✔ |
| 44 | `publishNotification("TASK_READY")` | `WorkflowEventPublisher.publishNotification` | `StateMachineService.java:427` | `WorkflowEventPublisher.java:45` | ✔ |
| 45 | `registerSynchronization` | `TransactionSynchronizationManager` | `WorkflowEventPublisher.java:99` (qua `sendAfterCommit` ở `:48`) | Spring | ✔ |
| 47–48 | `afterCommit(...)`, `registerSynchronization` | `StateMachineService.afterCommit` | `StateMachineService.java:439`, `:469` | `StateMachineService.java:464` | ✔ |
| 49–50 | `afterCompletion` → `convertAndSend(…, "wpe.notification.task_ready", …)` | `RabbitTemplate.convertAndSend` | `WorkflowEventPublisher.java:101, 106` (routing key ghép ở `:48`) | binding `wpe.notification.#`: `RabbitMQConfig.java:87` | ✔ |
| 51–52 | `afterCompletion` → `sendToUser(assigneeId, "TASK_UNLOCKED", …)` | `SseEmitterService.sendToUser` | `StateMachineService.java:471, 439` | `SseEmitterService.java:89` | ✔ |
| 53 | event `TASK_UNLOCKED` | `EventSource` listener | `SseEmitterService.java:138` (`trySend`, gửi cho mọi emitter của user) | `FE/services/impl/HttpWorkflowService.ts:231` | ✔ |
| 54 | `onEvent → loadTasks(projectId)` | `kanbanSlice.loadTasks` | `HttpWorkflowService.ts:234` → callback `FE/views/MyTasksView.tsx:56–58` | `FE/store/slices/kanbanSlice.ts:26` | ✔ |
| — | xung đột `@Version` → ném lại để retry | — | `WorkflowEventConsumer.java:42–47` | — | ✔ |

## 2. `seq-nop-bai.puml` — Nộp bài kèm minh chứng

| # | Message | Lớp nhận.phương thức | Dòng gọi | Định nghĩa | Khớp? |
| :-: | :--- | :--- | :--- | :--- | :-: |
| 1 | bấm "Submit" | nút trong `SubmitArtifactModal` | — | `FE/components/kanban/SubmitArtifactModal.tsx:112` | ✔ |
| 2 | `isValidArtifactUrl(url)` | hàm tiện ích | `SubmitArtifactModal.tsx:28` | `FE/utils/artifactLabel.ts:11` | ✔ |
| 3 | `submitArtifact(taskId, {type, url, note})` | `usePhaseKanban.submitArtifact` (prop `onSubmit`) | `SubmitArtifactModal.tsx:32` → `FE/components/workflow/MindmapDrawer.tsx:483` | `FE/hooks/usePhaseKanban.ts:287` | ✔ |
| 4 | `submitTaskArtifact({taskId, type, url, note})` | `HttpWorkflowService.submitTaskArtifact` | `usePhaseKanban.ts:297` | `HttpWorkflowService.ts:146` | ✔ |
| 5 | `POST /api/v1/nodes/{taskId}/submit` | `NodeController.submitTask` | `HttpWorkflowService.ts:148` (`apiRequest`) | `BE/controller/NodeController.java:68–73` | ✔ |
| 6 | `submitTaskArtifact(taskId, request, actorId)` | `StateMachineService.submitTaskArtifact` | `NodeController.java:78` | `StateMachineService.java:243` | ✔ |
| 7–8 | `findById(taskId)` | `NodeRepository.findById` | `StateMachineService.java:244` | Spring | ✔ |
| 9–10 | `findById(projectId)` | `ProjectRepository.findById` | `StateMachineService.java:255` | Spring | ✔ |
| 11 | `ensureNotArchived(project)` | `StateMachineService.ensureNotArchived` | `StateMachineService.java:257` | `StateMachineService.java:450` | ✔ |
| 12–13 | `isValid(artifactUrl)` | `ArtifactUrlValidator.isValid` (static) | `StateMachineService.java:278` | `BE/dto/artifact/ArtifactUrlValidator.java:30` | ✔ |
| 14–15 | `save(node)` | `NodeRepository.save` | `StateMachineService.java:286` | Spring | ✔ |
| 16–17 | `save(artifact)` | `ArtifactRepository.save` | `StateMachineService.java:310` | Spring | ✔ |
| 18 | `publishNotification("REVIEW_REQUESTED")` | `WorkflowEventPublisher.publishNotification` | `StateMachineService.java:322` | `WorkflowEventPublisher.java:45` | ✔ |
| 19 | `registerSynchronization` | `TransactionSynchronizationManager` | `WorkflowEventPublisher.java:99` | Spring | ✔ |
| 21–22 | `afterCommit(...)`, `registerSynchronization` | `StateMachineService.afterCommit` | `StateMachineService.java:336`, `:469` | `StateMachineService.java:464` | ✔ |
| 23–24 | `afterCompletion` → `convertAndSend(…, "wpe.notification.review_requested", …)` | `RabbitTemplate.convertAndSend` | `WorkflowEventPublisher.java:101, 106` | binding `RabbitMQConfig.java:87` | ✔ |
| 25–26 | `afterCompletion` → `sendToUser(ownerId, "TASK_SUBMITTED", …)` | `SseEmitterService.sendToUser` | `StateMachineService.java:471, 336` | `SseEmitterService.java:89` | ✔ |
| 27 | event `TASK_SUBMITTED` | — | `SseEmitterService.java:138` | **FE không có listener** (`HttpWorkflowService.ts:223–260` chỉ nghe INIT, TASK_UNLOCKED, TASK_STATUS_CHANGED, NOTIFICATION_RECEIVED) | ⚠ ghi trên sơ đồ |
| 28 | trả `SubmitTaskArtifactResponse` | — | `StateMachineService.java:338` | — | ✔ |
| 29 | 200 | — | `NodeController.java:79` | — | ✔ |
| 30 | trả `{task, artifact}` | — | `HttpWorkflowService.ts:173` | — | ✔ |
| 31 | `true` | — | `usePhaseKanban.ts:331` | — | ✔ |
| 32 | `handleNotification(event)` | `WorkflowEventConsumer.handleNotification` | RabbitMQ giao (queue `wpe.notification.queue`) | `WorkflowEventConsumer.java:57–58` | ✔ |
| 33–34 | `save(NotificationEntity)` | `NotificationRepository.save` | `WorkflowEventConsumer.java:71` | Spring | ✔ |
| 35 | `sendToUser(ownerId, "NOTIFICATION_RECEIVED", NotificationResponse.from(saved))` | `SseEmitterService.sendToUser` | `WorkflowEventConsumer.java:75–76` | `SseEmitterService.java:89`; `NotificationResponse.from`: `BE/dto/response/notification/NotificationResponse.java:20` | ✔ |
| 36 | event `NOTIFICATION_RECEIVED` | `EventSource` listener | `SseEmitterService.java:138` | `HttpWorkflowService.ts:249` | ✔ |

## 3. `comm-nop-bai.puml` ↔ `seq-nop-bai.puml`

| # comm | # seq | Message |
| :-: | :-: | :--- |
| 1 | 1 | bấm "Submit" |
| 1.1 | 2 | `isValidArtifactUrl(url)` (ghi chú, tự gọi) |
| 1.2 | 3 | `submitArtifact(taskId, form)` |
| 1.2.1 | 4 | `submitTaskArtifact(dto)` |
| 1.2.1.1 | 5 | `POST /api/v1/nodes/{taskId}/submit` |
| 1.2.1.1.1 | 6 | `submitTaskArtifact(taskId, request, actorId)` |
| 1.2.1.1.1.1 | 7 | `findById(taskId)` |
| 1.2.1.1.1.2 | 9 | `findById(projectId)` |
| 1.2.1.1.1.3 | 11 | `ensureNotArchived(project)` (ghi chú, tự gọi) |
| 1.2.1.1.1.4 [có link] | 12 | `isValid(artifactUrl)` |
| 1.2.1.1.1.5 | 14 | `save(node)` |
| 1.2.1.1.1.6 [có link] | 16 | `save(artifact)` |
| 1.2.1.1.1.7 | 18 | `publishNotification(NotificationEvent)` |
| 1.2.1.1.1.7.1 | 19 | `registerSynchronization(afterCompletion)` |
| 1.2.1.1.1.8 | 21 | `afterCommit(...)` (ghi chú, tự gọi) |
| 1.2.1.1.1.9 | 22 | `registerSynchronization(afterCompletion)` |
| 2 | 23 | `afterCompletion(STATUS_COMMITTED)` → publisher |
| 2.1 | 24 | `convertAndSend(...)` |
| 3 | 25 | `afterCompletion(STATUS_COMMITTED)` → StateMachineService |
| 3.1 | 26 | `sendToUser(ownerId, "TASK_SUBMITTED", …)` |
| 3.1.1 | 27 | event `TASK_SUBMITTED` |
| 4 | 32 | `handleNotification(NotificationEvent)` |
| 4.1 | 33 | `save(NotificationEntity)` |
| 4.2 | 35 | `sendToUser(ownerId, "NOTIFICATION_RECEIVED", …)` |
| 4.2.1 | 36 | event `NOTIFICATION_RECEIVED` |

Message trả về (8, 10, 13, 15, 17, 20, 28–31, 34) không vẽ trên sơ đồ communication, đúng quy ước cẩm nang 3.5.

## 4. `state-task.puml` — mỗi chuyển ↔ một nhánh code

| Chuyển | Sự kiện [điều kiện] | Nhánh code |
| :--- | :--- | :--- |
| [*] → LOCKED | createNode [thuộc một phase] / clone template [có cạnh đi vào] | `BE/service/WorkflowGraphService.java:295` (`phaseId != null` → LOCKED); `BE/service/TemplateCloneService.java:321` (`hasIncoming` → LOCKED). Giá trị mặc định của entity cũng là LOCKED: `BE/entity/NodeEntity.java:48` |
| [*] → TODO | createNode [không thuộc phase] / clone template [không có cạnh đi vào] | `WorkflowGraphService.java:295`; `TemplateCloneService.java:321` |
| LOCKED → TODO | autoUnlock [cha thỏa ALL/ANY] | `StateMachineService.unlockDownstreamTasks`: `StateMachineService.java:401–422` |
| LOCKED → TODO | forceUnlock [là Owner] | `StateMachineService.forceUnlock`: `StateMachineService.java:345–381` (403 ở `:354`, không LOCKED → 400 ở `:357–358`) |
| LOCKED → TODO | publishPipeline [node gốc] (B4) | `BE/service/WorkflowGraphService.java:553–555` |
| LOCKED → TODO | sửa cạnh [điều kiện lại thỏa] (B) | `WorkflowGraphService.recomputeNodeStatus`: `WorkflowGraphService.java:636–642` |
| TODO → LOCKED | sửa cạnh [điều kiện không còn thỏa] (B) | `WorkflowGraphService.java:632–635` |
| TODO → IN_PROGRESS | start [người phụ trách hoặc Owner] | `updateStatus` nhánh `IN_PROGRESS && TODO`: `StateMachineService.java:191–197` |
| IN_PROGRESS → TODO | cancel [người phụ trách hoặc Owner] | `updateStatus` nhánh `TODO && IN_PROGRESS`: `StateMachineService.java:199–205` |
| IN_PROGRESS → REVIEW | submit — kéo thẻ | `updateStatus` nhánh `REVIEW && IN_PROGRESS`: `StateMachineService.java:207–213` |
| IN_PROGRESS → REVIEW | submitArtifact [link hợp lệ nếu có] | `StateMachineService.submitTaskArtifact`: `StateMachineService.java:243–338` (đổi trạng thái ở `:284`) |
| REVIEW → IN_PROGRESS | reject(lý do) [Owner/Manager, lý do không rỗng] | `updateStatus` nhánh `IN_PROGRESS && REVIEW`: `StateMachineService.java:161–188` |
| REVIEW → DONE | approve [Owner/Manager] | `updateStatus` nhánh `DONE`: `StateMachineService.java:141–159` |
| DONE → [*] | (không còn chuyển) | chặn mọi thay đổi khi đã DONE: `StateMachineService.java:126–127` |
| Đúng hạn → Quá hạn | scanOverdueTasks [IN_PROGRESS, dueDate < now] | `BE/service/engine/TaskOverdueScanner.java:38–48` |
| Quá hạn → Đúng hạn | đổi dueDate [dueDate mới > now] | `WorkflowGraphService.updateNode`: `WorkflowGraphService.java:452–456`; `NodeAssignmentService.updateAssignment`: `BE/service/NodeAssignmentService.java:65–69` |

**Chiều ngược lại (mỗi nhánh code có trong sơ đồ):** `updateStatus` có 6 nhánh — DONE (`:141`), REVIEW→IN_PROGRESS (`:161`), TODO→IN_PROGRESS (`:191`), IN_PROGRESS→TODO (`:199`), IN_PROGRESS→REVIEW (`:207`) và `else` (`:215`, cặp không hợp lệ → 400, ghi trong ghi chú sơ đồ). 5 nhánh đầu là 5 chuyển trên sơ đồ. Các hàm còn lại đổi `status`/`isOverdue` (`submitTaskArtifact`, `forceUnlock`, `unlockDownstreamTasks`, `TaskOverdueScanner`, `WorkflowGraphService`, `NodeAssignmentService`) đều có chuyển tương ứng. Đã dò bằng grep `setStatus(`, `.status(`, `NodeEntity.builder()`, `setIsOverdue` trên toàn `BE/`: ngoài các chỗ trên chỉ còn 2 chỗ tạo node (`WorkflowGraphService.java:300–306`, `TemplateCloneService.java:343–349`), đã vẽ thành 2 chuyển từ trạng thái đầu. (Lần dò đầu chỉ tìm `setStatus(NodeStatus.` nên sót 2 chỗ này, rồi tìm rộng hơn mới thấy.)

## 5. Điều phát hiện khi đối chiếu (ngoài phạm vi C8)

1. **(Chưa sửa, việc của C6)** **`TASK_SUBMITTED`, `TASK_REJECTED`, `TASK_OVERDUE` được backend gửi nhưng giao diện không nghe.** `connectRealtime` (`HttpWorkflowService.ts:223`) chỉ đăng ký INIT, TASK_UNLOCKED, TASK_STATUS_CHANGED, NOTIFICATION_RECEIVED. `MyTasksView.tsx:57` có kiểm `TASK_REJECTED` nhưng không bao giờ nhận được. Người phụ trách vẫn thấy bài bị từ chối nhờ `TASK_STATUS_CHANGED` (cùng request). Việc của C6.
2. **(Đã xử lý trong sơ đồ)** **Task ghi lifeline `tasks.ts` nhưng file này không có:** lời gọi API của task nằm trong `HttpWorkflowService.ts` (A2 mới tách `http/graph.ts`, `http/workspace.ts`). Sơ đồ dùng `HttpWorkflowService`.
3. **(Đã vá ở #56)** **`NodeController` nhận `?currentUserId=` từ request và mặc định user 2 khi không đăng nhập** (`NodeController.java:54, 70, 85` trên main `7d5a5b1`): ai gọi API cũng có thể tự xưng là Owner để duyệt bài. Cùng kiểu lỗ hổng D báo ở #49 cho `ArtifactController`. **Đã vá ở #56** (dùng `requireCurrentUserId()`, `getMyTasks` kiểm thành viên); số dòng `NodeController` trong bảng mục 1, 2 đã cập nhật theo main sau #56. Lưu ý: chế độ dev (`app.security.debug-user-id-enabled: true`) vẫn coi request không gửi header nào là user mặc định (2), phải tắt ở X1 trước khi nộp hoặc deploy. `RealtimeController.java:34` vẫn nhận `?userId=` (EventSource không gửi được header), để lại X1.
