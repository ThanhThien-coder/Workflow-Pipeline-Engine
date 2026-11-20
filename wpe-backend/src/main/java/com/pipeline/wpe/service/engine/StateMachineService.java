package com.pipeline.wpe.service.engine;

import com.pipeline.wpe.common.enums.ArtifactType;
import com.pipeline.wpe.common.enums.JoinPolicy;
import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.common.enums.ProjectStatus;
import com.pipeline.wpe.dto.artifact.ArtifactUrlValidator;
import com.pipeline.wpe.dto.event.NotificationEvent;
import com.pipeline.wpe.dto.event.TaskCompletedEvent;
import com.pipeline.wpe.dto.request.node.ReopenTaskRequest;
import com.pipeline.wpe.dto.request.node.SubmitTaskArtifactRequest;
import com.pipeline.wpe.dto.request.node.UpdateNodeStatusRequest;
import com.pipeline.wpe.dto.response.node.KanbanTaskResponse;
import com.pipeline.wpe.dto.response.node.NodeArtifactResponse;
import com.pipeline.wpe.dto.response.node.ReopenImpactResponse;
import com.pipeline.wpe.dto.response.node.SubmitTaskArtifactResponse;
import com.pipeline.wpe.entity.ArtifactEntity;
import com.pipeline.wpe.entity.NodeDependencyEntity;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.exception.ConflictException;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.mapper.NodeMapper;
import com.pipeline.wpe.repository.ArtifactRepository;
import com.pipeline.wpe.repository.NodeDependencyRepository;
import com.pipeline.wpe.repository.NodeRepository;
import com.pipeline.wpe.repository.ProjectMemberRepository;
import com.pipeline.wpe.repository.ProjectRepository;
import com.pipeline.wpe.service.event.ProjectRealtimeNotifier;
import com.pipeline.wpe.service.event.SseEmitterService;
import com.pipeline.wpe.service.event.WorkflowEventPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
public class StateMachineService {

    private final NodeRepository nodeRepository;
    private final NodeDependencyRepository dependencyRepository;
    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final ArtifactRepository artifactRepository;
    private final WorkflowEventPublisher eventPublisher;
    private final SseEmitterService sseEmitterService;
    private final ProjectRealtimeNotifier projectRealtimeNotifier;
    private final NodeMapper nodeMapper;

    /**
     * Lấy danh sách My Tasks cho bảng Kanban cá nhân hóa.
     * Gồm cả task LOCKED (G15: My Tasks có cột "Đang khóa"), kèm danh sách artifacts của từng task.
     */
    @Transactional(readOnly = true)
    public List<KanbanTaskResponse> getMyTasks(Long projectId, Long userId) {
        List<NodeEntity> nodes = nodeRepository.findByProjectIdAndAssignedUserIdOrderByDueDateAsc(projectId, userId);

        return toKanbanTasksWithArtifacts(nodes);
    }

    /**
     * Mọi task của một phase cho bảng Kanban theo phase: kể cả task LOCKED và task chưa giao
     * (my-tasks bỏ hai loại này). Chỉ lấy task thuộc đúng dự án; sắp theo id để thứ tự ổn định.
     */
    @Transactional(readOnly = true)
    public List<KanbanTaskResponse> getPhaseTasks(Long projectId, Long phaseId) {
        List<NodeEntity> nodes = nodeRepository.findByPhaseId(phaseId).stream()
            .filter(node -> projectId.equals(node.getProjectId()))
            .sorted(Comparator.comparing(NodeEntity::getId))
            .toList();
        return toKanbanTasksWithArtifacts(nodes);
    }

    /**
     * G18: hàng chờ duyệt của dự án: mọi task đang REVIEW (của mọi người), sắp theo id.
     * Kiểm quyền chủ dự án / quản lý ở controller.
     */
    @Transactional(readOnly = true)
    public List<KanbanTaskResponse> getReviewTasks(Long projectId) {
        List<NodeEntity> nodes = nodeRepository.findByProjectIdAndStatus(projectId, NodeStatus.REVIEW).stream()
            .sorted(Comparator.comparing(NodeEntity::getId))
            .toList();
        return toKanbanTasksWithArtifacts(nodes);
    }

    /** Người duyệt được của dự án: chủ dự án + các quản lý còn trong dự án (không trùng). */
    private List<Long> reviewerIds(ProjectEntity project) {
        List<Long> ids = new java.util.ArrayList<>();
        ids.add(project.getOwnerId());
        projectMemberRepository.findByProjectIdAndRemovedAtIsNull(project.getId()).stream()
            .filter(m -> m.getRole() == ProjectRole.MANAGER)
            .map(m -> m.getUserId())
            .filter(id -> id != null && !ids.contains(id))
            .forEach(ids::add);
        return ids;
    }

