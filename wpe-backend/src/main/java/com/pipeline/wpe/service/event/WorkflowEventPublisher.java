package com.pipeline.wpe.service.event;

import com.pipeline.wpe.config.RabbitMQConfig;
import com.pipeline.wpe.dto.event.AiDiagnosticRequestedEvent;
import com.pipeline.wpe.dto.event.NotificationEvent;
import com.pipeline.wpe.dto.event.TaskCompletedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

/**
 * Service phụ trách phát hành sự kiện (Event Producer) lên RabbitMQ.
 * Tách biệt hoàn toàn việc xử lý HTTP Controller khỏi các tác vụ tính toán nặng.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WorkflowEventPublisher {

    private final RabbitTemplate rabbitTemplate;

    /**
     * Bắn sự kiện khi Task đạt trạng thái DONE.
     * Kích hoạt Kahn DAG Engine tự động mở khóa các node con mà không giữ connection HTTP.
     */
    public void publishTaskCompleted(TaskCompletedEvent event) {
        log.info("Publishing TaskCompletedEvent for Task ID: {}, Code: {} in Project: {}", 
                event.taskId(), event.taskCode(), event.projectId());
        rabbitTemplate.convertAndSend(
                RabbitMQConfig.EXCHANGE_WORKFLOW,
                RabbitMQConfig.ROUTING_KEY_TASK_COMPLETED,
                event
        );
    }

    /**
     * Bắn sự kiện gửi thông báo bất đồng bộ cho người dùng.
     */
    public void publishNotification(NotificationEvent event) {
        log.info("Publishing NotificationEvent for User ID: {}, Type: {}", 
                event.recipientUserId(), event.type());
        rabbitTemplate.convertAndSend(
                RabbitMQConfig.EXCHANGE_WORKFLOW,
                "wpe.notification." + event.type().toLowerCase(),
                event
        );
    }

    /**
     * Bắn sự kiện yêu cầu phân tích chẩn đoán sự cố ngầm qua AI.
     */
    public void publishAiDiagnosticRequest(AiDiagnosticRequestedEvent event) {
        log.info("Publishing AiDiagnosticRequestedEvent for Failed Task ID: {} in Project: {}", 
                event.failedTaskId(), event.projectId());
        rabbitTemplate.convertAndSend(
                RabbitMQConfig.EXCHANGE_WORKFLOW,
                RabbitMQConfig.ROUTING_KEY_AI_DIAGNOSTICS,
                event
        );
    }

    /**
     * Bắn sự kiện khi Lời mời tham gia dự án được khởi tạo.
     */
    public void publishInvitationCreated(com.pipeline.wpe.dto.event.InvitationCreatedEvent event) {
        log.info("Publishing InvitationCreatedEvent for Invitation ID: {}, Project: {}, Invitee: {}",
                event.invitationId(), event.projectName(), event.inviteeEmail());
        rabbitTemplate.convertAndSend(
                RabbitMQConfig.EXCHANGE_WORKFLOW,
                "wpe.notification.invitation_created",
                event
        );
    }

    /**
     * Bắn sự kiện khi Lời mời được chấp thuận.
     */
    public void publishInvitationAccepted(com.pipeline.wpe.dto.event.InvitationAcceptedEvent event) {
        log.info("Publishing InvitationAcceptedEvent for Invitation ID: {}, Project: {}, Invitee: {}",
                event.invitationId(), event.projectName(), event.inviteeId());
        rabbitTemplate.convertAndSend(
                RabbitMQConfig.EXCHANGE_WORKFLOW,
                "wpe.notification.invitation_accepted",
                event
        );
    }
}
