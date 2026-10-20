package com.pipeline.wpe.service.event;

import com.pipeline.wpe.config.RabbitMQConfig;
import com.pipeline.wpe.dto.event.AiDiagnosticRequestedEvent;
import com.pipeline.wpe.dto.event.NotificationEvent;
import com.pipeline.wpe.dto.event.TaskCompletedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

/**
 * Consumer lắng nghe các hàng đợi RabbitMQ để thực hiện các tác vụ ngầm (Background Worker).
 * Giúp giải phóng toàn bộ thời gian chờ đợi cho các RESTful API của người dùng.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WorkflowEventConsumer {

    /**
     * 1. Hứng sự kiện Task DONE để tự động mở khóa các node con theo thuật toán DAG (AND/OR join).
     * Khi hoàn tất, các node con từ trạng thái LOCKED sẽ tự động chuyển sang TODO.
     */
    @RabbitListener(queues = RabbitMQConfig.QUEUE_TASK_COMPLETED)
    public void handleTaskCompleted(TaskCompletedEvent event) {
        log.info("Processing TaskCompletedEvent in background: Task ID={}, Code={}, Project ID={}",
                event.taskId(), event.taskCode(), event.projectId());

        // TODO: Gọi DagEngineService để:
        // 1. Quét danh sách các con trực tiếp trong bảng NODE_DEPENDENCY.
        // 2. Kiểm tra join_policy (ALL_COMPLETED: tất cả cha đều DONE; ANY_COMPLETED: ít nhất 1 cha DONE).
        // 3. Nếu thỏa điều kiện, chuyển NODE.status = 'TODO' và bắn NotificationEvent cho Assignee.
    }

    /**
     * 2. Hứng sự kiện thông báo để ghi vào bảng NOTIFICATION và đẩy WebSocket cho người dùng.
     */
    @RabbitListener(queues = RabbitMQConfig.QUEUE_NOTIFICATION)
    public void handleNotification(NotificationEvent event) {
        log.info("Processing NotificationEvent in background: Recipient={}, Title={}",
                event.recipientUserId(), event.title());

        // TODO: Ghi bản ghi vào bảng NOTIFICATION và phát tín hiệu chuông thời gian thực
    }

    /**
     * 3. Hứng sự kiện chẩn đoán sự cố ngầm (gọi Google Gemini API).
     */
    @RabbitListener(queues = RabbitMQConfig.QUEUE_AI_DIAGNOSTICS)
    public void handleAiDiagnosticRequest(AiDiagnosticRequestedEvent event) {
        log.info("Processing AiDiagnosticRequestedEvent in background: Failed Task ID={}, Project={}",
                event.failedTaskId(), event.projectId());

        // TODO: Khi triển khai phân hệ AI, gọi Gemini Service phân tích và lưu vào cột latest_ai_analysis (JSONB)
    }

    /**
     * 4. Hứng Dead Letter Queue (DLQ) để ghi vết sự cố khi một tác vụ xử lý thất bại nhiều lần.
     */
    @RabbitListener(queues = RabbitMQConfig.QUEUE_DEAD_LETTER)
    public void handleDeadLetterMessage(org.springframework.amqp.core.Message failedMessage) {
        log.error("Dead Letter Queue received failed message: {}", new String(failedMessage.getBody()));
    }
}
