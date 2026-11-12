package com.pipeline.wpe.service.event;

import com.pipeline.wpe.config.RabbitMQConfig;
import com.pipeline.wpe.dto.event.AiDiagnosticRequestedEvent;
import com.pipeline.wpe.dto.event.NotificationEvent;
import com.pipeline.wpe.dto.event.TaskCompletedEvent;
import com.pipeline.wpe.dto.response.notification.NotificationResponse;
import com.pipeline.wpe.entity.NotificationEntity;
import com.pipeline.wpe.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Component;

/**
 * Consumer lắng nghe các hàng đợi RabbitMQ để thực hiện các tác vụ ngầm (Background Worker).
 * Giúp giải phóng toàn bộ thời gian chờ đợi cho các RESTful API của người dùng.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WorkflowEventConsumer {

    private final NotificationRepository notificationRepository;
    private final com.pipeline.wpe.service.engine.StateMachineService stateMachineService;
    private final SseEmitterService sseEmitterService;

    /**
     * 1. Hứng sự kiện Task DONE để tự động mở khóa các node con theo thuật toán DAG (AND/OR join).
     * Khi hoàn tất, các node con từ trạng thái LOCKED sẽ tự động chuyển sang TODO.
     */
    @RabbitListener(queues = RabbitMQConfig.QUEUE_TASK_COMPLETED)
    public void handleTaskCompleted(TaskCompletedEvent event) {
        log.info("Processing TaskCompletedEvent in background: Task ID={}, Code={}, Project ID={}",
                event.taskId(), event.taskCode(), event.projectId());

        // Lũy đẳng: unlockDownstreamTasks chỉ mở khóa node con đang LOCKED, nên cùng một sự kiện chạy lại
        // (retry, hoặc RabbitMQ giao lại) không mở khóa và không gửi thông báo lần 2.
        try {
            stateMachineService.unlockDownstreamTasks(event.taskId());
        } catch (OptimisticLockingFailureException e) {
            // Hai task cha cùng DONE một lúc cùng sửa một node con: một bên thua @Version.
            // Ném lại để Spring AMQP retry (spring.rabbitmq.listener.simple.retry, 3 lần); hết lượt thì vào DLQ.
            log.warn("Xung đột version khi mở khóa task con của Task ID [{}] ({}): {}. Ném lại để RabbitMQ thử lại.",
                    event.taskId(), event.taskCode(), e.getMessage());
            throw e;
        } catch (Exception e) {
            log.error("Lỗi khi mở khóa downstream tasks cho Task ID [{}]: {}", event.taskId(), e.getMessage(), e);
            throw e;
        }
    }

    /**
     * 2. Hứng sự kiện thông báo để ghi vào bảng NOTIFICATION và đẩy thời gian thực cho người dùng.
     */
    @RabbitListener(queues = RabbitMQConfig.QUEUE_NOTIFICATION)
    public void handleNotification(NotificationEvent event) {
        log.info("Processing NotificationEvent in background: Recipient={}, Title={}",
                event.recipientUserId(), event.title());

        if (event.recipientUserId() != null) {
            try {
                NotificationEntity notification = NotificationEntity.builder()
                        .userId(event.recipientUserId())
                        .title(event.title())
                        .message(event.message())
                        .linkUrl(event.targetUrl())
                        .isRead(false)
                        .build();
                NotificationEntity saved = notificationRepository.save(notification);
                log.info("Saved notification ID: {} for user: {}", saved.getId(), event.recipientUserId());

                // Đẩy thông báo thời gian thực xuống client qua SSE (payload là DTO, không đưa entity ra ngoài)
                sseEmitterService.sendToUser(event.recipientUserId(), "NOTIFICATION_RECEIVED",
                        NotificationResponse.from(saved));
            } catch (Exception e) {
                log.error("Failed to persist notification in background: {}", e.getMessage(), e);
            }
        }
    }

    // Sự kiện lời mời (InvitationCreatedEvent, InvitationAcceptedEvent) do InvitationEventConsumer xử lý,
    // trên queue riêng wpe.invitation.queue (C2).

    /**
     * 3. Hứng sự kiện chẩn đoán sự cố ngầm (gọi Google Gemini API).
     */
    @RabbitListener(queues = RabbitMQConfig.QUEUE_AI_DIAGNOSTICS)
    public void handleAiDiagnosticRequest(AiDiagnosticRequestedEvent event) {
        log.info("Processing AiDiagnosticRequestedEvent in background: Failed Task ID={}, Project={}",
                event.failedTaskId(), event.projectId());
    }

    /**
     * 4. Hứng Dead Letter Queue (DLQ) để ghi vết sự cố khi một tác vụ xử lý thất bại nhiều lần.
     */
    @RabbitListener(queues = RabbitMQConfig.QUEUE_DEAD_LETTER)
    public void handleDeadLetterMessage(org.springframework.amqp.core.Message failedMessage) {
        log.error("Dead Letter Queue received failed message: {}", new String(failedMessage.getBody()));
    }
}
