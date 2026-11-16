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
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TaskOverdueScannerTest {

    @Mock private NodeRepository nodeRepository;
    @Mock private ProjectRepository projectRepository;
    @Mock private WorkflowEventPublisher eventPublisher;
    @Mock private SseEmitterService sseEmitterService;
    @Mock private NodeMapper nodeMapper;

    @InjectMocks
    private TaskOverdueScanner scanner;

    private NodeEntity overdueTask(Long assigneeId, NodeStatus status) {
        return NodeEntity.builder()
            .id(10L).projectId(1L).code("WPE-010").title("Write report")
            .status(status).assignedUserId(assigneeId)
            .dueDate(Instant.now().minusSeconds(60)).isOverdue(false)
            .build();
    }

    @Test
    @DisplayName("G21: task TODO quá hạn -> đánh dấu overdue, báo tiếng Anh cho người làm và chủ dự án")
    void notifiesAssigneeAndOwner() {
        NodeEntity task = overdueTask(5L, NodeStatus.TODO);
        when(nodeRepository.findByStatusNotAndDueDateBeforeAndIsOverdueFalse(eq(NodeStatus.DONE), any())).thenReturn(List.of(task));
        when(nodeRepository.save(task)).thenReturn(task);
        when(projectRepository.findById(1L)).thenReturn(Optional.of(ProjectEntity.builder().id(1L).ownerId(2L).build()));

        scanner.scanOverdueTasks();

        assertThat(task.getIsOverdue()).isTrue();
        ArgumentCaptor<NotificationEvent> captor = ArgumentCaptor.forClass(NotificationEvent.class);
        verify(eventPublisher, times(2)).publishNotification(captor.capture());
        assertThat(captor.getAllValues()).extracting(NotificationEvent::recipientUserId).containsExactly(5L, 2L);
        assertThat(captor.getAllValues()).allSatisfy(e -> {
            assertThat(e.title()).isEqualTo("Task overdue");
            assertThat(e.message()).contains("WPE-010").contains("deadline");
            assertThat(e.type()).isEqualTo("OVERDUE");
        });
        verify(sseEmitterService).sendToUser(eq(5L), eq("TASK_OVERDUE"), any());
        verify(sseEmitterService).sendToUser(eq(2L), eq("TASK_OVERDUE"), any());
    }

    @Test
    @DisplayName("G21: chủ dự án tự làm task -> chỉ một thông báo")
    void ownerIsAssignee_singleNotification() {
        NodeEntity task = overdueTask(2L, NodeStatus.IN_PROGRESS);
        when(nodeRepository.findByStatusNotAndDueDateBeforeAndIsOverdueFalse(eq(NodeStatus.DONE), any())).thenReturn(List.of(task));
        when(nodeRepository.save(task)).thenReturn(task);
        when(projectRepository.findById(1L)).thenReturn(Optional.of(ProjectEntity.builder().id(1L).ownerId(2L).build()));

        scanner.scanOverdueTasks();

        verify(eventPublisher, times(1)).publishNotification(any());
    }

    @Test
    @DisplayName("G21: task chưa giao người -> vẫn báo chủ dự án")
    void unassigned_notifiesOwnerOnly() {
        NodeEntity task = overdueTask(null, NodeStatus.TODO);
        when(nodeRepository.findByStatusNotAndDueDateBeforeAndIsOverdueFalse(eq(NodeStatus.DONE), any())).thenReturn(List.of(task));
        when(nodeRepository.save(task)).thenReturn(task);
        when(projectRepository.findById(1L)).thenReturn(Optional.of(ProjectEntity.builder().id(1L).ownerId(2L).build()));

        scanner.scanOverdueTasks();

        ArgumentCaptor<NotificationEvent> captor = ArgumentCaptor.forClass(NotificationEvent.class);
        verify(eventPublisher).publishNotification(captor.capture());
        assertThat(captor.getValue().recipientUserId()).isEqualTo(2L);
        assertThat(captor.getValue().message()).contains("no assignee");
    }
}
