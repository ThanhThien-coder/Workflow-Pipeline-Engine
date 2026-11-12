package com.pipeline.wpe.service.event;

import com.pipeline.wpe.config.RabbitMQConfig;
import com.pipeline.wpe.dto.event.AiDiagnosticRequestedEvent;
import com.pipeline.wpe.dto.event.NotificationEvent;
import com.pipeline.wpe.dto.event.TaskCompletedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Service phụ trách phát hành sự kiện (Event Producer) lên RabbitMQ.
 * Tách biệt hoàn toàn việc xử lý HTTP Controller khỏi các tác vụ tính toán nặng.
 *
 * <p><b>Gửi sau commit (C1):</b> nếu hàm publish được gọi bên trong một transaction đang mở,
 * sự kiện chỉ được gửi lên RabbitMQ <i>sau khi transaction commit</i>
 * ({@link TransactionSynchronization#afterCompletion(int)} với {@code STATUS_COMMITTED}).
 * Transaction rollback thì sự kiện không được gửi.
 * Không có transaction thì gửi ngay. Nhờ vậy consumer luôn đọc được dữ liệu đã lưu
 * (ví dụ task cha đã DONE khi mở khóa task con).
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
        sendAfterCommit(RabbitMQConfig.ROUTING_KEY_TASK_COMPLETED, event, "TaskCompletedEvent " + event.taskCode());
    }

    /**
     * Bắn sự kiện gửi thông báo bất đồng bộ cho người dùng.
     */
    public void publishNotification(NotificationEvent event) {
        log.info("Publishing NotificationEvent for User ID: {}, Type: {}",
                event.recipientUserId(), event.type());
        sendAfterCommit("wpe.notification." + event.type().toLowerCase(), event,
                "NotificationEvent " + event.type() + " cho user " + event.recipientUserId());
    }

    /**
     * Bắn sự kiện yêu cầu phân tích chẩn đoán sự cố ngầm qua AI.
     */
    public void publishAiDiagnosticRequest(AiDiagnosticRequestedEvent event) {
        log.info("Publishing AiDiagnosticRequestedEvent for Failed Task ID: {} in Project: {}",
                event.failedTaskId(), event.projectId());
        sendAfterCommit(RabbitMQConfig.ROUTING_KEY_AI_DIAGNOSTICS, event,
                "AiDiagnosticRequestedEvent project " + event.projectId());
    }

    /**
     * Bắn sự kiện khi Lời mời tham gia dự án được khởi tạo.
     */
    public void publishInvitationCreated(com.pipeline.wpe.dto.event.InvitationCreatedEvent event) {
        log.info("Publishing InvitationCreatedEvent for Invitation ID: {}, Project: {}, Invitee: {}",
                event.invitationId(), event.projectName(), event.inviteeEmail());
        sendAfterCommit(RabbitMQConfig.ROUTING_KEY_INVITATION_CREATED, event,
                "InvitationCreatedEvent " + event.invitationId());
    }

    /**
     * Bắn sự kiện khi Lời mời được chấp thuận.
     */
    public void publishInvitationAccepted(com.pipeline.wpe.dto.event.InvitationAcceptedEvent event) {
        log.info("Publishing InvitationAcceptedEvent for Invitation ID: {}, Project: {}, Invitee: {}",
                event.invitationId(), event.projectName(), event.inviteeId());
        sendAfterCommit(RabbitMQConfig.ROUTING_KEY_INVITATION_ACCEPTED, event,
                "InvitationAcceptedEvent " + event.invitationId());
    }

    /**
     * Trong transaction: hẹn gửi khi transaction kết thúc với trạng thái COMMITTED. Ngoài transaction: gửi ngay.
     *
     * <p>Dùng {@code afterCompletion(STATUS_COMMITTED)} chứ không dùng {@code afterCommit()}: code khác (ví dụ
     * {@code WorkflowGraphService.publishPipeline}) có thể gọi publish từ bên trong afterCommit của nó. Lúc đó
     * Spring đã lấy xong danh sách cần gọi afterCommit, nên một afterCommit đăng ký thêm sẽ không bao giờ chạy và
     * sự kiện mất lặng lẽ. afterCompletion được Spring lấy danh sách lại sau bước afterCommit nên vẫn chạy.
     * Spring cũng cài {@code @TransactionalEventListener(AFTER_COMMIT)} theo đúng cách này.
     *
     * <p>Lỗi gửi chỉ ghi log: dữ liệu đã commit, không còn rollback được, nên sự kiện đó bị mất
     * (muốn không mất thì cần outbox pattern — ghi trong workflow-engine.md mục 3.6).
     */
    private void sendAfterCommit(String routingKey, Object event, String description) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE_WORKFLOW, routingKey, event);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) {
                    return;
                }
                try {
                    rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE_WORKFLOW, routingKey, event);
                } catch (RuntimeException ex) {
                    log.error("Gửi {} lên RabbitMQ sau commit thất bại, sự kiện bị mất: {}",
                            description, ex.getMessage(), ex);
                }
            }
        });
    }
}
