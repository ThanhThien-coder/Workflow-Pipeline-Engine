# Ma trận nhất quán — Mảng B: Thiết kế quy trình DAG (B8)

Mỗi message trong sơ đồ sequence ứng với một phương thức thật. Số dòng lấy trên main `77416de` (đã có B4, B5, B6, B9, C1, vai trò MANAGER). `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.

Cột "Dòng gọi" là chỗ lời gọi nằm trong code của bên gửi; cột "Định nghĩa" là chỗ phương thức được khai báo ở lớp nhận.

## 1. `seq-noi-phu-thuoc.puml`

| # | Message | Lớp nhận.phương thức | Dòng gọi | Định nghĩa | Khớp? |
| :-: | :--- | :--- | :--- | :--- | :-: |
| 2 | `onConnectNodes(parentId, childId)` | `MindmapDrawer.connectNodes` (prop `onConnectNodes`) | `FE/components/mindmap/MindmapTree.tsx:76` | `FE/components/workflow/MindmapDrawer.tsx:152` | ✔ |
| 3 | `connectNodes(phaseId, parentId, childId)` | `useWorkflowStore.connectNodes` | `FE/components/workflow/MindmapDrawer.tsx:172` | `FE/store/useWorkflowStore.ts:283` | ✔ |
| 4 | `ensureCanEditGraph(get())` | hàm trong module store | `FE/store/useWorkflowStore.ts:284` | `FE/store/useWorkflowStore.ts:76` | ✔ |
| 5 | `attachGhostNode(phaseId, {…})` | `HttpWorkflowService.attachGhostNode` | `FE/store/useWorkflowStore.ts:287` | `FE/services/impl/HttpWorkflowService.ts:659` | ✔ |
| 6 | `createDependency(projectId, parentNodeId, childNodeId)` | `graph.ts createDependency` | `FE/services/impl/HttpWorkflowService.ts:666` | `FE/services/impl/http/graph.ts:61` | ✔ |
| 7 | `POST /api/v1/projects/{id}/dependencies` | `WorkflowGraphController.createDependency` | `FE/services/impl/http/graph.ts:62` (`apiRequest`) | `BE/controller/WorkflowGraphController.java:133–138` | ✔ |
| 8 | `createDependency(projectId, request, currentUserId)` | `WorkflowGraphService.createDependency` | `BE/controller/WorkflowGraphController.java:144` | `BE/service/WorkflowGraphService.java:323` | ✔ |
| 9 | `verifyProjectOwner(projectId, userId)` | `ProjectAuthorizationService.verifyProjectOwner` | `BE/service/WorkflowGraphService.java:324` | `BE/service/ProjectAuthorizationService.java:31` | ✔ |
| 11 | `ensureNotArchived(project)` | `WorkflowGraphService.ensureNotArchived` (private) | `BE/service/WorkflowGraphService.java:324` | `BE/service/WorkflowGraphService.java:649` | ✔ |
| 12 | `findById(parentId), findById(childId)` | `NodeRepository.findById` (kế thừa `JpaRepository`) | `BE/service/WorkflowGraphService.java:333, 335` | Spring Data JPA | ✔ |
| 14 | `existsByParentNodeIdAndChildNodeId` | `NodeDependencyRepository` | `BE/service/WorkflowGraphService.java:343` | `BE/repository/NodeDependencyRepository.java:15` | ✔ |
| 16 | trả cạnh cũ (lũy đẳng) | — | `BE/service/WorkflowGraphService.java:344` | — | ✔ |
| 17 | `findByProjectId(projectId)` | `NodeRepository.findByProjectId` | `BE/service/WorkflowGraphService.java:355` | `BE/repository/NodeRepository.java:18` | ✔ |
| 19 | `findByProjectId(projectId)` | `NodeDependencyRepository.findByProjectId` | `BE/service/WorkflowGraphService.java:356` | `BE/repository/NodeDependencyRepository.java:12` | ✔ |
| 21 | `wouldCreateCycle(nodes, edges, parentId, childId)` | `KahnDagService.wouldCreateCycle` | `BE/service/WorkflowGraphService.java:357` | `BE/service/engine/KahnDagService.java:122` | ✔ |
| 23 | `validateProjectDag(nodes, edgesWithNew)` | `KahnDagService.validateProjectDag` | `BE/service/WorkflowGraphService.java:363` | `BE/service/engine/KahnDagService.java:35` | ✔ |
| 25 | `CycleDetectedException(cycleNodeCodes)` | — | `BE/service/WorkflowGraphService.java:361` | — | ✔ |
| 26 | `ConflictException("NODE_IN_USE")` | — | `BE/service/WorkflowGraphService.java:369` | — | ✔ |
| 27 | `save(entity)` | `NodeDependencyRepository.save` (kế thừa `JpaRepository`) | `BE/service/WorkflowGraphService.java:373` | Spring Data JPA | ✔ |
| 29 | `recomputeNodeStatus(child, parents)` | `WorkflowGraphService.recomputeNodeStatus` (private) | `BE/service/WorkflowGraphService.java:387` | `BE/service/WorkflowGraphService.java:626` | ✔ |
| 34 | `updateTree(phaseId, …)` | `useWorkflowStore.updateTree` | `FE/store/useWorkflowStore.ts:289` | `FE/store/useWorkflowStore.ts:183` | ✔ |
| 36 | 422 `CYCLE_DETECTED` | `GlobalExceptionHandler.handleCycleDetected` | — | `BE/exception/GlobalExceptionHandler.java:64` | ✔ |
| 40, 45 | `handleError(error)` | `useGraphErrorHandler().handleError` | `FE/components/workflow/MindmapDrawer.tsx:172` | `FE/components/workflow/useGraphErrorHandler.ts:42` | ✔ |
| 41 | 409 `NODE_IN_USE` | `GlobalExceptionHandler.handleConflict` | — | `BE/exception/GlobalExceptionHandler.java:87` | ✔ |

## 2. `seq-xuat-ban.puml` và `comm-xuat-ban.puml`

| # seq | # comm | Message | Lớp nhận.phương thức | Dòng gọi | Định nghĩa | Khớp? |
| :-: | :-: | :--- | :--- | :--- | :--- | :-: |
| 2 | 1 | `publishProject(projectId)` | `settingsSlice.publishProject` | `FE/components/settings/GeneralSettingsSection.tsx:76` (`onPublish`, nối ở `FE/components/views/SettingsView.tsx:104`) | `FE/store/slices/settingsSlice.ts:166` | ✔ |
| 3 | 1.1 | `publishPipeline(projectId)` | `HttpWorkflowService.publishPipeline` | `FE/store/slices/settingsSlice.ts:171` | `FE/services/impl/HttpWorkflowService.ts:684` | ✔ |
| 4 | 1.1.1 | `POST /api/v1/projects/{id}/publish` | `WorkflowGraphController.publishPipeline` | `FE/services/impl/HttpWorkflowService.ts:686` → `FE/services/impl/http/graph.ts:66` | `BE/controller/WorkflowGraphController.java:208–213` | ✔ |
| 5 | 1.1.1.1 | `publishPipeline(projectId, currentUserId)` | `WorkflowGraphService.publishPipeline` | `BE/controller/WorkflowGraphController.java:218` | `BE/service/WorkflowGraphService.java:519` | ✔ |
| 6 | 1.1.1.1.1 | `verifyProjectOwner(projectId, userId)` | `ProjectAuthorizationService.verifyProjectOwner` | `BE/service/WorkflowGraphService.java:520` | `BE/service/ProjectAuthorizationService.java:31` | ✔ |
| 8 | — | `ensureNotArchived(project)` | `WorkflowGraphService.ensureNotArchived` (private) | `BE/service/WorkflowGraphService.java:523` | `BE/service/WorkflowGraphService.java:649` | ✔ |
| 9 | 1.1.1.1.2 | `findByProjectId(projectId)` | `NodeRepository.findByProjectId` | `BE/service/WorkflowGraphService.java:531` | `BE/repository/NodeRepository.java:18` | ✔ |
| 11 | 1.1.1.1.3 | `findByProjectId(projectId)` | `NodeDependencyRepository.findByProjectId` | `BE/service/WorkflowGraphService.java:532` | `BE/repository/NodeDependencyRepository.java:12` | ✔ |
| 13 | 1.1.1.1.4 | `validateProjectDag(nodes, dependencies)` | `KahnDagService.validateProjectDag` | `BE/service/WorkflowGraphService.java:534` | `BE/service/engine/KahnDagService.java:35` | ✔ |
| 14–16 | — | đếm in-degree, `poll()`, `add(v)` (vòng lặp Kahn) | bên trong `validateProjectDag` | `BE/service/engine/KahnDagService.java:71, 77, 84` | `java.util.PriorityQueue` | ✔ |
| 17 | — | `peelNodesBehindCycle(blockedIds, adjacencyList)` | `KahnDagService.peelNodesBehindCycle` (private) | `BE/service/engine/KahnDagService.java:103` | `BE/service/engine/KahnDagService.java:172` | ✔ |
| 19 | — | `CycleDetectedException(cycleNodeCodes)` | — | `BE/service/WorkflowGraphService.java:537` | — | ✔ |
| 20 | — | 422 `CYCLE_DETECTED` | `GlobalExceptionHandler.handleCycleDetected` | — | `BE/exception/GlobalExceptionHandler.java:64` | ✔ |
| 21 | — | trả `PublishPipelineResult {cycleDetected}` | nhánh 422 trong `HttpWorkflowService.publishPipeline` | `FE/services/impl/HttpWorkflowService.ts:692` | — | ✔ |
| 22 | 1.2 | `kahnCycleErrors = violatingNodeIds` | `settingsSlice` | `FE/store/slices/settingsSlice.ts:177` | — | ✔ |
| 24 | 1.1.1.1.5 | `save(project)` | `ProjectRepository.save` (kế thừa `JpaRepository`) | `BE/service/WorkflowGraphService.java:547` | Spring Data JPA | ✔ |
| 26 | 1.1.1.1.6 | `save(node)` | `NodeRepository.save` (kế thừa `JpaRepository`) | `BE/service/WorkflowGraphService.java:556` (trong vòng lặp dòng 553–554) | Spring Data JPA | ✔ |
| 28 | — | `afterCommitActions.add(…)` | `List<Runnable>` | `BE/service/WorkflowGraphService.java:571` | — | ✔ |
| 29 | 1.1.1.1.7 | `registerSynchronization(afterCommit)` | `TransactionSynchronizationManager` (Spring) | `BE/service/WorkflowGraphService.java:593` | Spring | ✔ |
| 31 | 2 | `afterCommit()` | `TransactionSynchronization` ẩn danh | Spring gọi khi commit | `BE/service/WorkflowGraphService.java:595` | ✔ |
| 32 | 2.1 | `sendToUser(assigneeId, "TASK_UNLOCKED", …)` | `SseEmitterService.sendToUser` | `BE/service/WorkflowGraphService.java:576` | `BE/service/event/SseEmitterService.java:89` | ✔ |
| 32 | 2.1 | `nodeMapper.toKanbanTaskResponse(node)` (tham số) | `NodeMapper.toKanbanTaskResponse` | `BE/service/WorkflowGraphService.java:576` | `BE/mapper/NodeMapper.java:16` | ✔ |
| 33 | 2.2 | `publishNotification(NotificationEvent)` | `WorkflowEventPublisher.publishNotification` | `BE/service/WorkflowGraphService.java:581` | `BE/service/event/WorkflowEventPublisher.java:45` | ✔ |
| 34 | 2.2.1 | `registerSynchronization(afterCompletion)` | `TransactionSynchronizationManager` (Spring) | `BE/service/event/WorkflowEventPublisher.java:99` (trong `sendAfterCommit`, dòng 94) | Spring | ✔ |
| 35 | 3 | `afterCompletion(STATUS_COMMITTED)` | `TransactionSynchronization` ẩn danh | Spring gọi sau commit | `BE/service/event/WorkflowEventPublisher.java:101` | ✔ |
| 36 | 3.1 | `convertAndSend(exchange, routingKey, event)` | `RabbitTemplate.convertAndSend` | `BE/service/event/WorkflowEventPublisher.java:106` | Spring AMQP | ✔ |
| 30, 37 | — | trả `PublishPipelineResponse`, 200 OK | — | `BE/service/WorkflowGraphService.java:606`, `BE/controller/WorkflowGraphController.java:219` | — | ✔ |
| 39 | 1.3 | `settings.status = ACTIVE`, `showToast(…)` | `settingsSlice` | `FE/store/slices/settingsSlice.ts:187, 194` | — | ✔ |

## 3. `class-do-thi.puml` ↔ code

| Phần tử | Đối chiếu | `file:dòng` | Khớp? |
| :--- | :--- | :--- | :-: |
| `WorkflowGraphController` (8 phương thức vẽ) | tên, tham số | `BE/controller/WorkflowGraphController.java:30–213` | ✔ |
| `WorkflowGraphService` (13 public, 3 private) | tên, kiểu | `BE/service/WorkflowGraphService.java:61–674` | ✔ |
| `KahnDagService` + `ProjectKahnResult` (7 trường) | tên, kiểu | `BE/service/engine/KahnDagService.java:16–27, 35, 122, 172` | ✔ |
| `PhaseProgressCalculator.compute` `{static}` + `PhaseProgress` | `final class`, `public static` | `BE/service/engine/PhaseProgressCalculator.java:15, 17, 21` | ✔ |
| `ProjectEntity` 1 `*--` 0..* `WorkPhaseEntity`, `NodeEntity` | `ON DELETE CASCADE` | FK `work_phase.project_id`, `node.project_id` | ✔ |
| `WorkPhaseEntity` 0..1 `o--` 0..* `NodeEntity` | `ON DELETE SET NULL` | FK `node.phase_id` | ✔ |
| `NodeEntity` 1 — 0..* `NodeDependencyEntity` (2 quan hệ: cha, con) | 2 khóa ngoại tới `node` | `BE/entity/NodeDependencyEntity.java:25, 28` | ✔ |
| `WorkPhaseEntity` 1 — 0..* `PhaseDependencyEntity` (2 quan hệ) | 2 khóa ngoại tới `work_phase` (V6) | `BE/entity/PhaseDependencyEntity.java:28, 31` | ✔ |
| Mọi message trong 2 sequence ở trên | có trong lớp tương ứng của class diagram (trừ hàm Spring/JPA kế thừa) | — | ✔ |

## 4. `state-du-an.puml` ↔ enum `ProjectStatus`

| Trạng thái | Có trong enum | Vào bằng | Ra bằng | Ghi chú |
| :--- | :-: | :--- | :--- | :--- |
| `DRAFT` | ✔ | `ProjectService.createProject` (`BE/service/ProjectService.java:183`, gán `DRAFT` dòng 198); `TemplateCloneService.cloneTemplate` (`:53`, dòng 94) | `publishPipeline` → ACTIVE | DRAFT → ARCHIVED **chưa cài** |
| `PLANNING` | ✔ | không có code (dữ liệu trước D1) | `publishPipeline` → ACTIVE | |
| `ACTIVE` | ✔ | `publishPipeline` (`BE/service/WorkflowGraphService.java:545`); `updateProjectStatus` từ PAUSED, ARCHIVED | PAUSED, COMPLETED, ARCHIVED (`ALLOWED_TRANSITIONS`, `BE/service/ProjectService.java:40–45`) | DRAFT/PLANNING → ACTIVE bằng PATCH bị chặn 409 `USE_PUBLISH` (`:251`) |
| `PAUSED` | ✔ | `updateProjectStatus` từ ACTIVE | ACTIVE, ARCHIVED | |
| `COMPLETED` | ✔ | `updateProjectStatus` từ ACTIVE | không có | trạng thái kết thúc |
| `INACTIVE` | ✔ | **chưa cài** (không có job 30 ngày) | ARCHIVED | theo đặc tả `workflow-engine.md` 5.1 |
| `ARCHIVED` | ✔ | `updateProjectStatus` từ ACTIVE, PAUSED, INACTIVE | ACTIVE (khôi phục) | API ghi đồ thị trả 409 `PROJECT_ARCHIVED` |

Đủ 7/7 giá trị enum, không có trạng thái thừa.

## 5. `object-seed.puml` ↔ dữ liệu seed

| Đối tượng | Nguồn | Khớp? |
| :--- | :--- | :-: |
| `p1..p3 : WorkPhaseEntity` (FOUNDATION, AUTH GATEWAY, CORE ENGINE) | `wpe-backend/src/main/resources/db/migration/V2__seed_initial_data.sql:35–39` | ✔ |
| `n1..n4 : NodeEntity` (WPE-001 DONE, WPE-002 IN_PROGRESS, WPE-003 TODO, WPE-004 LOCKED) | `V2__seed_initial_data.sql:45–50` | ✔ |
| `d1..d3 : NodeDependencyEntity` (1→2, 2→3, 3→4) | `V2__seed_initial_data.sql:59–63` | ✔ |
| `inDegree`, `queue`, `sortedOrder` | biến cục bộ trong `KahnDagService.validateProjectDag` (`BE/service/engine/KahnDagService.java:35–112`) | ✔ |
| Đã đối chiếu với DB local (`select … from node where project_id=1`) | khớp seed | ✔ |
