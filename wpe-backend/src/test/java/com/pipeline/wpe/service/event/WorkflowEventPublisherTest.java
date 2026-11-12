package com.pipeline.wpe.service.event;

import com.pipeline.wpe.config.RabbitMQConfig;
import com.pipeline.wpe.dto.event.NotificationEvent;
import com.pipeline.wpe.dto.event.TaskCompletedEvent;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * C1: sự kiện RabbitMQ chỉ được gửi SAU KHI transaction commit.
 * Mô phỏng transaction bằng TransactionSynchronizationManager.initSynchronization():
 * đó chính là cơ chế Spring dùng khi chạy trong @Transactional.
 */
@ExtendWith(MockitoExtension.class)
class WorkflowEventPublisherTest {

    @Mock
    private RabbitTemplate rabbitTemplate;

    @InjectMocks
    private WorkflowEventPublisher publisher;

    private final TaskCompletedEvent taskCompleted =
        new TaskCompletedEvent(3L, 1L, "WPE-003", 2L, Instant.now());
    private final NotificationEvent notification =
        new NotificationEvent(3L, 1L, "Tiêu đề", "Nội dung", "TASK_READY", "/projects/1/tasks", Instant.now());

    @AfterEach
    void clearTransaction() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    /** Giả lập Spring commit transaction: gọi afterCommit của mọi synchronization đã đăng ký. */
    private void commit() {
        for (TransactionSynchronization sync : TransactionSynchronizationManager.getSynchronizations()) {
            sync.afterCommit();
        }
    }

    /** Giả lập rollback: Spring chỉ gọi afterCompletion(ROLLED_BACK), không gọi afterCommit. */
    private void rollback() {
        for (TransactionSynchronization sync : TransactionSynchronizationManager.getSynchronizations()) {
            sync.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK);
        }
    }

    @Test
    @DisplayName("Không có transaction: gửi TaskCompletedEvent ngay")
    void publishTaskCompleted_withoutTransaction_sendsImmediately() {
        publisher.publishTaskCompleted(taskCompleted);

        verify(rabbitTemplate).convertAndSend(
            RabbitMQConfig.EXCHANGE_WORKFLOW, RabbitMQConfig.ROUTING_KEY_TASK_COMPLETED, taskCompleted);
    }

    @Test
    @DisplayName("Trong transaction: convertAndSend CHƯA được gọi trước commit, chỉ gọi đúng 1 lần sau commit")
    void publishTaskCompleted_insideTransaction_waitsForCommit() {
        TransactionSynchronizationManager.initSynchronization();

        publisher.publishTaskCompleted(taskCompleted);
        verify(rabbitTemplate, never()).convertAndSend(anyString(), anyString(), any(Object.class));

        commit();
        verify(rabbitTemplate, times(1)).convertAndSend(
            RabbitMQConfig.EXCHANGE_WORKFLOW, RabbitMQConfig.ROUTING_KEY_TASK_COMPLETED, taskCompleted);
    }

    @Test
    @DisplayName("Trong transaction bị rollback: không gửi sự kiện nào")
    void publishTaskCompleted_rolledBack_neverSends() {
        TransactionSynchronizationManager.initSynchronization();

        publisher.publishTaskCompleted(taskCompleted);
        rollback();

        verify(rabbitTemplate, never()).convertAndSend(anyString(), anyString(), any(Object.class));
    }

    @Test
    @DisplayName("Trong transaction: NotificationEvent cũng chỉ gửi sau commit, routing key giữ nguyên")
    void publishNotification_insideTransaction_waitsForCommit() {
        TransactionSynchronizationManager.initSynchronization();

        publisher.publishNotification(notification);
        verify(rabbitTemplate, never()).convertAndSend(anyString(), anyString(), any(Object.class));

        commit();
        verify(rabbitTemplate).convertAndSend(
            RabbitMQConfig.EXCHANGE_WORKFLOW, "wpe.notification.task_ready", notification);
    }

    @Test
    @DisplayName("RabbitMQ lỗi sau commit: không ném lỗi ra ngoài (dữ liệu đã commit), chỉ ghi log")
    void publishTaskCompleted_brokerFailsAfterCommit_doesNotThrow() {
        doThrow(new AmqpException("broker down")).when(rabbitTemplate)
            .convertAndSend(eq(RabbitMQConfig.EXCHANGE_WORKFLOW), anyString(), any(Object.class));
        TransactionSynchronizationManager.initSynchronization();

        publisher.publishTaskCompleted(taskCompleted);

        assertThatCode(this::commit).doesNotThrowAnyException();
    }
}
