package com.pipeline.wpe.service.engine;

import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.dto.event.NotificationEvent;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.mapper.NodeMapper;
import com.pipeline.wpe.repository.NodeRepository;
import com.pipeline.wpe.service.event.SseEmitterService;
import com.pipeline.wpe.service.event.WorkflowEventPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * Tác vụ định kỳ quét các công việc đang chạy (IN_PROGRESS) đã quá hạn due_date
 * để tự động đánh dấu is_overdue = true và phát cảnh báo real-time.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TaskOverdueScanner {

    private final NodeRepository nodeRepository;
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
        List<NodeEntity> overdueTasks = nodeRepository.findByStatusAndDueDateBeforeAndIsOverdueFalse(
            NodeStatus.IN_PROGRESS, now
        );

        if (!overdueTasks.isEmpty()) {
            log.warn("Phát hiện {} tác vụ IN_PROGRESS bị quá hạn!", overdueTasks.size());

            for (NodeEntity task : overdueTasks) {
                task.setIsOverdue(true);
                NodeEntity saved = nodeRepository.save(task);

                if (saved.getAssignedUserId() != null) {
                    eventPublisher.publishNotification(new NotificationEvent(
                        saved.getAssignedUserId(),
                        saved.getProjectId(),
                        "Tác vụ đã quá hạn!",
                        "Tác vụ " + saved.getCode() + " (" + saved.getTitle() + ") đã vượt quá thời hạn cam kết.",
                        "OVERDUE",
                        "/projects/" + saved.getProjectId() + "/tasks",
                        now
                    ));

                    // Đẩy SSE thời gian thực để UI đổi sang badge ĐỎ
                    sseEmitterService.sendToUser(
                        saved.getAssignedUserId(),
                        "TASK_OVERDUE",
                        nodeMapper.toKanbanTaskResponse(saved)
                    );
                }
            }
        }
    }
}
