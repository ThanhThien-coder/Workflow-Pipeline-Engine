package com.pipeline.wpe.service.event;

import com.pipeline.wpe.entity.ProjectMemberEntity;
import com.pipeline.wpe.repository.ProjectMemberRepository;
import com.pipeline.wpe.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Service phát tín hiệu real-time PROJECT_TASKS_CHANGED tới mọi thành viên của dự án
 * khi có thay đổi trên các tác vụ (thay đổi trạng thái, nộp bài, phân công, sửa DAG...).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ProjectRealtimeNotifier {

    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final SseEmitterService sseEmitterService;

    public record ProjectTasksChangedPayload(
        String projectId,
        String phaseId,
        String taskId,
        String reason,
        String actorUserId
    ) {}

    /**
     * Payload sự kiện chung PROJECT_CHANGED. resource thuộc GRAPH | MEMBERS | PROJECT | ARTIFACTS | FEEDBACK | AI.
     * actorUserId là null khi không có người thao tác (khách gửi góp ý, job nền).
     */
    public record ProjectChangedPayload(
        String projectId,
        String resource,
        String reason,
        String actorUserId,
        String phaseId,
        String taskId
    ) {}

    /** Overload cũ (không biết ai thao tác): gọi overload mới với actorUserId = null. */
    public void notifyTasksChanged(Long projectId, Long phaseId, Long taskId, String reason) {
        notifyTasksChanged(projectId, phaseId, taskId, reason, null);
    }

    /**
     * Bắn sự kiện PROJECT_TASKS_CHANGED tới chủ dự án và tất cả thành viên đang hoạt động.
     * Nếu đang trong transaction, chỉ bắn sau khi transaction commit thành công.
     * Rollback thì không bắn. Lỗi gửi chỉ ghi log.
     */
    public void notifyTasksChanged(Long projectId, Long phaseId, Long taskId, String reason, Long actorUserId) {
        if (projectId == null) {
            return;
        }
        try {
            ProjectTasksChangedPayload payload = new ProjectTasksChangedPayload(
                String.valueOf(projectId),
                phaseId != null ? String.valueOf(phaseId) : null,
                taskId != null ? String.valueOf(taskId) : null,
                reason,
                actorUserId != null ? String.valueOf(actorUserId) : null
            );
            dispatchAfterCommit(projectId, "PROJECT_TASKS_CHANGED", payload);
        } catch (RuntimeException ex) {
            log.error("Lỗi khi xử lý thông báo notifyTasksChanged cho projectId {}: {}", projectId, ex.getMessage(), ex);
        }
    }

    /**
     * Bắn sự kiện PROJECT_CHANGED (chỉ báo phần nào đổi, client tự tải lại). Cùng người nhận và cùng cách gửi
     * (sau commit, lỗi chỉ ghi log) với notifyTasksChanged.
     */
    public void notifyProjectChanged(Long projectId, String resource, String reason, Long actorUserId,
                                     Long phaseId, Long taskId) {
        if (projectId == null) {
            return;
        }
        try {
            ProjectChangedPayload payload = new ProjectChangedPayload(
                String.valueOf(projectId),
                resource,
                reason,
                actorUserId != null ? String.valueOf(actorUserId) : null,
                phaseId != null ? String.valueOf(phaseId) : null,
                taskId != null ? String.valueOf(taskId) : null
            );
            dispatchAfterCommit(projectId, "PROJECT_CHANGED", payload);
        } catch (RuntimeException ex) {
            log.error("Lỗi khi xử lý thông báo notifyProjectChanged cho projectId {}: {}", projectId, ex.getMessage(), ex);
        }
    }

    /** Lấy người nhận ngay lúc gọi (để xóa dự án vẫn còn danh sách), gửi sau commit nếu đang có transaction. */
    private void dispatchAfterCommit(Long projectId, String eventName, Object payload) {
        Set<Long> recipientIds = resolveRecipientUserIds(projectId);

        Runnable sendAction = () -> {
            for (Long userId : recipientIds) {
                try {
                    sseEmitterService.sendToUser(userId, eventName, payload);
                } catch (RuntimeException ex) {
                    log.warn("Không gửi được SSE {} tới user {}: {}", eventName, userId, ex.getMessage());
                }
            }
        };

        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            sendAction.run();
            return;
        }

        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) {
                    return;
                }
                try {
                    sendAction.run();
                } catch (RuntimeException ex) {
                    log.error("Gửi SSE {} sau commit thất bại: {}", eventName, ex.getMessage(), ex);
                }
            }
        });
    }

    /**
     * Người nhận = chủ dự án + mọi thành viên đang hoạt động (removedAt null), loại bỏ trùng lặp.
     */
    public Set<Long> resolveRecipientUserIds(Long projectId) {
        Set<Long> recipientIds = new LinkedHashSet<>();
        projectRepository.findById(projectId).ifPresent(p -> {
            if (p.getOwnerId() != null) {
                recipientIds.add(p.getOwnerId());
            }
        });

        List<ProjectMemberEntity> members = projectMemberRepository.findByProjectIdAndRemovedAtIsNull(projectId);
        for (ProjectMemberEntity member : members) {
            if (member.getRemovedAt() == null && member.getUserId() != null) {
                recipientIds.add(member.getUserId());
            }
        }

        return recipientIds;
    }
}
