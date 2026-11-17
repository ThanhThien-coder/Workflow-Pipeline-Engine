package com.pipeline.wpe.service.event;

import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.ProjectMemberEntity;
import com.pipeline.wpe.repository.ProjectMemberRepository;
import com.pipeline.wpe.repository.ProjectRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Unit Tests for ProjectRealtimeNotifier")
class ProjectRealtimeNotifierTest {

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private ProjectMemberRepository projectMemberRepository;

    @Mock
    private SseEmitterService sseEmitterService;

    @InjectMocks
    private ProjectRealtimeNotifier notifier;

    private final Long projectId = 100L;
    private final Long ownerId = 1L;

    @BeforeEach
    void setUp() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @AfterEach
    void tearDown() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    @DisplayName("Người nhận = chủ + thành viên đang hoạt động, không gồm người đã rời, không trùng")
    void recipientsIncludeOwnerAndActiveMembersOnly() {
        ProjectEntity project = ProjectEntity.builder()
            .id(projectId)
            .ownerId(ownerId)
            .build();

        ProjectMemberEntity memberOwner = ProjectMemberEntity.builder()
            .projectId(projectId)
            .userId(ownerId) // Trùng với ownerId
            .removedAt(null)
            .build();

        ProjectMemberEntity memberActive = ProjectMemberEntity.builder()
            .projectId(projectId)
            .userId(2L)
            .removedAt(null)
            .build();

        ProjectMemberEntity memberRemoved = ProjectMemberEntity.builder()
            .projectId(projectId)
            .userId(3L)
            .removedAt(Instant.now()) // Đã rời dự án
            .build();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(projectMemberRepository.findByProjectIdAndRemovedAtIsNull(projectId))
            .thenReturn(List.of(memberOwner, memberActive, memberRemoved));

        Set<Long> recipients = notifier.resolveRecipientUserIds(projectId);

        // Chỉ chứa ownerId (1L) và memberActive (2L), loại bỏ duplicate 1L và loại bỏ memberRemoved (3L)
        assertThat(recipients).containsExactlyInAnyOrder(1L, 2L);
    }

    @Test
    @DisplayName("Không có transaction -> gửi SSE ngay lập tức")
    void notifyTasksChangedWithoutTransaction_sendsImmediately() {
        ProjectEntity project = ProjectEntity.builder()
            .id(projectId)
            .ownerId(ownerId)
            .build();

        ProjectMemberEntity memberActive = ProjectMemberEntity.builder()
            .projectId(projectId)
            .userId(2L)
            .removedAt(null)
            .build();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(projectMemberRepository.findByProjectIdAndRemovedAtIsNull(projectId))
            .thenReturn(List.of(memberActive));

        notifier.notifyTasksChanged(projectId, 10L, 20L, "STATUS_CHANGED");

        ArgumentCaptor<ProjectRealtimeNotifier.ProjectTasksChangedPayload> payloadCaptor =
            ArgumentCaptor.forClass(ProjectRealtimeNotifier.ProjectTasksChangedPayload.class);

        verify(sseEmitterService, times(1)).sendToUser(eq(ownerId), eq("PROJECT_TASKS_CHANGED"), payloadCaptor.capture());
        verify(sseEmitterService, times(1)).sendToUser(eq(2L), eq("PROJECT_TASKS_CHANGED"), any());

        ProjectRealtimeNotifier.ProjectTasksChangedPayload payload = payloadCaptor.getValue();
        assertThat(payload.projectId()).isEqualTo("100");
        assertThat(payload.phaseId()).isEqualTo("10");
        assertThat(payload.taskId()).isEqualTo("20");
        assertThat(payload.reason()).isEqualTo("STATUS_CHANGED");
    }

    @Test
    @DisplayName("Trong transaction -> chỉ gửi sau khi transaction commit thành công")
    void notifyTasksChangedInTransaction_sendsOnlyAfterCommit() {
        TransactionSynchronizationManager.initSynchronization();

        ProjectEntity project = ProjectEntity.builder()
            .id(projectId)
            .ownerId(ownerId)
            .build();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(projectMemberRepository.findByProjectIdAndRemovedAtIsNull(projectId)).thenReturn(List.of());

        notifier.notifyTasksChanged(projectId, 10L, 20L, "STATUS_CHANGED");

        // Chưa commit -> chưa gửi
        verifyNoInteractions(sseEmitterService);

        // Kích hoạt commit
        List<TransactionSynchronization> synchronizations = TransactionSynchronizationManager.getSynchronizations();
        assertThat(synchronizations).isNotEmpty();
        for (TransactionSynchronization sync : synchronizations) {
            sync.afterCompletion(TransactionSynchronization.STATUS_COMMITTED);
        }

        // Đã gửi sau commit
        verify(sseEmitterService, times(1)).sendToUser(eq(ownerId), eq("PROJECT_TASKS_CHANGED"), any());
    }

    @Test
    @DisplayName("Trong transaction nhưng rollback -> không gửi SSE")
    void notifyTasksChangedInTransaction_doesNotSendOnRollback() {
        TransactionSynchronizationManager.initSynchronization();

        ProjectEntity project = ProjectEntity.builder()
            .id(projectId)
            .ownerId(ownerId)
            .build();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(projectMemberRepository.findByProjectIdAndRemovedAtIsNull(projectId)).thenReturn(List.of());

        notifier.notifyTasksChanged(projectId, 10L, 20L, "STATUS_CHANGED");

        // Kích hoạt rollback
        List<TransactionSynchronization> synchronizations = TransactionSynchronizationManager.getSynchronizations();
        assertThat(synchronizations).isNotEmpty();
        for (TransactionSynchronization sync : synchronizations) {
            sync.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK);
        }

        // Không bao giờ gửi khi rollback
        verifyNoInteractions(sseEmitterService);
    }
}
