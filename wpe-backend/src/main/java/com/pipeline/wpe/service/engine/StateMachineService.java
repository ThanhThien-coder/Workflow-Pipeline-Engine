package com.pipeline.wpe.service.engine;

import com.pipeline.wpe.common.enums.ArtifactType;
import com.pipeline.wpe.common.enums.JoinPolicy;
import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.common.enums.ProjectStatus;
import com.pipeline.wpe.dto.artifact.ArtifactUrlValidator;
import com.pipeline.wpe.dto.event.NotificationEvent;
import com.pipeline.wpe.dto.event.TaskCompletedEvent;
import com.pipeline.wpe.dto.request.node.SubmitTaskArtifactRequest;
import com.pipeline.wpe.dto.request.node.UpdateNodeStatusRequest;
import com.pipeline.wpe.dto.response.node.KanbanTaskResponse;
import com.pipeline.wpe.dto.response.node.NodeArtifactResponse;
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
    private final NodeMapper nodeMapper;

    /**
     * Lấy danh sách My Tasks cho bảng Kanban cá nhân hóa.
     * Tự động loại trừ các task LOCKED và gán kèm danh sách artifacts của từng task.
     */
    @Transactional(readOnly = true)
    public List<KanbanTaskResponse> getMyTasks(Long projectId, Long userId) {
        List<NodeEntity> nodes = nodeRepository.findByProjectIdAndAssignedUserIdAndStatusNotOrderByDueDateAsc(
            projectId, userId, NodeStatus.LOCKED
        );

        return nodes.stream().map(node -> {
            KanbanTaskResponse base = nodeMapper.toKanbanTaskResponse(node);
            List<ArtifactEntity> artifacts = artifactRepository.findByNodeId(node.getId());
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

            return new KanbanTaskResponse(
                base.id(),
                base.phaseId(),
                base.code(),
                base.title(),
                base.description(),
                base.status(),
                base.assignedUserId(),
                base.joinPolicy(),
                base.rejectReason(),
                base.dueDate(),
                base.isOverdue(),
                base.version(),
                base.uiMetadata(),
                artifactResponses
            );
        }).toList();
    }

    /**
     * Chuyển trạng thái tác vụ với đầy đủ kiểm tra FSM, Optimistic Locking & Strict Review Gate.
     */
    @Transactional
    public KanbanTaskResponse updateStatus(Long taskId, UpdateNodeStatusRequest request, Long currentUserId) {
        NodeEntity node = nodeRepository.findById(taskId)
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tác vụ ID: " + taskId));

        // 1. Kiểm tra Optimistic Locking qua trường @Version
        if (request.version() != null && !Objects.equals(node.getVersion(), request.version())) {
            throw new OptimisticLockingFailureException(
                "Tác vụ đã bị thay đổi bởi thành viên khác (Phiên bản máy chủ: " + node.getVersion() +
                ", phiên bản yêu cầu: " + request.version() + "). Vui lòng làm mới trang."
            );
        }

        NodeStatus targetStatus;
        try {
            targetStatus = NodeStatus.valueOf(request.status().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Trạng thái không hợp lệ: " + request.status());
        }

        NodeStatus currentStatus = node.getStatus();

        // 2. Không cho phép di chuyển task đã DONE (Terminal State)
        if (currentStatus == NodeStatus.DONE) {
            throw new IllegalArgumentException("Tác vụ đã hoàn tất và đóng băng, không thể thay đổi.");
        }

        ProjectEntity project = projectRepository.findById(node.getProjectId())
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy dự án ID: " + node.getProjectId()));
        ensureNotArchived(project);

        boolean isOwner = project.getOwnerId().equals(currentUserId);
        boolean isAssignee = Objects.equals(node.getAssignedUserId(), currentUserId);
        boolean canReview = isOwner || projectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull(project.getId(), currentUserId)
            .map(m -> m.getRole() == ProjectRole.MANAGER)
            .orElse(false);

        // 3. Strict Review Gate & Ma trận chuyển trạng thái
        if (targetStatus == NodeStatus.DONE) {
            // Bước REVIEW -> DONE
            if (currentStatus != NodeStatus.REVIEW) {
                throw new IllegalArgumentException("Tác vụ bắt buộc phải qua bước REVIEW trước khi nghiệm thu.");
            }
            if (!canReview) {
                throw new ForbiddenException("ACCESS_DENIED", "Chỉ Chủ dự án hoặc Quản lý mới có thẩm quyền phê duyệt hoàn thành tác vụ.");
            }

            node.setStatus(NodeStatus.DONE);

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
                throw new ForbiddenException("ACCESS_DENIED", "Chỉ Chủ dự án hoặc Quản lý mới có quyền yêu cầu làm lại tác vụ.");
            }
            if (request.rejectReason() == null || request.rejectReason().trim().isEmpty()) {
                throw new IllegalArgumentException("Bắt buộc phải nhập lý do từ chối (rejectReason).");
            }

            node.setStatus(NodeStatus.IN_PROGRESS);
            node.setRejectReason(request.rejectReason().trim());

            // Bắn thông báo qua RabbitMQ
            if (node.getAssignedUserId() != null) {
                eventPublisher.publishNotification(new NotificationEvent(
                    node.getAssignedUserId(),
                    node.getProjectId(),
                    "Tác vụ yêu cầu làm lại",
                    "Tác vụ " + node.getCode() + " bị từ chối: " + request.rejectReason(),
                    "REJECTED",
                    "/projects/" + node.getProjectId() + "/tasks",
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
                throw new ForbiddenException("ACCESS_DENIED", "Bạn không phải người phụ trách tác vụ này.");
            }
            node.setStatus(NodeStatus.IN_PROGRESS);
            node.setStartedAt(Instant.now());

        } else if (targetStatus == NodeStatus.TODO && currentStatus == NodeStatus.IN_PROGRESS) {
            // Hủy nhận làm việc: IN_PROGRESS -> TODO
            if (!isAssignee && !isOwner) {
                throw new ForbiddenException("ACCESS_DENIED", "Bạn không có quyền hủy nhận tác vụ này.");
            }
            node.setStatus(NodeStatus.TODO);
            node.setStartedAt(null);

        } else if (targetStatus == NodeStatus.REVIEW && currentStatus == NodeStatus.IN_PROGRESS) {
            // Nộp bài trực tiếp qua status: IN_PROGRESS -> REVIEW
            if (!isAssignee && !isOwner) {
                throw new ForbiddenException("ACCESS_DENIED", "Bạn không có quyền nộp bài cho tác vụ này.");
            }
            node.setStatus(NodeStatus.REVIEW);
            node.setRejectReason(null);

        } else {
            throw new IllegalArgumentException(
                "Luồng chuyển đổi trạng thái từ " + currentStatus + " sang " + targetStatus + " không hợp lệ."
            );
        }

        NodeEntity saved = nodeRepository.save(node);
        KanbanTaskResponse response = nodeMapper.toKanbanTaskResponse(saved);

        // Bắn tín hiệu real-time cập nhật trạng thái tới tất cả các bên (sau commit)
        Long assigneeId = saved.getAssignedUserId();
        Long ownerId = project.getOwnerId();
        afterCommit(() -> {
            if (assigneeId != null) {
                sseEmitterService.sendToUser(assigneeId, "TASK_STATUS_CHANGED", response);
            }
            if (!isOwner) {
                sseEmitterService.sendToUser(ownerId, "TASK_STATUS_CHANGED", response);
            }
        });

        return response;
    }

    /**
     * Nộp bài chờ nghiệm thu: Chuyển task từ IN_PROGRESS sang REVIEW kèm link minh chứng ngoài (Artifact).
     */
    @Transactional
    public SubmitTaskArtifactResponse submitTaskArtifact(Long taskId, SubmitTaskArtifactRequest request, Long currentUserId) {
        NodeEntity node = nodeRepository.findById(taskId)
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tác vụ ID: " + taskId));

        if (node.getStatus() != NodeStatus.IN_PROGRESS) {
            throw new IllegalArgumentException("Tác vụ phải ở trạng thái IN_PROGRESS mới có thể nộp bài nghiệm thu.");
        }

        if (request.version() != null && !Objects.equals(node.getVersion(), request.version())) {
            throw new OptimisticLockingFailureException("Phiên bản dữ liệu không khớp. Vui lòng làm mới trang.");
        }

        ProjectEntity project = projectRepository.findById(node.getProjectId())
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy dự án ID: " + node.getProjectId()));
        ensureNotArchived(project);

        boolean isOwner = project.getOwnerId().equals(currentUserId);
        boolean isAssignee = Objects.equals(node.getAssignedUserId(), currentUserId);
        if (!isOwner && !isAssignee) {
            throw new ForbiddenException("ACCESS_DENIED", "Bạn không có quyền nộp bài cho tác vụ này.");
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
                "Link minh chứng phải là http:// hoặc https:// hợp lệ (có tên miền), tối đa 500 ký tự.");
        }

        // Chuyển sang REVIEW
        node.setStatus(NodeStatus.REVIEW);
        node.setRejectReason(null);
        NodeEntity savedNode = nodeRepository.save(node);

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

            ArtifactEntity artifact = ArtifactEntity.builder()
                .projectId(node.getProjectId())
                .nodeId(node.getId())
                .uploadedBy(currentUserId)
                .name(artifactTitle != null && !artifactTitle.isBlank() ? artifactTitle : "Minh chứng " + node.getCode())
                .type(artifactType)
                .url(artifactUrl.trim())
                .isPublicForGuest(isPublicForGuest)
                .build();

            ArtifactEntity savedArtifact = artifactRepository.save(artifact);
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
            "Tác vụ chờ nghiệm thu",
            "Thành viên đã nộp bài cho tác vụ " + node.getCode() + " (" + node.getTitle() + ")",
            "REVIEW_REQUESTED",
            "/projects/" + node.getProjectId() + "/tasks",
            Instant.now()
        ));

        KanbanTaskResponse taskResponse = nodeMapper.toKanbanTaskResponse(savedNode);

        // Bắn SSE real-time cho Owner (sau commit)
        Long ownerId = project.getOwnerId();
        afterCommit(() -> sseEmitterService.sendToUser(ownerId, "TASK_SUBMITTED", taskResponse));

        return new SubmitTaskArtifactResponse(taskResponse, artifactResponse);
    }

    /**
     * Mở khóa cưỡng bức (Force Unlock) cho Project Owner khi cần làm trước bằng mock data.
     */
    @Transactional
    public KanbanTaskResponse forceUnlock(Long taskId, Long currentUserId) {
        NodeEntity node = nodeRepository.findById(taskId)
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tác vụ ID: " + taskId));

        ProjectEntity project = projectRepository.findById(node.getProjectId())
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy dự án ID: " + node.getProjectId()));
        ensureNotArchived(project);

        if (!project.getOwnerId().equals(currentUserId)) {
            throw new ForbiddenException("ACCESS_DENIED", "Chỉ Chủ dự án (Project Owner) mới có quyền mở khóa cưỡng bức (Force Unlock).");
        }

        if (node.getStatus() != NodeStatus.LOCKED) {
            throw new IllegalArgumentException("Chỉ có thể Force Unlock tác vụ đang ở trạng thái LOCKED.");
        }

        node.setStatus(NodeStatus.TODO);
        NodeEntity saved = nodeRepository.save(node);
        KanbanTaskResponse response = nodeMapper.toKanbanTaskResponse(saved);

        // Ghi lại ai đã mở khóa sớm (audit)
        log.info("Force unlock: task ID {} ({}) trong dự án {} được user {} mở khóa sớm LOCKED -> TODO",
            saved.getId(), saved.getCode(), saved.getProjectId(), currentUserId);

        // Bắn thông báo và SSE cho Assignee (cả hai đều gửi sau commit)
        Long assigneeId = saved.getAssignedUserId();
        if (assigneeId != null) {
            eventPublisher.publishNotification(new NotificationEvent(
                assigneeId,
                saved.getProjectId(),
                "Tác vụ được mở khóa sớm",
                "Tác vụ " + saved.getCode() + " (" + saved.getTitle() + ") được Chủ dự án mở khóa sớm, bạn có thể bắt đầu làm.",
                "FORCE_UNLOCKED",
                "/projects/" + saved.getProjectId() + "/tasks",
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

                    // Bắn notification event
                    if (savedChild.getAssignedUserId() != null) {
                        eventPublisher.publishNotification(new NotificationEvent(
                            savedChild.getAssignedUserId(),
                            savedChild.getProjectId(),
                            "Tác vụ sẵn sàng thực hiện",
                            "Tác vụ " + savedChild.getCode() + " (" + savedChild.getTitle() + ") đã được tự động mở khóa!",
                            "TASK_READY",
                            "/projects/" + savedChild.getProjectId() + "/tasks",
                            Instant.now()
                        ));

                        // ĐẨY REAL-TIME SSE XUỐNG CLIENT CỦA ASSIGNEE MÀ KHÔNG CẦN RELOAD (F5), sau commit
                        Long assigneeId = savedChild.getAssignedUserId();
                        afterCommit(() -> sseEmitterService.sendToUser(assigneeId, "TASK_UNLOCKED", taskResponse));
                    }
                }
            }
        }
    }

    /**
     * Dự án ARCHIVED là chỉ đọc (workflow-engine.md 5.1): mọi thao tác đổi trạng thái,
     * nộp bài, force unlock đều bị chặn 409 PROJECT_ARCHIVED (cùng mã lỗi với phần đồ thị của B).
     */
    private void ensureNotArchived(ProjectEntity project) {
        if (project.getStatus() == ProjectStatus.ARCHIVED) {
            throw new ConflictException("PROJECT_ARCHIVED",
                "Dự án đã được lưu trữ, chỉ có thể xem. Không thể thay đổi trạng thái tác vụ.");
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