    /** S03: lấy artifact của cả danh sách task 1 lần (findByNodeIdIn), nhóm theo nodeId, giữ thứ tự task. */
    private List<KanbanTaskResponse> toKanbanTasksWithArtifacts(List<NodeEntity> nodes) {
        if (nodes.isEmpty()) {
            return List.of();
        }
        List<Long> ids = nodes.stream().map(NodeEntity::getId).toList();
        java.util.Map<Long, List<ArtifactEntity>> byNode = artifactRepository.findByNodeIdIn(ids).stream()
            .collect(java.util.stream.Collectors.groupingBy(ArtifactEntity::getNodeId));
        return nodes.stream()
            .map(node -> toKanbanTask(node, byNode.getOrDefault(node.getId(), List.of())))
            .toList();
    }

    private KanbanTaskResponse toKanbanTaskWithArtifacts(NodeEntity node) {
        return toKanbanTask(node, artifactRepository.findByNodeId(node.getId()));
    }

    private KanbanTaskResponse toKanbanTask(NodeEntity node, List<ArtifactEntity> artifacts) {
        KanbanTaskResponse base = nodeMapper.toKanbanTaskResponse(node);
        List<NodeArtifactResponse> artifactResponses = artifacts.stream()
            .map(a -> new NodeArtifactResponse(
                String.valueOf(a.getId()),
                a.getType().name(),
                a.getUrl(),
                a.getName(),
                a.getName(),
                a.getCreatedAt()
            ))
            .toList();

        return base.withArtifacts(artifactResponses);
    }

