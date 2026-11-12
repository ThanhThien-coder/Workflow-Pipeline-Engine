package com.pipeline.wpe.service.engine;

import com.pipeline.wpe.common.enums.JoinPolicy;
import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.common.enums.ProjectStatus;
import com.pipeline.wpe.dto.event.NotificationEvent;
import com.pipeline.wpe.dto.event.TaskCompletedEvent;
import com.pipeline.wpe.dto.request.node.SubmitTaskArtifactRequest;
import com.pipeline.wpe.dto.request.node.UpdateNodeStatusRequest;
import com.pipeline.wpe.dto.response.node.KanbanTaskResponse;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.ProjectMemberEntity;
import com.pipeline.wpe.exception.ConflictException;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.mapper.NodeMapper;
import com.pipeline.wpe.repository.ArtifactRepository;
import com.pipeline.wpe.repository.NodeDependencyRepository;
import com.pipeline.wpe.repository.NodeRepository;
import com.pipeline.wpe.repository.ProjectMemberRepository;
import com.pipeline.wpe.repository.ProjectRepository;
import com.pipeline.wpe.service.event.NoOpTransactionManager;
import com.pipeline.wpe.service.event.SseEmitterService;
import com.pipeline.wpe.service.event.WorkflowEventPublisher;
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
import org.springframework.transaction.support.TransactionTemplate;

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

    /**
     * Vai trò của người gọi đối với task đang xét.
     * C1b (sau PR #33): MANAGER còn hoạt động được duyệt/từ chối bài; REMOVED_MANAGER là Manager đã bị gỡ khỏi dự án
     * (không còn bản ghi project_member với removed_at = null).
     */
    enum Role {
        OWNER(2L), ASSIGNEE(3L), OTHER_MEMBER(4L), MANAGER(5L), REMOVED_MANAGER(6L);
        final Long userId;
        Role(Long userId) { this.userId = userId; }
    }

    private static ProjectMemberEntity activeMember(Role role, ProjectRole projectRole) {
        return ProjectMemberEntity.builder().projectId(PROJECT_ID).userId(role.userId).role(projectRole).build();
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

        // Thành viên đang hoạt động của dự án. REMOVED_MANAGER không có bản ghi nào → Optional.empty().
        when(projectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull(PROJECT_ID, Role.ASSIGNEE.userId))
            .thenReturn(Optional.of(activeMember(Role.ASSIGNEE, ProjectRole.COLLABORATOR)));
        when(projectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull(PROJECT_ID, Role.OTHER_MEMBER.userId))
            .thenReturn(Optional.of(activeMember(Role.OTHER_MEMBER, ProjectRole.COLLABORATOR)));
        when(projectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull(PROJECT_ID, Role.MANAGER.userId))
            .thenReturn(Optional.of(activeMember(Role.MANAGER, ProjectRole.MANAGER)));
    }

    /** Chạy code trong transaction theo đúng quy trình commit/rollback thật của Spring (không có DB). */
    private final TransactionTemplate tx = NoOpTransactionManager.template();

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
            arguments(NodeStatus.REVIEW, NodeStatus.IN_PROGRESS, Role.OWNER, "Thiếu test case"),
            // C1b: Manager duyệt và từ chối được (PR #33)
            arguments(NodeStatus.REVIEW, NodeStatus.DONE, Role.MANAGER, null),
            arguments(NodeStatus.REVIEW, NodeStatus.IN_PROGRESS, Role.MANAGER, "Thiếu test case")
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
            arguments(NodeStatus.REVIEW, NodeStatus.IN_PROGRESS, Role.OTHER_MEMBER, "Lý do"),
            // C1b: Manager không phụ trách task thì không bắt đầu, hủy nhận, nộp thay được
            arguments(NodeStatus.TODO, NodeStatus.IN_PROGRESS, Role.MANAGER, null),
            arguments(NodeStatus.IN_PROGRESS, NodeStatus.TODO, Role.MANAGER, null),
            arguments(NodeStatus.IN_PROGRESS, NodeStatus.REVIEW, Role.MANAGER, null),
            // C1b: Manager đã bị gỡ khỏi dự án mất quyền duyệt/từ chối
            arguments(NodeStatus.REVIEW, NodeStatus.DONE, Role.REMOVED_MANAGER, null),
            arguments(NodeStatus.REVIEW, NodeStatus.IN_PROGRESS, Role.REMOVED_MANAGER, "Lý do")
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
    @DisplayName("C1b: vai trò Manager (PR #33)")
    class ManagerRole {

        @Test
        @DisplayName("Manager duyệt: bắn TaskCompletedEvent ghi người duyệt là Manager")
        void approve_publishesTaskCompletedByManager() {
            node.setStatus(NodeStatus.REVIEW);

            stateMachineService.updateStatus(TASK_ID, move(NodeStatus.DONE, null), Role.MANAGER.userId);

            ArgumentCaptor<TaskCompletedEvent> event = ArgumentCaptor.forClass(TaskCompletedEvent.class);
            verify(eventPublisher).publishTaskCompleted(event.capture());
            assertThat(event.getValue().taskId()).isEqualTo(TASK_ID);
            assertThat(event.getValue().completedByUserId()).isEqualTo(Role.MANAGER.userId);
        }

        @Test
        @DisplayName("Manager duyệt: sau commit SSE TASK_STATUS_CHANGED tới người phụ trách và Owner (Manager không phải Owner)")
        void approve_notifiesAssigneeAndOwnerAfterCommit() {
            node.setStatus(NodeStatus.REVIEW);

            tx.executeWithoutResult(status -> {
                stateMachineService.updateStatus(TASK_ID, move(NodeStatus.DONE, null), Role.MANAGER.userId);
                verify(sseEmitterService, never()).sendToUser(any(), anyString(), any());
            });

            verify(sseEmitterService).sendToUser(eq(Role.ASSIGNEE.userId), eq("TASK_STATUS_CHANGED"), any());
            verify(sseEmitterService).sendToUser(eq(Role.OWNER.userId), eq("TASK_STATUS_CHANGED"), any());
        }

        @Test
        @DisplayName("Manager từ chối có lý do: lưu lý do, thông báo REJECTED cho người phụ trách")
        void reject_notifiesAssignee() {
            node.setStatus(NodeStatus.REVIEW);

            stateMachineService.updateStatus(TASK_ID, move(NodeStatus.IN_PROGRESS, "Thiếu test case"), Role.MANAGER.userId);

            assertThat(node.getRejectReason()).isEqualTo("Thiếu test case");
            ArgumentCaptor<NotificationEvent> notification = ArgumentCaptor.forClass(NotificationEvent.class);
            verify(eventPublisher).publishNotification(notification.capture());
            assertThat(notification.getValue().recipientUserId()).isEqualTo(Role.ASSIGNEE.userId);
            assertThat(notification.getValue().type()).isEqualTo("REJECTED");
        }

        @Test
        @DisplayName("Manager từ chối thiếu lý do → 400, không đổi trạng thái")
        void reject_withoutReason_badRequest() {
            node.setStatus(NodeStatus.REVIEW);

            assertThatThrownBy(() -> stateMachineService.updateStatus(
                    TASK_ID, move(NodeStatus.IN_PROGRESS, "  "), Role.MANAGER.userId))
                .isInstanceOf(IllegalArgumentException.class);
            assertThat(node.getStatus()).isEqualTo(NodeStatus.REVIEW);
            verify(nodeRepository, never()).save(any());
        }

        @Test
        @DisplayName("Manager nộp bài thay người phụ trách → 403")
        void submit_byManager_forbidden() {
            node.setStatus(NodeStatus.IN_PROGRESS);
            SubmitTaskArtifactRequest request = new SubmitTaskArtifactRequest(null, null, null, null, null, null, 0L);

            assertThatThrownBy(() -> stateMachineService.submitTaskArtifact(TASK_ID, request, Role.MANAGER.userId))
                .isInstanceOf(ForbiddenException.class);
            assertThat(node.getStatus()).isEqualTo(NodeStatus.IN_PROGRESS);
        }

        @Test
        @DisplayName("Manager mở khóa sớm → 403 (force unlock vẫn chỉ Owner)")
        void forceUnlock_byManager_forbidden() {
            node.setStatus(NodeStatus.LOCKED);

            assertThatThrownBy(() -> stateMachineService.forceUnlock(TASK_ID, Role.MANAGER.userId))
                .isInstanceOf(ForbiddenException.class);
            assertThat(node.getStatus()).isEqualTo(NodeStatus.LOCKED);
        }

        @Test
        @DisplayName("Manager duyệt bài trên dự án ARCHIVED → 409 PROJECT_ARCHIVED")
        void approve_archived_conflict() {
            project.setStatus(ProjectStatus.ARCHIVED);
            node.setStatus(NodeStatus.REVIEW);

            assertThatThrownBy(() -> stateMachineService.updateStatus(
                    TASK_ID, move(NodeStatus.DONE, null), Role.MANAGER.userId))
                .isInstanceOf(ConflictException.class)
                .extracting("errorCode").isEqualTo("PROJECT_ARCHIVED");
            verify(eventPublisher, never()).publishTaskCompleted(any());
        }
    }

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
        node.setStatus(NodeStatus.TODO);

        tx.executeWithoutResult(status -> {
            stateMachineService.updateStatus(TASK_ID, move(NodeStatus.IN_PROGRESS, null), Role.ASSIGNEE.userId);
            verify(sseEmitterService, never()).sendToUser(any(), anyString(), any());
        });

        verify(sseEmitterService).sendToUser(eq(Role.ASSIGNEE.userId), eq("TASK_STATUS_CHANGED"), any());
    }

    @Test
    @DisplayName("Transaction rollback: không gửi SSE nào")
    void updateStatus_rolledBack_noSse() {
        node.setStatus(NodeStatus.TODO);

        tx.executeWithoutResult(status -> {
            stateMachineService.updateStatus(TASK_ID, move(NodeStatus.IN_PROGRESS, null), Role.ASSIGNEE.userId);
            status.setRollbackOnly();
        });

        verify(sseEmitterService, never()).sendToUser(any(), anyString(), any());
    }

    @Test
    @DisplayName("Trong transaction: SSE TASK_UNLOCKED của force unlock chỉ gửi sau commit")
    void forceUnlock_sseWaitsForCommit() {
        node.setStatus(NodeStatus.LOCKED);

        tx.executeWithoutResult(status -> {
            stateMachineService.forceUnlock(TASK_ID, Role.OWNER.userId);
            verify(sseEmitterService, never()).sendToUser(any(), anyString(), any());
        });

        verify(sseEmitterService).sendToUser(eq(Role.ASSIGNEE.userId), eq("TASK_UNLOCKED"), any());
    }
}
