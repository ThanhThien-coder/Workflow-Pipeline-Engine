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
        String reason
    ) {}

    /**
     * Bắn sự kiện PROJECT_TASKS_CHANGED tới chủ dự án và tất cả thành viên đang hoạt động.
     * Nếu đang trong transaction, chỉ bắn sau khi transaction commit thành công.
     * Rollback thì không bắn. Lỗi gửi chỉ ghi log.
     */
    public void notifyTasksChanged(Long projectId, Long phaseId, Long taskId, String reason) {
        if (projectId == null) {
            return;
        }

        try {
            ProjectTasksChangedPayload payload = new ProjectTasksChangedPayload(
                String.valueOf(projectId),
                phaseId != null ? String.valueOf(phaseId) : null,
                taskId != null ? String.valueOf(taskId) : null,
                reason
            );

            Set<Long> recipientIds = resolveRecipientUserIds(projectId);

            Runnable sendAction = () -> {
                for (Long userId : recipientIds) {
                    try {
                        sseEmitterService.sendToUser(userId, "PROJECT_TASKS_CHANGED", payload);
                    } catch (RuntimeException ex) {
                        log.warn("Không gửi được SSE PROJECT_TASKS_CHANGED tới user {}: {}", userId, ex.getMessage());
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
                        log.error("Gửi SSE PROJECT_TASKS_CHANGED sau commit thất bại: {}", ex.getMessage(), ex);
                    }
                }
            });
        } catch (RuntimeException ex) {
            log.error("Lỗi khi xử lý thông báo notifyTasksChanged cho projectId {}: {}", projectId, ex.getMessage(), ex);
        }
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