    /**
     * Chuyển trạng thái tác vụ với đầy đủ kiểm tra FSM, Optimistic Locking & Strict Review Gate.
     */
    @Transactional
    public KanbanTaskResponse updateStatus(Long taskId, UpdateNodeStatusRequest request, Long currentUserId) {
        NodeEntity node = nodeRepository.findById(taskId)
            .orElseThrow(() -> new ResourceNotFoundException("Task not found with ID: " + taskId));

        // 1. Kiểm tra Optimistic Locking qua trường @Version
        if (request.version() != null && !Objects.equals(node.getVersion(), request.version())) {
            throw new OptimisticLockingFailureException(
                "This task was changed by another member (server version: " + node.getVersion() +
                ", your version: " + request.version() + "). Please refresh the page."
            );
        }

        NodeStatus targetStatus;
        try {
            targetStatus = NodeStatus.valueOf(request.status().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid status: " + request.status());
        }

        NodeStatus currentStatus = node.getStatus();

        // 2. Không cho phép di chuyển task đã DONE (Terminal State)
        if (currentStatus == NodeStatus.DONE) {
            throw new IllegalArgumentException("This task is done and frozen, so it can't be changed.");
        }

        ProjectEntity project = projectRepository.findById(node.getProjectId())
            .orElseThrow(() -> new ResourceNotFoundException("Project not found with ID: " + node.getProjectId()));
        ensureNotArchived(project);

        boolean isOwner = project.getOwnerId().equals(currentUserId);
        ensureNotViewer(project, currentUserId);
        ensureProjectRunningForMember(project, currentUserId);
        boolean isAssignee = Objects.equals(node.getAssignedUserId(), currentUserId);
        boolean canReview = isOwner || projectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull(project.getId(), currentUserId)
            .map(m -> m.getRole() == ProjectRole.MANAGER)
            .orElse(false);

        // 3. Strict Review Gate & Ma trận chuyển trạng thái
        if (targetStatus == NodeStatus.DONE) {
            // Bước REVIEW -> DONE
            if (currentStatus != NodeStatus.REVIEW) {
                throw new IllegalArgumentException("A task must go through REVIEW before it can be completed.");
            }
            if (!canReview) {
                throw new ForbiddenException("ACCESS_DENIED", "Only the project owner or a manager can approve a task as done.");
            }

            node.setStatus(NodeStatus.DONE);
            node.setCompletedAt(Instant.now());

            // Bắn sự kiện RabbitMQ để mở khóa downstream tasks ngầm
            eventPublisher.publishTaskCompleted(new TaskCompletedEvent(
                node.getId(),
                node.getProjectId(),
                node.getCode(),
                currentUserId,
                Instant.now()
            ));

        } else if (targetStatus == NodeStatus.IN_PROGRESS && currentStatus == NodeStatus.REVIEW) {
            // Owner hoặc Manager từ chối bài nộp: REVIEW -> IN_PROGRESS
            if (!canReview) {
                throw new ForbiddenException("ACCESS_DENIED", "Only the project owner or a manager can request changes on a task.");
            }
            if (request.rejectReason() == null || request.rejectReason().trim().isEmpty()) {
                throw new IllegalArgumentException("A rejection reason (rejectReason) is required.");
            }

            node.setStatus(NodeStatus.IN_PROGRESS);
            node.setRejectReason(request.rejectReason().trim());

            // Bắn thông báo qua RabbitMQ
            if (node.getAssignedUserId() != null) {
                eventPublisher.publishNotification(new NotificationEvent(
                    node.getAssignedUserId(),
                    node.getProjectId(),
                    "Changes requested",
                    "Task " + node.getCode() + " was sent back: " + request.rejectReason(),
                    "REJECTED",
                    "/project/" + node.getProjectId() + "/my-tasks",
                    Instant.now()
                ));

                // Đẩy thông báo thời gian thực qua SSE (sau commit)
                KanbanTaskResponse rejected = nodeMapper.toKanbanTaskResponse(node);
                Long assigneeId = node.getAssignedUserId();
                afterCommit(() -> sseEmitterService.sendToUser(assigneeId, "TASK_REJECTED", rejected));
            }

        } else if (targetStatus == NodeStatus.IN_PROGRESS && currentStatus == NodeStatus.TODO) {
            // Bắt đầu làm: TODO -> IN_PROGRESS
            if (!isAssignee && !isOwner) {
                throw new ForbiddenException("ACCESS_DENIED", "You are not the assignee of this task.");
            }
            node.setStatus(NodeStatus.IN_PROGRESS);
            node.setStartedAt(Instant.now());

        } else if (targetStatus == NodeStatus.TODO && currentStatus == NodeStatus.IN_PROGRESS) {
            // Hủy nhận làm việc: IN_PROGRESS -> TODO
            if (!isAssignee && !isOwner) {
                throw new ForbiddenException("ACCESS_DENIED", "You don't have permission to unassign this task.");
            }
            node.setStatus(NodeStatus.TODO);
            node.setStartedAt(null);

        } else if (targetStatus == NodeStatus.REVIEW && currentStatus == NodeStatus.IN_PROGRESS) {
            // Nộp bài trực tiếp qua status: IN_PROGRESS -> REVIEW
            if (!isAssignee && !isOwner) {
                throw new ForbiddenException("ACCESS_DENIED", "You don't have permission to submit this task.");
            }
            node.setStatus(NodeStatus.REVIEW);
            node.setRejectReason(null);

        } else {
            throw new IllegalArgumentException(
                "Can't change the task status from " + currentStatus + " to " + targetStatus + "."
            );
        }

        NodeEntity saved = nodeRepository.saveAndFlush(node);
        KanbanTaskResponse response = nodeMapper.toKanbanTaskResponse(saved);

        boolean isRejected = (targetStatus == NodeStatus.TODO && currentStatus == NodeStatus.REVIEW);
        projectRealtimeNotifier.notifyTasksChanged(
            saved.getProjectId(),
            saved.getPhaseId(),
            saved.getId(),
            isRejected ? "REJECTED" : "STATUS_CHANGED",
            currentUserId
        );

        // Bắn tín hiệu real-time cập nhật trạng thái tới tất cả các bên (sau commit)
        // Người làm + mọi người duyệt (chủ dự án, quản lý; G18) trừ chính người thao tác
        Long assigneeId = saved.getAssignedUserId();
        List<Long> reviewers = reviewerIds(project);
        afterCommit(() -> {
            if (assigneeId != null) {
                sseEmitterService.sendToUser(assigneeId, "TASK_STATUS_CHANGED", response);
            }
            reviewers.stream()
                .filter(id -> !id.equals(currentUserId) && !id.equals(assigneeId))
                .forEach(id -> sseEmitterService.sendToUser(id, "TASK_STATUS_CHANGED", response));
        });

        return response;
    }

    /**
     * S04: xem trước ảnh hưởng của việc mở lại task Done lên các task con trực tiếp. Chỉ Owner hoặc Manager.
     */
    @Transactional(readOnly = true)
    public ReopenImpactResponse reopenImpact(Long taskId, Long currentUserId) {
        NodeEntity node = nodeRepository.findById(taskId)
            .orElseThrow(() -> new ResourceNotFoundException("Task not found with ID: " + taskId));
        ProjectEntity project = projectRepository.findById(node.getProjectId())
            .orElseThrow(() -> new ResourceNotFoundException("Project not found with ID: " + node.getProjectId()));
        if (!canReviewProject(project, currentUserId)) {
            throw new ForbiddenException("ACCESS_DENIED", "Only the project owner or a manager can reopen a task.");
        }
        List<ReopenImpactResponse.Child> children = directChildren(node).stream()
            .map(child -> new ReopenImpactResponse.Child(
                String.valueOf(child.getId()), child.getCode(), child.getTitle(),
                child.getStatus().name(), willRelock(child, node.getId())))
            .toList();
        return new ReopenImpactResponse(node.getCode(), children);
    }

    /**
     * S04: mở lại task đã DONE (Owner hoặc Manager, bắt buộc lý do): DONE -> IN_PROGRESS, giữ nguyên người làm cũ.
     * Task con đang TODO mà không còn đủ điều kiện mở khóa thì khóa lại (LOCKED); task con đã bắt đầu giữ nguyên.
     * Artifact cũ giữ nguyên (không xóa, không đổi isInRepository).
     */
    @Transactional
    public KanbanTaskResponse reopen(Long taskId, ReopenTaskRequest request, Long currentUserId) {
        NodeEntity node = nodeRepository.findById(taskId)
            .orElseThrow(() -> new ResourceNotFoundException("Task not found with ID: " + taskId));
        ProjectEntity project = projectRepository.findById(node.getProjectId())
            .orElseThrow(() -> new ResourceNotFoundException("Project not found with ID: " + node.getProjectId()));

        if (!canReviewProject(project, currentUserId)) {
            throw new ForbiddenException("ACCESS_DENIED", "Only the project owner or a manager can reopen a task.");
        }
        ensureNotArchived(project);
        if (node.getStatus() != NodeStatus.DONE) {
            throw new ConflictException("TASK_NOT_DONE", "Only a Done task can be reopened.");
        }
        if (request.version() != null && !Objects.equals(node.getVersion(), request.version())) {
            throw new OptimisticLockingFailureException(
                "This task was changed by another member (server version: " + node.getVersion() +
                ", your version: " + request.version() + "). Please refresh the page.");
        }
        String reason = request.reason() == null ? "" : request.reason().trim();
        if (reason.isEmpty()) {
            throw new IllegalArgumentException("A reason is required to reopen a task.");
        }

        // Khóa lại task con TODO không còn đủ điều kiện (luật chỉ phụ thuộc các cha khác nên tính được trước khi đổi cha)
        List<NodeEntity> relocked = new java.util.ArrayList<>();
        for (NodeEntity child : directChildren(node)) {
            if (willRelock(child, node.getId())) {
                child.setStatus(NodeStatus.LOCKED);
                relocked.add(nodeRepository.save(child));
            }
        }

        node.setStatus(NodeStatus.IN_PROGRESS);
        node.setCompletedAt(null);
        node.setReopenedAt(Instant.now());
        node.setRejectReason(reason);
        NodeEntity saved = nodeRepository.saveAndFlush(node);
        KanbanTaskResponse response = toKanbanTaskWithArtifacts(saved);

        // Có con bị khóa lại thì làm mới cả dự án (phaseId/taskId null), không thì chỉ task này
        projectRealtimeNotifier.notifyTasksChanged(
            saved.getProjectId(),
            relocked.isEmpty() ? saved.getPhaseId() : null,
            relocked.isEmpty() ? saved.getId() : null,
            "REOPENED",
            currentUserId
        );

        Long assigneeId = saved.getAssignedUserId();
        if (assigneeId != null) {
            eventPublisher.publishNotification(new NotificationEvent(
                assigneeId,
                saved.getProjectId(),
                "Task reopened",
                "Task " + saved.getCode() + " was reopened: " + reason,
                "REOPENED",
                "/project/" + saved.getProjectId() + "/my-tasks",
                Instant.now()
            ));
        }
        List<Long> reviewers = reviewerIds(project);
        afterCommit(() -> {
            if (assigneeId != null) {
                sseEmitterService.sendToUser(assigneeId, "TASK_STATUS_CHANGED", response);
            }
            reviewers.stream()
                .filter(id -> !id.equals(currentUserId) && !id.equals(assigneeId))
                .forEach(id -> sseEmitterService.sendToUser(id, "TASK_STATUS_CHANGED", response));
        });

        log.info("Reopen: task {} ({}) được user {} mở lại, khóa lại {} task con", saved.getId(), saved.getCode(),
            currentUserId, relocked.size());
        return response;
    }

    /** Viewer chỉ xem: không được đổi trạng thái hay nộp bài (chủ dự án không bao giờ là Viewer). */
    private void ensureNotViewer(ProjectEntity project, Long userId) {
        if (project.getOwnerId().equals(userId)) {
            return;
        }
        boolean viewer = projectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull(project.getId(), userId)
            .map(m -> m.getRole() == ProjectRole.VIEWER)
            .orElse(false);
        if (viewer) {
            throw new ForbiddenException("ACCESS_DENIED", "Viewers can't change task status.");
        }
    }

    /**
     * Chủ dự án và Quản lý làm task ở mọi trạng thái dự án (trừ ARCHIVED, đã chặn trước đó).
     * Cộng tác viên chỉ làm task khi dự án đang chạy (ACTIVE); DRAFT/PLANNING/PAUSED/COMPLETED thì chỉ xem.
     */
    private void ensureProjectRunningForMember(ProjectEntity project, Long userId) {
        if (project.getStatus() == ProjectStatus.ACTIVE || canReviewProject(project, userId)) {
            return;
        }
        throw new ConflictException("PROJECT_NOT_ACTIVE",
            "The project isn't running (" + project.getStatus() + "). Only the owner or a manager can work on tasks until it is active.");
    }

    private boolean canReviewProject(ProjectEntity project, Long userId) {
        return project.getOwnerId().equals(userId)
            || projectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull(project.getId(), userId)
                .map(m -> m.getRole() == ProjectRole.MANAGER)
                .orElse(false);
    }

    private List<NodeEntity> directChildren(NodeEntity parent) {
        return dependencyRepository.findByParentNodeId(parent.getId()).stream()
            .map(dep -> nodeRepository.findById(dep.getChildNodeId()).orElse(null))
            .filter(Objects::nonNull)
            .sorted(Comparator.comparing(NodeEntity::getId))
            .toList();
    }

    /**
     * Cùng luật hội tụ với unlockDownstreamTasks / WorkflowGraphService.recomputeNodeStatus: khi cha này không còn DONE,
     * ALL_COMPLETED luôn không thỏa; ANY_COMPLETED chỉ thỏa nếu còn cha khác DONE. Con chỉ bị khóa lại khi đang TODO
     * và chưa được chủ dự án mở khóa sớm.
     */
    private boolean willRelock(NodeEntity child, Long reopenedParentId) {
        if (child.getStatus() != NodeStatus.TODO || child.getForceUnlockedAt() != null) {
            return false;
        }
        if (child.getJoinPolicy() == JoinPolicy.ANY_COMPLETED) {
            boolean otherDone = dependencyRepository.findByChildNodeId(child.getId()).stream()
                .map(NodeDependencyEntity::getParentNodeId)
                .filter(id -> !id.equals(reopenedParentId))
                .map(id -> nodeRepository.findById(id).orElse(null))
                .anyMatch(p -> p != null && p.getStatus() == NodeStatus.DONE);
            return !otherDone;
        }
        return true;
    }

    /**
     * Nộp bài chờ nghiệm thu: Chuyển task từ IN_PROGRESS sang REVIEW kèm link minh chứng ngoài (Artifact).
     */
    @Transactional
    public SubmitTaskArtifactResponse submitTaskArtifact(Long taskId, SubmitTaskArtifactRequest request, Long currentUserId) {
        NodeEntity node = nodeRepository.findById(taskId)
            .orElseThrow(() -> new ResourceNotFoundException("Task not found with ID: " + taskId));

        if (node.getStatus() != NodeStatus.IN_PROGRESS) {
            throw new IllegalArgumentException("A task must be IN_PROGRESS before it can be submitted for review.");
        }

        if (request.version() != null && !Objects.equals(node.getVersion(), request.version())) {
            throw new OptimisticLockingFailureException("The data version doesn't match. Please refresh the page.");
        }

        ProjectEntity project = projectRepository.findById(node.getProjectId())
            .orElseThrow(() -> new ResourceNotFoundException("Project not found with ID: " + node.getProjectId()));
        ensureNotArchived(project);

        boolean isOwner = project.getOwnerId().equals(currentUserId);
        ensureNotViewer(project, currentUserId);
        ensureProjectRunningForMember(project, currentUserId);
        boolean isAssignee = Objects.equals(node.getAssignedUserId(), currentUserId);
        if (!isOwner && !isAssignee) {
            throw new ForbiddenException("ACCESS_DENIED", "You don't have permission to submit this task.");
        }

        // Đọc minh chứng gửi kèm (hỗ trợ cả format trực tiếp và format bọc trong artifact object)
        String artifactUrl = (request.artifact() != null && request.artifact().url() != null) ? request.artifact().url() : request.url();
        String artifactTypeStr = (request.artifact() != null && request.artifact().type() != null) ? request.artifact().type() : request.type();
        String artifactTitle = (request.artifact() != null && request.artifact().title() != null)
            ? request.artifact().title()
            : (request.title() != null ? request.title() : request.note());
        // C4: khách thấy minh chứng hay không do người nộp chọn; không gửi thì mặc định công khai (như trước).
        boolean isPublicForGuest = request.artifact() == null || request.artifact().isPublicForGuest() == null
            || request.artifact().isPublicForGuest();
        boolean hasArtifact = artifactUrl != null && !artifactUrl.isBlank();

        // C4: kiểm link trước khi đổi trạng thái, để link sai (javascript:, thiếu host...) không làm task sang REVIEW.
        // NodeController không có @Valid cho request này nên kiểm ở đây; lỗi → 400 BAD_REQUEST.
        if (hasArtifact && !ArtifactUrlValidator.isValid(artifactUrl)) {
            throw new IllegalArgumentException(
                "The artifact link must be a valid http:// or https:// URL (with a domain), up to 500 characters.");
        }

        // Chuyển sang REVIEW
        node.setStatus(NodeStatus.REVIEW);
        node.setRejectReason(null);
        NodeEntity savedNode = nodeRepository.saveAndFlush(node);

        // Lưu Artifact nếu có gửi kèm. Nộp bài không kèm link vẫn hợp lệ (artifactResponse = null).
        NodeArtifactResponse artifactResponse = null;
        if (hasArtifact) {
            ArtifactType artifactType = ArtifactType.PR;
            if (artifactTypeStr != null) {
                try {
                    artifactType = ArtifactType.valueOf(artifactTypeStr.toUpperCase());
                } catch (IllegalArgumentException ignored) {
                    artifactType = ArtifactType.OTHER_LINK;
                }
            }

            String artifactName = artifactTitle != null && !artifactTitle.isBlank()
                ? artifactTitle.trim()
                : "Artifact " + node.getCode();
            String url = artifactUrl.trim();

            // G17: minh chứng vào kho Artifacts. Trùng hoàn toàn (cùng dự án, tên, link) thì không thêm dòng lặp:
            // - task này đã có đúng bản đó: dùng lại;
            // - bản trùng nằm chỗ khác trong kho: vẫn gắn cho task nhưng không đưa thêm vào kho.
            List<ArtifactEntity> identical = artifactRepository.findByProjectIdAndNameAndUrl(node.getProjectId(), artifactName, url);
            boolean alreadyInRepo = identical.stream().anyMatch(a -> Boolean.TRUE.equals(a.getIsInRepository()));
            ArtifactEntity sameOnTask = identical.stream()
                .filter(a -> node.getId().equals(a.getNodeId()))
                .findFirst()
                .orElse(null);

            ArtifactEntity savedArtifact;
            if (sameOnTask != null) {
                if (!alreadyInRepo) {
                    sameOnTask.setIsInRepository(true);
                    sameOnTask = artifactRepository.save(sameOnTask);
                }
                savedArtifact = sameOnTask;
            } else {
                savedArtifact = artifactRepository.save(ArtifactEntity.builder()
                    .projectId(node.getProjectId())
                    .nodeId(node.getId())
                    .uploadedBy(currentUserId)
                    .name(artifactName)
                    .type(artifactType)
                    .url(url)
                    .isInRepository(!alreadyInRepo)
                    .isPublicForGuest(isPublicForGuest)
                    .build());
            }
            artifactResponse = new NodeArtifactResponse(
                String.valueOf(savedArtifact.getId()),
                savedArtifact.getType().name(),
                savedArtifact.getUrl(),
                savedArtifact.getName(),
                savedArtifact.getName(),
                savedArtifact.getCreatedAt()
            );
        }

        // Bắn thông báo cho Owner
        eventPublisher.publishNotification(new NotificationEvent(
            project.getOwnerId(),
            node.getProjectId(),
            "Task waiting for review",
            "A member submitted work for task " + node.getCode() + " (" + node.getTitle() + ")",
            "REVIEW_REQUESTED",
            "/project/" + node.getProjectId() + "/my-tasks",
            Instant.now()
        ));

        KanbanTaskResponse taskResponse = nodeMapper.toKanbanTaskResponse(savedNode);

        projectRealtimeNotifier.notifyTasksChanged(
            savedNode.getProjectId(),
            savedNode.getPhaseId(),
            savedNode.getId(),
            "SUBMITTED",
            currentUserId
        );
        projectRealtimeNotifier.notifyProjectChanged(
            savedNode.getProjectId(), "ARTIFACTS", "ARTIFACT_ADDED", currentUserId, savedNode.getPhaseId(), savedNode.getId());

        // Bắn SSE real-time cho Owner (sau commit)
        // G18: cả quản lý cũng duyệt được nên cũng nhận tín hiệu (cập nhật số "Chờ duyệt")
        List<Long> reviewers = reviewerIds(project);
        afterCommit(() -> reviewers.forEach(id -> sseEmitterService.sendToUser(id, "TASK_SUBMITTED", taskResponse)));

        return new SubmitTaskArtifactResponse(taskResponse, artifactResponse);
    }

    /**
     * Mở khóa cưỡng bức (Force Unlock) cho Owner hoặc Manager khi cần làm trước bằng mock data.
     */
    @Transactional
    public KanbanTaskResponse forceUnlock(Long taskId, Long currentUserId) {
        NodeEntity node = nodeRepository.findById(taskId)
            .orElseThrow(() -> new ResourceNotFoundException("Task not found with ID: " + taskId));

        ProjectEntity project = projectRepository.findById(node.getProjectId())
            .orElseThrow(() -> new ResourceNotFoundException("Project not found with ID: " + node.getProjectId()));
        ensureNotArchived(project);

        if (!canReviewProject(project, currentUserId)) {
            throw new ForbiddenException("ACCESS_DENIED", "Only the project owner or a manager can force unlock a task.");
        }

        // Dự án chưa Start thì mọi task đều khóa; Start project mới mở task gốc
        if (project.getStatus() == ProjectStatus.DRAFT || project.getStatus() == ProjectStatus.PLANNING) {
            throw new ConflictException("PROJECT_NOT_STARTED",
                "The project hasn't started yet. Start the project before unlocking tasks early.");
        }

        if (node.getStatus() != NodeStatus.LOCKED) {
            throw new IllegalArgumentException("Only tasks in LOCKED status can be force unlocked.");
        }

        node.setStatus(NodeStatus.TODO);
        // Lưu ai mở, lúc nào: không bị khóa lại khi sửa dây phụ thuộc, và hiện trong nhật ký hoạt động
        node.setForceUnlockedBy(currentUserId);
        node.setForceUnlockedAt(Instant.now());
        NodeEntity saved = nodeRepository.saveAndFlush(node);
        KanbanTaskResponse response = nodeMapper.toKanbanTaskResponse(saved);

        projectRealtimeNotifier.notifyTasksChanged(
            saved.getProjectId(),
            saved.getPhaseId(),
            saved.getId(),
            "FORCE_UNLOCKED",
            currentUserId
        );

        log.info("Force unlock: task ID {} ({}) trong dự án {} được user {} mở khóa sớm LOCKED -> TODO",
            saved.getId(), saved.getCode(), saved.getProjectId(), currentUserId);

        // Bắn thông báo và SSE cho Assignee (cả hai đều gửi sau commit)
        Long assigneeId = saved.getAssignedUserId();
        if (assigneeId != null) {
            eventPublisher.publishNotification(new NotificationEvent(
                assigneeId,
                saved.getProjectId(),
                "Task unlocked early",
                "Task " + saved.getCode() + " (" + saved.getTitle() + ") was unlocked early. You can start now.",
                "FORCE_UNLOCKED",
                "/project/" + saved.getProjectId() + "/my-tasks",
                Instant.now()
            ));
            afterCommit(() -> sseEmitterService.sendToUser(assigneeId, "TASK_UNLOCKED", response));
        }

        return response;
    }

    /**
     * Tự động mở khóa các node con theo chính sách AND/OR Join khi task cha hoàn thành (DONE).
     * Được gọi ngầm từ RabbitMQ Worker (WorkflowEventConsumer).
     */
    @Transactional
    public void unlockDownstreamTasks(Long parentTaskId) {
        log.info("Engine executing downstream check for parentTaskId: {}", parentTaskId);
        List<NodeDependencyEntity> childDependencies = dependencyRepository.findByParentNodeId(parentTaskId);

        int unlockedCount = 0;
        Long unlockedProjectId = null;
        Long lastPhaseId = null;
        Long lastTaskId = null;

        for (NodeDependencyEntity dep : childDependencies) {
            Long childId = dep.getChildNodeId();
            NodeEntity childNode = nodeRepository.findById(childId).orElse(null);

            // Chỉ mở khóa nếu Node con đang ở trạng thái LOCKED
            if (childNode != null && childNode.getStatus() == NodeStatus.LOCKED) {
                List<NodeDependencyEntity> parentDependencies = dependencyRepository.findByChildNodeId(childId);

                boolean canUnlock = false;
                if (childNode.getJoinPolicy() == JoinPolicy.ALL_COMPLETED) {
                    // AND-join: 100% các nút cha trực tiếp phải đạt trạng thái DONE
                    canUnlock = parentDependencies.stream().allMatch(p -> {
                        NodeEntity parent = nodeRepository.findById(p.getParentNodeId()).orElse(null);
                        return parent != null && parent.getStatus() == NodeStatus.DONE;
                    });
                } else if (childNode.getJoinPolicy() == JoinPolicy.ANY_COMPLETED) {
                    // OR-join: Có ít nhất một nút cha trực tiếp đạt trạng thái DONE
                    canUnlock = parentDependencies.stream().anyMatch(p -> {
                        NodeEntity parent = nodeRepository.findById(p.getParentNodeId()).orElse(null);
                        return parent != null && parent.getStatus() == NodeStatus.DONE;
                    });
                }

                if (canUnlock) {
                    log.info("Mở khóa thành công node con ID: {}, Code: {} từ LOCKED -> TODO", childId, childNode.getCode());
                    childNode.setStatus(NodeStatus.TODO);
                    NodeEntity savedChild = nodeRepository.save(childNode);
                    KanbanTaskResponse taskResponse = nodeMapper.toKanbanTaskResponse(savedChild);

                    unlockedCount++;
                    unlockedProjectId = savedChild.getProjectId();
                    lastPhaseId = savedChild.getPhaseId();
                    lastTaskId = savedChild.getId();

                    // Bắn notification event
                    if (savedChild.getAssignedUserId() != null) {
                        eventPublisher.publishNotification(new NotificationEvent(
                            savedChild.getAssignedUserId(),
                            savedChild.getProjectId(),
                            "Task ready to start",
                            "Task " + savedChild.getCode() + " (" + savedChild.getTitle() + ") has been unlocked automatically.",
                            "TASK_READY",
                            "/project/" + savedChild.getProjectId() + "/my-tasks",
                            Instant.now()
                        ));

                        // ĐẨY REAL-TIME SSE XUỐNG CLIENT CỦA ASSIGNEE MÀ KHÔNG CẦN RELOAD (F5), sau commit
                        Long assigneeId = savedChild.getAssignedUserId();
                        afterCommit(() -> sseEmitterService.sendToUser(assigneeId, "TASK_UNLOCKED", taskResponse));
                    }
                }
            }
        }

        if (unlockedCount > 0 && unlockedProjectId != null) {
            projectRealtimeNotifier.notifyTasksChanged(
                unlockedProjectId,
                unlockedCount == 1 ? lastPhaseId : null,
                unlockedCount == 1 ? lastTaskId : null,
                "UNLOCKED"
            );
        }
    }

    /**
     * Dự án ARCHIVED là chỉ đọc (workflow-engine.md 5.1): mọi thao tác đổi trạng thái,
     * nộp bài, force unlock đều bị chặn 409 PROJECT_ARCHIVED (cùng mã lỗi với phần đồ thị của B).
     */
    private void ensureNotArchived(ProjectEntity project) {
        if (project.getStatus() == ProjectStatus.ARCHIVED) {
            throw new ConflictException("PROJECT_ARCHIVED",
                "This project is archived and read-only. Task status can't be changed.");
        }
    }

    /**
     * Chạy action sau khi transaction hiện tại commit; không có transaction thì chạy ngay.
     * Dùng cho SSE để trình duyệt không nhận trạng thái mà DB có thể còn rollback.
     * Lỗi gửi SSE sau commit chỉ ghi log, không làm hỏng request đã commit.
     * Dùng afterCompletion(STATUS_COMMITTED) thay vì afterCommit() để vẫn chạy khi được gọi từ bên trong
     * afterCommit của code khác (lý do chi tiết ở WorkflowEventPublisher.sendAfterCommit).
     */
    private void afterCommit(Runnable action) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            action.run();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) {
                    return;
                }
                try {
                    action.run();
                } catch (RuntimeException ex) {
                    log.error("Gửi SSE sau commit thất bại: {}", ex.getMessage(), ex);
                }
            }
        });
    }
}
