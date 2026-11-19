package com.pipeline.wpe.service.demo;

import com.pipeline.wpe.common.enums.InvitationStatus;
import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.common.enums.SystemRole;
import com.pipeline.wpe.dto.event.NotificationEvent;
import com.pipeline.wpe.dto.response.demo.CompleteAllResponse;
import com.pipeline.wpe.dto.response.demo.ExpireInvitationsResponse;
import com.pipeline.wpe.dto.response.demo.OverdueScanResponse;
import com.pipeline.wpe.dto.response.graph.GraphNodeResponse;
import com.pipeline.wpe.entity.NodeDependencyEntity;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.ProjectInvitationEntity;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.GuestLinkRepository;
import com.pipeline.wpe.repository.NodeDependencyRepository;
import com.pipeline.wpe.repository.NodeRepository;
import com.pipeline.wpe.repository.ProjectInvitationRepository;
import com.pipeline.wpe.repository.ProjectRepository;
import com.pipeline.wpe.repository.UserRepository;
import com.pipeline.wpe.service.InvitationExpiryJob;
import com.pipeline.wpe.service.ProjectAuthorizationService;
import com.pipeline.wpe.service.admin.AdminAuditAction;
import com.pipeline.wpe.service.admin.AdminAuditService;
import com.pipeline.wpe.service.engine.StateMachineService;
import com.pipeline.wpe.service.engine.TaskOverdueScanner;
import com.pipeline.wpe.service.event.ProjectRealtimeNotifier;
import com.pipeline.wpe.service.event.WorkflowEventPublisher;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Công cụ demo để test đồ án (TASK_68, #24). CHỈ dùng khi app.demo-tools.enabled=true.
 * Các thao tác ở đây cố ý bỏ qua luật nghiệp vụ (hạn chót, máy trạng thái...), không dùng cho vận hành thật.
 * Tắt thì mọi thao tác (trừ isEnabled) ném 404; bật thì chỉ chủ dự án hoặc ADMIN hệ thống được dùng.
 */
@Slf4j
@Service
public class DemoToolsService {

    private final boolean enabled;
    private final ProjectAuthorizationService authorizationService;
    private final UserRepository userRepository;
    private final NodeRepository nodeRepository;
    private final NodeDependencyRepository nodeDependencyRepository;
    private final ProjectRepository projectRepository;
    private final GuestLinkRepository guestLinkRepository;
    private final ProjectInvitationRepository projectInvitationRepository;
    private final TaskOverdueScanner taskOverdueScanner;
    private final StateMachineService stateMachineService;
    private final InvitationExpiryJob invitationExpiryJob;
    private final ProjectRealtimeNotifier projectRealtimeNotifier;
    private final WorkflowEventPublisher eventPublisher;
    private final AdminAuditService adminAuditService;

    public DemoToolsService(
        @Value("${app.demo-tools.enabled:false}") boolean enabled,
        ProjectAuthorizationService authorizationService,
        UserRepository userRepository,
        NodeRepository nodeRepository,
        NodeDependencyRepository nodeDependencyRepository,
        ProjectRepository projectRepository,
        GuestLinkRepository guestLinkRepository,
        ProjectInvitationRepository projectInvitationRepository,
        TaskOverdueScanner taskOverdueScanner,
        StateMachineService stateMachineService,
        InvitationExpiryJob invitationExpiryJob,
        ProjectRealtimeNotifier projectRealtimeNotifier,
        WorkflowEventPublisher eventPublisher,
        AdminAuditService adminAuditService
    ) {
        this.enabled = enabled;
        this.authorizationService = authorizationService;
        this.userRepository = userRepository;
        this.nodeRepository = nodeRepository;
        this.nodeDependencyRepository = nodeDependencyRepository;
        this.projectRepository = projectRepository;
        this.guestLinkRepository = guestLinkRepository;
        this.projectInvitationRepository = projectInvitationRepository;
        this.taskOverdueScanner = taskOverdueScanner;
        this.stateMachineService = stateMachineService;
        this.invitationExpiryJob = invitationExpiryJob;
        this.projectRealtimeNotifier = projectRealtimeNotifier;
        this.eventPublisher = eventPublisher;
        this.adminAuditService = adminAuditService;
    }

    public boolean isEnabled() {
        return enabled;
    }

    /** a. Đặt hạn chót về quá khứ (bỏ qua DueDateRules) rồi quét quá hạn ngay. */
    @Transactional
    public GraphNodeResponse makeOverdue(Long projectId, Long nodeId, Long currentUserId) {
        authorize(projectId, currentUserId, "make-overdue node " + nodeId);
        NodeEntity node = loadNode(projectId, nodeId);
        node.setDueDate(Instant.now().minus(1, ChronoUnit.HOURS));
        node.setIsOverdue(false);
        nodeRepository.saveAndFlush(node);

        taskOverdueScanner.scanOverdueTasks();

        NodeEntity after = nodeRepository.findById(nodeId).orElse(node);
        return GraphNodeResponse.from(after, after.getUiMetadata());
    }

    /** b. Quét quá hạn ngay, trả số node quá hạn của dự án. */
    @Transactional
    public OverdueScanResponse overdueScan(Long projectId, Long currentUserId) {
        authorize(projectId, currentUserId, "overdue-scan");
        taskOverdueScanner.scanOverdueTasks();
        int count = (int) nodeRepository.findByProjectId(projectId).stream()
            .filter(n -> Boolean.TRUE.equals(n.getIsOverdue()))
            .count();
        return new OverdueScanResponse(count);
    }

    /**
     * c. Đặt thẳng trạng thái task, bỏ qua máy trạng thái (công cụ demo).
     * Sang DONE thì mở khóa task sau ngay (không qua RabbitMQ). Sang trạng thái khác thì
     * completedAt = null và KHÔNG đụng tới task con.
     */
    @Transactional
    public GraphNodeResponse forceStatus(Long projectId, Long nodeId, NodeStatus status, Long currentUserId) {
        authorize(projectId, currentUserId, "force-status node " + nodeId + " -> " + status);
        NodeEntity node = loadNode(projectId, nodeId);
        node.setStatus(status);
        node.setCompletedAt(status == NodeStatus.DONE ? Instant.now() : null);
        NodeEntity saved = nodeRepository.saveAndFlush(node);
        if (status == NodeStatus.DONE) {
            stateMachineService.unlockDownstreamTasks(nodeId);
        }
        projectRealtimeNotifier.notifyTasksChanged(projectId, saved.getPhaseId(), nodeId, "DEMO_FORCE_STATUS");
        return GraphNodeResponse.from(saved, saved.getUiMetadata());
    }

    /** d. Đưa mọi task chưa DONE của phase sang DONE, cha trước con, mở khóa task sau mỗi lần. */
    @Transactional
    public CompleteAllResponse completePhase(Long projectId, Long phaseId, Long currentUserId) {
        authorize(projectId, currentUserId, "complete-all phase " + phaseId);
        List<NodeEntity> inPhase = nodeRepository.findByPhaseId(phaseId);
        for (NodeEntity n : inPhase) {
            if (!projectId.equals(n.getProjectId())) {
                throw new IllegalArgumentException("The phase does not belong to this project.");
            }
        }
        List<NodeEntity> pending = new ArrayList<>(inPhase.stream().filter(n -> n.getStatus() != NodeStatus.DONE).toList());
        Set<Long> pendingIds = new HashSet<>();
        pending.forEach(n -> pendingIds.add(n.getId()));

        // Cạnh cha -> con nằm trong tập task còn phải làm
        List<NodeDependencyEntity> edges = nodeDependencyRepository.findByProjectId(projectId).stream()
            .filter(e -> pendingIds.contains(e.getParentNodeId()) && pendingIds.contains(e.getChildNodeId()))
            .toList();

        List<NodeEntity> ordered = new ArrayList<>();
        Set<Long> placed = new HashSet<>();
        while (!pending.isEmpty()) {
            List<NodeEntity> ready = pending.stream()
                .filter(n -> edges.stream().noneMatch(e -> e.getChildNodeId().equals(n.getId()) && !placed.contains(e.getParentNodeId())))
                .toList();
            if (ready.isEmpty()) {
                ready = new ArrayList<>(pending); // phòng chu trình: xử lý nốt phần còn lại
            }
            for (NodeEntity n : ready) {
                ordered.add(n);
                placed.add(n.getId());
            }
            pending.removeAll(ready);
        }

        for (NodeEntity n : ordered) {
            n.setStatus(NodeStatus.DONE);
            n.setCompletedAt(Instant.now());
            nodeRepository.saveAndFlush(n);
            stateMachineService.unlockDownstreamTasks(n.getId());
        }
        projectRealtimeNotifier.notifyTasksChanged(projectId, phaseId, null, "DEMO_COMPLETE_PHASE");
        return new CompleteAllResponse(ordered.size());
    }

    /** e. Xóa thời gian chờ AI của dự án. */
    @Transactional
    public void resetAiCooldown(Long projectId, Long currentUserId) {
        ProjectEntity project = authorize(projectId, currentUserId, "ai-cooldown/reset");
        project.setAiRequestedAt(null);
        projectRepository.save(project);
    }

    /** f. Link khách đang hoạt động hết hạn ngay (không có link thì không làm gì). */
    @Transactional
    public void expireGuestLink(Long projectId, Long currentUserId) {
        authorize(projectId, currentUserId, "guest-link/expire");
        guestLinkRepository.findByProjectIdAndIsRevokedFalse(projectId).ifPresent(link -> {
            link.setExpiresAt(Instant.now().minusSeconds(1));
            guestLinkRepository.save(link);
        });
    }

    /** g. Lời mời PENDING của dự án hết hạn ngay, rồi chạy job hết hạn để chuyển EXPIRED. */
    @Transactional
    public ExpireInvitationsResponse expireInvitations(Long projectId, Long currentUserId) {
        authorize(projectId, currentUserId, "invitations/expire");
        List<ProjectInvitationEntity> pending =
            projectInvitationRepository.findByProjectIdAndStatus(projectId, InvitationStatus.PENDING);
        Instant past = Instant.now().minusSeconds(1);
        for (ProjectInvitationEntity inv : pending) {
            inv.setExpiresAt(past);
        }
        projectInvitationRepository.saveAllAndFlush(pending);
        invitationExpiryJob.expireOverdueInvitations();
        return new ExpireInvitationsResponse(pending.size());
    }

    /** h. Gửi thông báo thử cho chính người gọi. */
    @Transactional
    public void sendTestNotification(Long projectId, Long currentUserId) {
        authorize(projectId, currentUserId, "notifications/test");
        Instant now = Instant.now();
        eventPublisher.publishNotification(new NotificationEvent(
            currentUserId,
            projectId,
            "Test notification",
            "This is a test notification sent at " + now + ".",
            "SYSTEM",
            "/project/" + projectId + "/workflow",
            now
        ));
    }

    private ProjectEntity authorize(Long projectId, Long userId, String action) {
        if (!enabled) {
            throw new ResourceNotFoundException("Demo tools are disabled.");
        }
        boolean admin = userRepository.findById(userId)
            .map(UserEntity::getSystemRole)
            .map(r -> r == SystemRole.ADMIN)
            .orElse(false);
        ProjectEntity project = admin
            ? authorizationService.getProjectOrThrow(projectId)
            : authorizationService.verifyProjectOwner(projectId, userId);
        log.warn("DEMO TOOL used by user {} on project {}: {}", userId, projectId, action);
        adminAuditService.record(userId, null, AdminAuditAction.DEMO_TOOL_USED, "PROJECT", String.valueOf(projectId), action);
        return project;
    }

    private NodeEntity loadNode(Long projectId, Long nodeId) {
        NodeEntity node = nodeRepository.findById(nodeId)
            .orElseThrow(() -> new ResourceNotFoundException("Task not found with ID: " + nodeId));
        if (!projectId.equals(node.getProjectId())) {
            throw new IllegalArgumentException("The task does not belong to this project.");
        }
        return node;
    }
}
