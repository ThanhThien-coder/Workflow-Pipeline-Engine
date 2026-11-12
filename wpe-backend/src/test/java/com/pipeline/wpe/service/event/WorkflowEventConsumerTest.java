package com.pipeline.wpe.service.event;

import com.pipeline.wpe.common.enums.JoinPolicy;
import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.dto.event.NotificationEvent;
import com.pipeline.wpe.dto.event.TaskCompletedEvent;
import com.pipeline.wpe.dto.response.notification.NotificationResponse;
import com.pipeline.wpe.entity.NodeDependencyEntity;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.NotificationEntity;
import com.pipeline.wpe.mapper.NodeMapper;
import com.pipeline.wpe.repository.ArtifactRepository;
import com.pipeline.wpe.repository.NodeDependencyRepository;
import com.pipeline.wpe.repository.NodeRepository;
import com.pipeline.wpe.repository.NotificationRepository;
import com.pipeline.wpe.repository.ProjectMemberRepository;
import com.pipeline.wpe.repository.ProjectRepository;
import com.pipeline.wpe.service.engine.StateMachineService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.OptimisticLockingFailureException;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * C2: payload SSE thông báo là NotificationResponse (không đưa entity ra ngoài),
 * consumer TaskCompleted để Spring retry khi xung đột version, và lũy đẳng khi cùng sự kiện chạy 2 lần.
 */
@ExtendWith(MockitoExtension.class)
class WorkflowEventConsumerTest {

    @Mock
    private NotificationRepository notificationRepository;
    @Mock
    private SseEmitterService sseEmitterService;
    @Mock
    private StateMachineService stateMachineService;

    private WorkflowEventConsumer consumer() {
        return new WorkflowEventConsumer(notificationRepository, stateMachineService, sseEmitterService);
    }

    @Test
    @DisplayName("NotificationEvent: lưu 1 bản ghi và đẩy SSE NOTIFICATION_RECEIVED với payload NotificationResponse")
    void handleNotification_pushesNotificationResponse() {
        Instant createdAt = Instant.parse("2026-11-12T08:00:00Z");
        when(notificationRepository.save(any(NotificationEntity.class))).thenAnswer(invocation -> {
            NotificationEntity entity = invocation.getArgument(0);
            entity.setId(42L);
            entity.setCreatedAt(createdAt);
            return entity;
        });
        NotificationEvent event = new NotificationEvent(3L, 1L, "Tác vụ sẵn sàng thực hiện", "WPE-004 đã mở khóa",
            "TASK_READY", "/projects/1/tasks", createdAt);

        consumer().handleNotification(event);

        verify(notificationRepository, times(1)).save(any(NotificationEntity.class));
        ArgumentCaptor<Object> payload = ArgumentCaptor.forClass(Object.class);
        verify(sseEmitterService).sendToUser(eq(3L), eq("NOTIFICATION_RECEIVED"), payload.capture());
        assertThat(payload.getValue()).isEqualTo(new NotificationResponse(
            "42", "Tác vụ sẵn sàng thực hiện", "WPE-004 đã mở khóa", "/projects/1/tasks", false, createdAt));
    }

    @Test
    @DisplayName("TaskCompleted gặp OptimisticLockingFailureException: ném lại để Spring retry (3 lần)")
    void handleTaskCompleted_optimisticLock_rethrowsForRetry() {
        doThrow(new OptimisticLockingFailureException("version conflict"))
            .when(stateMachineService).unlockDownstreamTasks(3L);

        assertThatThrownBy(() -> consumer().handleTaskCompleted(
            new TaskCompletedEvent(3L, 1L, "WPE-003", 2L, Instant.now())))
            .isInstanceOf(OptimisticLockingFailureException.class);
    }

    @Test
    @DisplayName("Lũy đẳng: cùng 1 TaskCompletedEvent chạy 2 lần chỉ mở khóa và gửi thông báo 1 lần")
    void handleTaskCompleted_twice_unlocksAndNotifiesOnce() {
        NodeRepository nodeRepository = mock(NodeRepository.class);
        NodeDependencyRepository dependencyRepository = mock(NodeDependencyRepository.class);
        WorkflowEventPublisher eventPublisher = mock(WorkflowEventPublisher.class);
        StateMachineService realEngine = new StateMachineService(nodeRepository, dependencyRepository,
            mock(ProjectRepository.class), mock(ProjectMemberRepository.class), mock(ArtifactRepository.class),
            eventPublisher, sseEmitterService, mock(NodeMapper.class));

        NodeDependencyEntity edge = NodeDependencyEntity.builder().parentNodeId(3L).childNodeId(4L).build();
        NodeEntity parent = NodeEntity.builder().id(3L).status(NodeStatus.DONE).build();
        NodeEntity child = NodeEntity.builder().id(4L).projectId(1L).code("WPE-004").title("Kahn Algorithm DAG")
            .status(NodeStatus.LOCKED).joinPolicy(JoinPolicy.ALL_COMPLETED).assignedUserId(2L).build();
        when(dependencyRepository.findByParentNodeId(3L)).thenReturn(List.of(edge));
        when(dependencyRepository.findByChildNodeId(4L)).thenReturn(List.of(edge));
        when(nodeRepository.findById(3L)).thenReturn(Optional.of(parent));
        when(nodeRepository.findById(4L)).thenReturn(Optional.of(child));
        when(nodeRepository.save(any(NodeEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        WorkflowEventConsumer realConsumer = new WorkflowEventConsumer(notificationRepository, realEngine, sseEmitterService);
        TaskCompletedEvent event = new TaskCompletedEvent(3L, 1L, "WPE-003", 2L, Instant.now());

        realConsumer.handleTaskCompleted(event);
        realConsumer.handleTaskCompleted(event);

        assertThat(child.getStatus()).isEqualTo(NodeStatus.TODO);
        verify(nodeRepository, times(1)).save(any(NodeEntity.class));
        verify(eventPublisher, times(1)).publishNotification(any(NotificationEvent.class));
    }
}
