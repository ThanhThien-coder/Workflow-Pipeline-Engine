package com.pipeline.wpe.service.engine;

import com.pipeline.wpe.common.enums.JoinPolicy;
import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.common.enums.ProjectStatus;
import com.pipeline.wpe.dto.event.NotificationEvent;
import com.pipeline.wpe.dto.request.node.SubmitTaskArtifactRequest;
import com.pipeline.wpe.dto.request.node.UpdateNodeStatusRequest;
import com.pipeline.wpe.dto.response.node.KanbanTaskResponse;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.exception.ConflictException;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.mapper.NodeMapper;
import com.pipeline.wpe.repository.ArtifactRepository;
import com.pipeline.wpe.repository.NodeDependencyRepository;
import com.pipeline.wpe.repository.NodeRepository;
import com.pipeline.wpe.repository.ProjectMemberRepository;
import com.pipeline.wpe.repository.ProjectRepository;
import com.pipeline.wpe.service.event.SseEmitterService;
import com.pipeline.wpe.service.event.WorkflowEventPublisher;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * C1: ma trận chuyển trạng thái task (trạng thái hiện tại × trạng thái đích × vai trò),
 * chặn dự án ARCHIVED, thông báo khi force unlock và SSE gửi sau commit.
 * Bổ sung cho StateMachineServiceTest (15 test cũ giữ nguyên).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StateMachineServiceMatrixTest {

    @Mock private NodeRepository nodeRepository;
    @Mock private NodeDependencyRepository dependencyRepository;
    @Mock private ProjectRepository projectRepository;
    @Mock private ProjectMemberRepository projectMemberRepository;
    @Mock private ArtifactRepository artifactRepository;
    @Mock private WorkflowEventPublisher eventPublisher;
    @Mock private SseEmitterService sseEmitterService;
    @Mock private NodeMapper nodeMapper;

    @InjectMocks
    private StateMachineService stateMachineService;

    /** Vai trò của người gọi đối với task đang xét. */
    enum Role {
        OWNER(2L), ASSIGNEE(3L), OTHER_MEMBER(4L);
        final Long userId;
        Role(Long userId) { this.userId = userId; }
    }

    private static final Long PROJECT_ID = 1L;
    private static final Long TASK_ID = 10L;

    private ProjectEntity project;
    private NodeEntity node;

    @BeforeEach
    void setUp() {
        project = ProjectEntity.builder()
            .id(PROJECT_ID)
            .ownerId(Role.OWNER.userId)
            .name("Core Banking Pipeline")
            .status(ProjectStatus.ACTIVE)
            .build();

        node = NodeEntity.builder()
            .id(TASK_ID)
            .projectId(PROJECT_ID)
            .code("WPE-010")
            .title("Test Task")
            .status(NodeStatus.TODO)
            .assignedUserId(Role.ASSIGNEE.userId)
            .joinPolicy(JoinPolicy.ALL_COMPLETED)
            .version(0L)
            .uiMetadata(Map.of())
            .build();

        KanbanTaskResponse response = new KanbanTaskResponse(
            "10", "1", "WPE-010", "Test Task", "Desc", "TODO",
            "3", "ALL_COMPLETED", null, Instant.now(), false, 0L, Map.of()
        );

        when(nodeRepository.findById(TASK_ID)).thenReturn(Optional.of(node));
        when(projectRepository.findById(PROJECT_ID)).thenReturn(Optional.of(project));
        when(nodeRepository.save(any(NodeEntity.class))).thenAnswer(i -> i.getArgument(0));
        when(nodeMapper.toKanbanTaskResponse(any())).thenReturn(response);
    }

    @AfterEach
    void clearTransaction() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    private void commit() {
        for (TransactionSynchronization sync : TransactionSynchronizationManager.getSynchronizations()) {
            sync.afterCommit();
        }
    }

    private static UpdateNodeStatusRequest move(NodeStatus to, String rejectReason) {
        return new UpdateNodeStatusRequest(to.name(), rejectReason, 0L);
    }

    // ------------------------------------------------------------------
    // 1. Ma trận updateStatus
    // ------------------------------------------------------------------

    static Stream<Arguments> allowedTransitions() {
        return Stream.of(
            arguments(NodeStatus.TODO, NodeStatus.IN_PROGRESS, Role.ASSIGNEE, null),
            arguments(NodeStatus.TODO, NodeStatus.IN_PROGRESS, Role.OWNER, null),
            arguments(NodeStatus.IN_PROGRESS, NodeStatus.TODO, Role.ASSIGNEE, null),
            arguments(NodeStatus.IN_PROGRESS, NodeStatus.TODO, Role.OWNER, null),
            arguments(NodeStatus.IN_PROGRESS, NodeStatus.REVIEW, Role.ASSIGNEE, null),
            arguments(NodeStatus.IN_PROGRESS, NodeStatus.REVIEW, Role.OWNER, null),
            arguments(NodeStatus.REVIEW, NodeStatus.DONE, Role.OWNER, null),
            arguments(NodeStatus.REVIEW, NodeStatus.IN_PROGRESS, Role.OWNER, "Thiếu test case")
        );
    }

    @ParameterizedTest(name = "[{index}] {0} -> {1} bởi {2}: được phép")
    @MethodSource("allowedTransitions")
    @DisplayName("Ma trận: chuyển hợp lệ")
    void allowedTransition(NodeStatus from, NodeStatus to, Role role, String reason) {
        node.setStatus(from);

        stateMachineService.updateStatus(TASK_ID, move(to, reason), role.userId);

        assertThat(node.getStatus()).isEqualTo(to);
        verify(nodeRepository).save(node);
    }

    static Stream<Arguments> forbiddenTransitions() {
        return Stream.of(
            arguments(NodeStatus.TODO, NodeStatus.IN_PROGRESS, Role.OTHER_MEMBER, null),
            arguments(NodeStatus.IN_PROGRESS, NodeStatus.TODO, Role.OTHER_MEMBER, null),
            arguments(NodeStatus.IN_PROGRESS, NodeStatus.REVIEW, Role.OTHER_MEMBER, null),
            arguments(NodeStatus.REVIEW, NodeStatus.DONE, Role.ASSIGNEE, null),
            arguments(NodeStatus.REVIEW, NodeStatus.DONE, Role.OTHER_MEMBER, null),
            arguments(NodeStatus.REVIEW, NodeStatus.IN_PROGRESS, Role.ASSIGNEE, "Lý do"),
            arguments(NodeStatus.REVIEW, NodeStatus.IN_PROGRESS, Role.OTHER_MEMBER, "Lý do")
        );
    }

    @ParameterizedTest(name = "[{index}] {0} -> {1} bởi {2}: 403")
    @MethodSource("forbiddenTransitions")
    @DisplayName("Ma trận: sai vai trò bị chặn 403")
    void forbiddenTransition(NodeStatus from, NodeStatus to, Role role, String reason) {
        node.setStatus(from);

        assertThatThrownBy(() -> stateMachineService.updateStatus(TASK_ID, move(to, reason), role.userId))
            .isInstanceOf(ForbiddenException.class);

        assertThat(node.getStatus()).isEqualTo(from);
        verify(nodeRepository, never()).save(any());
        verify(eventPublisher, never()).publishTaskCompleted(any());
    }

    static Stream<Arguments> invalidTransitions() {
        return Stream.of(
            arguments(NodeStatus.LOCKED, NodeStatus.TODO),
            arguments(NodeStatus.LOCKED, NodeStatus.IN_PROGRESS),
            arguments(NodeStatus.TODO, NodeStatus.REVIEW),
            arguments(NodeStatus.TODO, NodeStatus.DONE),
            arguments(NodeStatus.TODO, NodeStatus.LOCKED),
            arguments(NodeStatus.IN_PROGRESS, NodeStatus.DONE),
            arguments(NodeStatus.IN_PROGRESS, NodeStatus.LOCKED),
            arguments(NodeStatus.REVIEW, NodeStatus.TODO),
            arguments(NodeStatus.REVIEW, NodeStatus.LOCKED),
            arguments(NodeStatus.DONE, NodeStatus.TODO),
            arguments(NodeStatus.DONE, NodeStatus.IN_PROGRESS)
        );
    }

    @ParameterizedTest(name = "[{index}] {0} -> {1} (kể cả Owner): 400")
    @MethodSource("invalidTransitions")
    @DisplayName("Ma trận: luồng không hợp lệ bị chặn 400 cho mọi vai trò")
    void invalidTransition(NodeStatus from, NodeStatus to) {
        node.setStatus(from);

        assertThatThrownBy(() -> stateMachineService.updateStatus(TASK_ID, move(to, null), Role.OWNER.userId))
            .isInstanceOf(IllegalArgumentException.class);

        assertThat(node.getStatus()).isEqualTo(from);
        verify(nodeRepository, never()).save(any());
    }

    @Test
    @DisplayName("Ma trận: trạng thái đích không tồn tại → 400")
    void unknownTargetStatus() {
        UpdateNodeStatusRequest request = new UpdateNodeStatusRequest("FINISHED", null, 0L);

        assertThatThrownBy(() -> stateMachineService.updateStatus(TASK_ID, request, Role.OWNER.userId))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Trạng thái không hợp lệ");
    }

    // ------------------------------------------------------------------
    // 2. Nộp bài và force unlock theo vai trò
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Nộp bài: thành viên khác (không phụ trách, không phải Owner) → 403")
    void submit_byOtherMember_forbidden() {
        node.setStatus(NodeStatus.IN_PROGRESS);
        SubmitTaskArtifactRequest request = new SubmitTaskArtifactRequest(null, null, null, null, null, null, 0L);

        assertThatThrownBy(() -> stateMachineService.submitTaskArtifact(TASK_ID, request, Role.OTHER_MEMBER.userId))
            .isInstanceOf(ForbiddenException.class);
        assertThat(node.getStatus()).isEqualTo(NodeStatus.IN_PROGRESS);
    }

    @Test
    @DisplayName("Nộp bài: task không ở IN_PROGRESS → 400")
    void submit_notInProgress_rejected() {
        node.setStatus(NodeStatus.TODO);
        SubmitTaskArtifactRequest request = new SubmitTaskArtifactRequest(null, null, null, null, null, null, 0L);

        assertThatThrownBy(() -> stateMachineService.submitTaskArtifact(TASK_ID, request, Role.ASSIGNEE.userId))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("Force unlock: thành viên khác → 403")
    void forceUnlock_byOtherMember_forbidden() {
        node.setStatus(NodeStatus.LOCKED);

        assertThatThrownBy(() -> stateMachineService.forceUnlock(TASK_ID, Role.OTHER_MEMBER.userId))
            .isInstanceOf(ForbiddenException.class);
        assertThat(node.getStatus()).isEqualTo(NodeStatus.LOCKED);
    }

    @Test
    @DisplayName("Force unlock: task không ở LOCKED → 400")
    void forceUnlock_notLocked_rejected() {
        node.setStatus(NodeStatus.TODO);

        assertThatThrownBy(() -> stateMachineService.forceUnlock(TASK_ID, Role.OWNER.userId))
            .isInstanceOf(IllegalArgumentException.class);
    }

    // ------------------------------------------------------------------
    // 3. Dự án ARCHIVED là chỉ đọc (workflow-engine.md 5.1)
    // ------------------------------------------------------------------

    @Nested
    @DisplayName("Dự án ARCHIVED → 409 PROJECT_ARCHIVED")
    class ArchivedProject {

        @BeforeEach
        void archive() {
            project.setStatus(ProjectStatus.ARCHIVED);
        }

        @Test
        @DisplayName("Đổi trạng thái task → 409, không lưu")
        void updateStatus_rejected() {
            node.setStatus(NodeStatus.TODO);

            assertThatThrownBy(() -> stateMachineService.updateStatus(
                    TASK_ID, move(NodeStatus.IN_PROGRESS, null), Role.ASSIGNEE.userId))
                .isInstanceOf(ConflictException.class)
                .extracting("errorCode").isEqualTo("PROJECT_ARCHIVED");
            assertThat(node.getStatus()).isEqualTo(NodeStatus.TODO);
            verify(nodeRepository, never()).save(any());
        }

        @Test
        @DisplayName("Owner duyệt bài → 409, không bắn TaskCompletedEvent")
        void approve_rejected() {
            node.setStatus(NodeStatus.REVIEW);

            assertThatThrownBy(() -> stateMachineService.updateStatus(
                    TASK_ID, move(NodeStatus.DONE, null), Role.OWNER.userId))
                .isInstanceOf(ConflictException.class)
                .extracting("errorCode").isEqualTo("PROJECT_ARCHIVED");
            verify(eventPublisher, never()).publishTaskCompleted(any());
        }

        @Test
        @DisplayName("Nộp bài → 409, không lưu artifact")
        void submit_rejected() {
            node.setStatus(NodeStatus.IN_PROGRESS);
            SubmitTaskArtifactRequest request = new SubmitTaskArtifactRequest(
                "10", "PR", "https://github.com/org/repo/pull/42", null, "PR #42", null, 0L);

            assertThatThrownBy(() -> stateMachineService.submitTaskArtifact(TASK_ID, request, Role.ASSIGNEE.userId))
                .isInstanceOf(ConflictException.class)
                .extracting("errorCode").isEqualTo("PROJECT_ARCHIVED");
            assertThat(node.getStatus()).isEqualTo(NodeStatus.IN_PROGRESS);
            verify(artifactRepository, never()).save(any());
        }

        @Test
        @DisplayName("Force unlock → 409, task vẫn LOCKED")
        void forceUnlock_rejected() {
            node.setStatus(NodeStatus.LOCKED);

            assertThatThrownBy(() -> stateMachineService.forceUnlock(TASK_ID, Role.OWNER.userId))
                .isInstanceOf(ConflictException.class)
                .extracting("errorCode").isEqualTo("PROJECT_ARCHIVED");
            assertThat(node.getStatus()).isEqualTo(NodeStatus.LOCKED);
        }
    }

    // ------------------------------------------------------------------
    // 4. Force unlock tạo thông báo cho người phụ trách
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Force unlock: gửi thông báo 'mở khóa sớm' cho người phụ trách")
    void forceUnlock_notifiesAssignee() {
        node.setStatus(NodeStatus.LOCKED);

        stateMachineService.forceUnlock(TASK_ID, Role.OWNER.userId);

        ArgumentCaptor<NotificationEvent> captor = ArgumentCaptor.forClass(NotificationEvent.class);
        verify(eventPublisher).publishNotification(captor.capture());
        NotificationEvent event = captor.getValue();
        assertThat(event.recipientUserId()).isEqualTo(Role.ASSIGNEE.userId);
        assertThat(event.projectId()).isEqualTo(PROJECT_ID);
        assertThat(event.message()).contains("WPE-010").contains("mở khóa sớm");
        assertThat(event.type()).isEqualTo("FORCE_UNLOCKED");
    }

    @Test
    @DisplayName("Force unlock task chưa có người phụ trách: không gửi thông báo")
    void forceUnlock_withoutAssignee_noNotification() {
        node.setStatus(NodeStatus.LOCKED);
        node.setAssignedUserId(null);

        stateMachineService.forceUnlock(TASK_ID, Role.OWNER.userId);

        verify(eventPublisher, never()).publishNotification(any());
    }

    // ------------------------------------------------------------------
    // 5. SSE trong StateMachineService cũng chỉ gửi sau commit
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Trong transaction: SSE TASK_STATUS_CHANGED chưa gửi trước commit, gửi sau commit")
    void updateStatus_sseWaitsForCommit() {
        TransactionSynchronizationManager.initSynchronization();
        node.setStatus(NodeStatus.TODO);

        stateMachineService.updateStatus(TASK_ID, move(NodeStatus.IN_PROGRESS, null), Role.ASSIGNEE.userId);
        verify(sseEmitterService, never()).sendToUser(any(), anyString(), any());

        commit();
        verify(sseEmitterService).sendToUser(eq(Role.ASSIGNEE.userId), eq("TASK_STATUS_CHANGED"), any());
    }

    @Test
    @DisplayName("Trong transaction: SSE TASK_UNLOCKED của force unlock chỉ gửi sau commit")
    void forceUnlock_sseWaitsForCommit() {
        TransactionSynchronizationManager.initSynchronization();
        node.setStatus(NodeStatus.LOCKED);

        stateMachineService.forceUnlock(TASK_ID, Role.OWNER.userId);
        verify(sseEmitterService, never()).sendToUser(any(), anyString(), any());

        commit();
        verify(sseEmitterService).sendToUser(eq(Role.ASSIGNEE.userId), eq("TASK_UNLOCKED"), any());
    }
}
