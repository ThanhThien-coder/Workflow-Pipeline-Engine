package com.pipeline.wpe.service.engine;

import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.dto.event.NotificationEvent;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.mapper.NodeMapper;
import com.pipeline.wpe.repository.NodeRepository;
import com.pipeline.wpe.repository.ProjectRepository;
import com.pipeline.wpe.service.event.SseEmitterService;
import com.pipeline.wpe.service.event.WorkflowEventPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Tác vụ định kỳ quét các công việc chưa xong (khác DONE) đã quá hạn due_date
 * để đánh dấu is_overdue = true và báo cho người làm và chủ dự án (G21).
 * Mỗi task chỉ báo một lần: lần quét sau bỏ qua task đã có is_overdue = true.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TaskOverdueScanner {

    private final NodeRepository nodeRepository;
    private final ProjectRepository projectRepository;
    private final WorkflowEventPublisher eventPublisher;
    private final SseEmitterService sseEmitterService;
    private final NodeMapper nodeMapper;

    /**
     * Quét mỗi 15 phút một lần để phát hiện task trễ hạn
     */
    @Scheduled(fixedRate = 15 * 60 * 1000, initialDelay = 10 * 1000)
    @Transactional
    public void scanOverdueTasks() {
        Instant now = Instant.now();
        List<NodeEntity> overdueTasks = nodeRepository.findByStatusNotAndDueDateBeforeAndIsOverdueFalse(
            NodeStatus.DONE, now
        );
        if (overdueTasks.isEmpty()) {
            return;
        }
        log.warn("Phát hiện {} tác vụ chưa xong bị quá hạn!", overdueTasks.size());

        for (NodeEntity task : overdueTasks) {
            task.setIsOverdue(true);
            NodeEntity saved = nodeRepository.save(task);

            Long ownerId = projectRepository.findById(saved.getProjectId()).map(ProjectEntity::getOwnerId).orElse(null);
            Long assigneeId = saved.getAssignedUserId();
            String taskLabel = saved.getCode() + " (" + saved.getTitle() + ")";
            String targetUrl = "/project/" + saved.getProjectId() + "/my-tasks";

            if (assigneeId != null) {
                notify(assigneeId, saved, "Task overdue",
                    "Task " + taskLabel + " has passed its deadline. Please finish it as soon as possible.",
                    targetUrl, now);
            }
            if (ownerId != null && !Objects.equals(ownerId, assigneeId)) {
                String who = assigneeId != null ? "The assignee has missed the deadline." : "The task has no assignee.";
                notify(ownerId, saved, "Task overdue",
                    "Task " + taskLabel + " has passed its deadline. " + who,
                    "/project/" + saved.getProjectId() + "/workflow", now);
            }

            // Đẩy SSE thời gian thực để UI đổi sang badge đỏ
            Set<Long> recipients = new LinkedHashSet<>();
            if (assigneeId != null) recipients.add(assigneeId);
            if (ownerId != null) recipients.add(ownerId);
            for (Long userId : recipients) {
                sseEmitterService.sendToUser(userId, "TASK_OVERDUE", nodeMapper.toKanbanTaskResponse(saved));
            }
        }
    }

    private void notify(Long userId, NodeEntity task, String title, String message, String targetUrl, Instant now) {
        eventPublisher.publishNotification(new NotificationEvent(
            userId, task.getProjectId(), title, message, "OVERDUE", targetUrl, now
        ));
    }
}
