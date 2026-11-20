package com.pipeline.wpe.service.engine;

import com.pipeline.wpe.common.enums.JoinPolicy;
import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.dto.event.TaskCompletedEvent;
import com.pipeline.wpe.dto.request.node.SubmitTaskArtifactRequest;
import com.pipeline.wpe.dto.request.node.UpdateNodeStatusRequest;
import com.pipeline.wpe.dto.response.node.KanbanTaskResponse;
import com.pipeline.wpe.dto.response.node.SubmitTaskArtifactResponse;
import com.pipeline.wpe.entity.ArtifactEntity;
import com.pipeline.wpe.entity.NodeDependencyEntity;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.ProjectMemberEntity;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.mapper.NodeMapper;
import com.pipeline.wpe.repository.ArtifactRepository;
import com.pipeline.wpe.repository.NodeDependencyRepository;
import com.pipeline.wpe.repository.NodeRepository;
import com.pipeline.wpe.repository.ProjectMemberRepository;
import com.pipeline.wpe.repository.ProjectRepository;
import com.pipeline.wpe.service.event.ProjectRealtimeNotifier;
import com.pipeline.wpe.service.event.SseEmitterService;
import com.pipeline.wpe.service.event.WorkflowEventPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.OptimisticLockingFailureException;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StateMachineServiceTest {

    @Mock
    private NodeRepository nodeRepository;

    @Mock
    private NodeDependencyRepository dependencyRepository;

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private ProjectMemberRepository projectMemberRepository;

    @Mock
    private ArtifactRepository artifactRepository;

    @Mock
    private WorkflowEventPublisher eventPublisher;

    @Mock
    private SseEmitterService sseEmitterService;

    @Mock
    private ProjectRealtimeNotifier projectRealtimeNotifier;

    @Mock
    private NodeMapper nodeMapper;

    @InjectMocks
    private StateMachineService stateMachineService;

    private ProjectEntity mockProject;
    private NodeEntity mockNode;
    private KanbanTaskResponse mockResponse;

    private final Long ownerId = 2L;
    private final Long collaboratorId = 3L;
    private final Long projectId = 1L;
    private final Long taskId = 10L;

    @BeforeEach
    void setUp() {
        mockProject = ProjectEntity.builder()
            .id(projectId)
            .ownerId(ownerId)
            .name("Core Banking Pipeline")
            .status(com.pipeline.wpe.common.enums.ProjectStatus.ACTIVE)
            .build();

        mockNode = NodeEntity.builder()
            .id(taskId)
            .projectId(projectId)
            .code("WPE-010")
            .title("Test Task")
            .status(NodeStatus.TODO)
            .assignedUserId(collaboratorId)
            .joinPolicy(JoinPolicy.ALL_COMPLETED)
            .version(0L)
            .uiMetadata(Map.of())
            .build();

        mockResponse = new KanbanTaskResponse(
            "10", "1", "WPE-010", "Test Task", "Desc", "TODO",
            "3", "ALL_COMPLETED", null, Instant.now(), false, 0L, Map.of()
        );
    }

    @Test
    @DisplayName("S07: Viewer được giao task vẫn không đổi được trạng thái -> 403 ACCESS_DENIED, không lưu")
    void testViewerCannotUpdateStatus() {
        when(nodeRepository.findById(taskId)).thenReturn(Optional.of(mockNode));
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(mockProject));
        when(projectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull(projectId, collaboratorId))
            .thenReturn(Optional.of(ProjectMemberEntity.builder().projectId(projectId).userId(collaboratorId).role(ProjectRole.VIEWER).build()));

        assertThatThrownBy(() -> stateMachineService.updateStatus(taskId, new UpdateNodeStatusRequest("IN_PROGRESS", null, 0L), collaboratorId))
            .isInstanceOf(ForbiddenException.class)
            .hasMessageContaining("Viewers can't change task status");
        verify(nodeRepository, never()).saveAndFlush(any(NodeEntity.class));
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.EnumSource(value = com.pipeline.wpe.common.enums.ProjectStatus.class, names = {"DRAFT", "PLANNING", "PAUSED", "COMPLETED"})
    @DisplayName("Dự án chưa chạy (không ACTIVE): Cộng tác viên không đổi trạng thái task -> 409 PROJECT_NOT_ACTIVE, không lưu")
    void testCollaboratorBlockedWhenProjectNotActive(com.pipeline.wpe.common.enums.ProjectStatus status) {
        mockProject.setStatus(status);
        when(nodeRepository.findById(taskId)).thenReturn(Optional.of(mockNode));
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(mockProject));

        assertThatThrownBy(() -> stateMachineService.updateStatus(taskId, new UpdateNodeStatusRequest("IN_PROGRESS", null, 0L), collaboratorId))
            .isInstanceOfSatisfying(com.pipeline.wpe.exception.ConflictException.class,
                e -> assertThat(e.getErrorCode()).isEqualTo("PROJECT_NOT_ACTIVE"));
        verify(nodeRepository, never()).saveAndFlush(any(NodeEntity.class));
    }

    @Test
    @DisplayName("Dự án DRAFT: Quản lý vẫn làm task bình thường (cùng quyền với chủ dự án)")
    void testManagerWorksWhenProjectDraft() {
        mockProject.setStatus(com.pipeline.wpe.common.enums.ProjectStatus.DRAFT);
        when(nodeRepository.findById(taskId)).thenReturn(Optional.of(mockNode));
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(mockProject));
        when(projectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull(projectId, collaboratorId))
            .thenReturn(Optional.of(ProjectMemberEntity.builder().projectId(projectId).userId(collaboratorId).role(ProjectRole.MANAGER).build()));
        when(nodeRepository.saveAndFlush(any(NodeEntity.class))).thenAnswer(i -> i.getArgument(0));
        when(nodeMapper.toKanbanTaskResponse(any())).thenReturn(mockResponse);

        stateMachineService.updateStatus(taskId, new UpdateNodeStatusRequest("IN_PROGRESS", null, 0L), collaboratorId);

        assertThat(mockNode.getStatus()).isEqualTo(NodeStatus.IN_PROGRESS);
    }

    @Test
    @DisplayName("Dự án PAUSED: chủ dự án vẫn làm task bình thường")
    void testOwnerWorksWhenProjectPaused() {
        mockProject.setStatus(com.pipeline.wpe.common.enums.ProjectStatus.PAUSED);
        mockNode.setAssignedUserId(ownerId);
        when(nodeRepository.findById(taskId)).thenReturn(Optional.of(mockNode));
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(mockProject));
        when(nodeRepository.saveAndFlush(any(NodeEntity.class))).thenAnswer(i -> i.getArgument(0));
        when(nodeMapper.toKanbanTaskResponse(any())).thenReturn(mockResponse);

        stateMachineService.updateStatus(taskId, new UpdateNodeStatusRequest("IN_PROGRESS", null, 0L), ownerId);

        assertThat(mockNode.getStatus()).isEqualTo(NodeStatus.IN_PROGRESS);
    }

    @Test
    @DisplayName("FSM 1: TODO -> IN_PROGRESS bởi Assignee thành công")
    void testMoveTodoToInProgress_success() {
        when(nodeRepository.findById(taskId)).thenReturn(Optional.of(mockNode));
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(mockProject));
        when(nodeRepository.saveAndFlush(any(NodeEntity.class))).thenAnswer(i -> i.getArgument(0));
        when(nodeMapper.toKanbanTaskResponse(any())).thenReturn(mockResponse);

        UpdateNodeStatusRequest request = new UpdateNodeStatusRequest("IN_PROGRESS", null, 0L);
        KanbanTaskResponse result = stateMachineService.updateStatus(taskId, request, collaboratorId);

        assertThat(mockNode.getStatus()).isEqualTo(NodeStatus.IN_PROGRESS);
        assertThat(mockNode.getStartedAt()).isNotNull();
        verify(sseEmitterService).sendToUser(eq(collaboratorId), eq("TASK_STATUS_CHANGED"), any());
    }

    @Test
    @DisplayName("FSM 2: IN_PROGRESS -> TODO (Hủy làm việc) thành công")
    void testMoveInProgressToTodo_success() {
        mockNode.setStatus(NodeStatus.IN_PROGRESS);
        mockNode.setStartedAt(Instant.now());

        when(nodeRepository.findById(taskId)).thenReturn(Optional.of(mockNode));
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(mockProject));
        when(nodeRepository.saveAndFlush(any(NodeEntity.class))).thenAnswer(i -> i.getArgument(0));
        when(nodeMapper.toKanbanTaskResponse(any())).thenReturn(mockResponse);

        UpdateNodeStatusRequest request = new UpdateNodeStatusRequest("TODO", null, 0L);
        stateMachineService.updateStatus(taskId, request, collaboratorId);

        assertThat(mockNode.getStatus()).isEqualTo(NodeStatus.TODO);
        assertThat(mockNode.getStartedAt()).isNull();
    }

    @Test
    @DisplayName("FSM 3: REVIEW -> DONE chỉ cho phép OWNER và kích hoạt RabbitMQ")
    void testMoveReviewToDone_byOwner_success() {
        mockNode.setStatus(NodeStatus.REVIEW);

        when(nodeRepository.findById(taskId)).thenReturn(Optional.of(mockNode));
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(mockProject));
        when(nodeRepository.saveAndFlush(any(NodeEntity.class))).thenAnswer(i -> i.getArgument(0));
        when(nodeMapper.toKanbanTaskResponse(any())).thenReturn(mockResponse);

        UpdateNodeStatusRequest request = new UpdateNodeStatusRequest("DONE", null, 0L);
        stateMachineService.updateStatus(taskId, request, ownerId);

        assertThat(mockNode.getStatus()).isEqualTo(NodeStatus.DONE);
        assertThat(mockNode.getCompletedAt()).isNotNull();
        verify(eventPublisher).publishTaskCompleted(any(TaskCompletedEvent.class));
        verify(projectRealtimeNotifier).notifyTasksChanged(projectId, mockNode.getPhaseId(), taskId, "STATUS_CHANGED", ownerId);
    }

    @Test
    @DisplayName("FSM 4: REVIEW -> DONE bị chặn 403 Forbidden nếu gọi bởi Collaborator")
    void testMoveReviewToDone_byCollaborator_forbidden() {
        mockNode.setStatus(NodeStatus.REVIEW);

        when(nodeRepository.findById(taskId)).thenReturn(Optional.of(mockNode));
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(mockProject));
        when(projectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull(projectId, collaboratorId))
            .thenReturn(Optional.of(ProjectMemberEntity.builder().projectId(projectId).userId(collaboratorId).role(ProjectRole.COLLABORATOR).build()));

        UpdateNodeStatusRequest request = new UpdateNodeStatusRequest("DONE", null, 0L);

        assertThatThrownBy(() -> stateMachineService.updateStatus(taskId, request, collaboratorId))
            .isInstanceOf(ForbiddenException.class)
            .hasMessageContaining("Only the project owner or a manager");

        assertThat(mockNode.getCompletedAt()).isNull();
        verify(eventPublisher, never()).publishTaskCompleted(any());
    }

    @Test
    @DisplayName("FSM 4b: REVIEW -> DONE cho phép MANAGER duyệt thành công và kích hoạt RabbitMQ")
    void testMoveReviewToDone_byManager_success() {
        Long managerId = 4L;
        mockNode.setStatus(NodeStatus.REVIEW);

        when(nodeRepository.findById(taskId)).thenReturn(Optional.of(mockNode));
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(mockProject));
        when(projectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull(projectId, managerId))
            .thenReturn(Optional.of(ProjectMemberEntity.builder().projectId(projectId).userId(managerId).role(ProjectRole.MANAGER).build()));
        when(nodeRepository.saveAndFlush(any(NodeEntity.class))).thenAnswer(i -> i.getArgument(0));
        when(nodeMapper.toKanbanTaskResponse(any())).thenReturn(mockResponse);

        UpdateNodeStatusRequest request = new UpdateNodeStatusRequest("DONE", null, 0L);
        stateMachineService.updateStatus(taskId, request, managerId);

        assertThat(mockNode.getStatus()).isEqualTo(NodeStatus.DONE);
        verify(eventPublisher).publishTaskCompleted(any(TaskCompletedEvent.class));
    }

    @Test
    @DisplayName("FSM 6b: REVIEW -> IN_PROGRESS cho phép MANAGER trả lại kèm lý do thành công")
    void testMoveReviewToInProgress_byManager_success() {
        Long managerId = 4L;
        mockNode.setStatus(NodeStatus.REVIEW);

        when(nodeRepository.findById(taskId)).thenReturn(Optional.of(mockNode));
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(mockProject));
        when(projectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull(projectId, managerId))
            .thenReturn(Optional.of(ProjectMemberEntity.builder().projectId(projectId).userId(managerId).role(ProjectRole.MANAGER).build()));
        when(nodeRepository.saveAndFlush(any(NodeEntity.class))).thenAnswer(i -> i.getArgument(0));
        when(nodeMapper.toKanbanTaskResponse(any())).thenReturn(mockResponse);

        UpdateNodeStatusRequest request = new UpdateNodeStatusRequest("IN_PROGRESS", "example-reason: Cần làm lại", 0L);
        stateMachineService.updateStatus(taskId, request, managerId);

        assertThat(mockNode.getStatus()).isEqualTo(NodeStatus.IN_PROGRESS);
        assertThat(mockNode.getRejectReason()).isEqualTo("example-reason: Cần làm lại");
        verify(eventPublisher).publishNotification(any());
        verify(sseEmitterService).sendToUser(eq(collaboratorId), eq("TASK_REJECTED"), any());
    }

    @Test
    @DisplayName("updateStatus: dùng saveAndFlush và response nhận version mới từ entity đã flush")
    void testUpdateStatus_usesSaveAndFlush_andReturnsNewVersion() {
        mockNode.setVersion(1L);
        NodeEntity flushedNode = NodeEntity.builder()
            .id(taskId)
            .projectId(projectId)
            .status(NodeStatus.IN_PROGRESS)
            .version(2L)
            .uiMetadata(Map.of())
            .build();
        KanbanTaskResponse flushedResponse = new KanbanTaskResponse(
            "10", "1", "WPE-010", "Test Task", "Desc", "IN_PROGRESS",
            "3", "ALL_COMPLETED", null, Instant.now(), false, 2L, Map.of()
        );

        when(nodeRepository.findById(taskId)).thenReturn(Optional.of(mockNode));
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(mockProject));
        when(nodeRepository.saveAndFlush(mockNode)).thenReturn(flushedNode);
        when(nodeMapper.toKanbanTaskResponse(flushedNode)).thenReturn(flushedResponse);

        UpdateNodeStatusRequest request = new UpdateNodeStatusRequest("IN_PROGRESS", null, 1L);
        KanbanTaskResponse result = stateMachineService.updateStatus(taskId, request, collaboratorId);

        verify(nodeRepository).saveAndFlush(mockNode);
        assertThat(result.version()).isEqualTo(2L);
    }

    @Test
    @DisplayName("FSM 5: REVIEW -> IN_PROGRESS (Từ chối nghiệm thu) bắt buộc nhập rejectReason")
    void testMoveReviewToInProgress_withoutReason_throwsException() {
        mockNode.setStatus(NodeStatus.REVIEW);

        when(nodeRepository.findById(taskId)).thenReturn(Optional.of(mockNode));
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(mockProject));

        UpdateNodeStatusRequest request = new UpdateNodeStatusRequest("IN_PROGRESS", "   ", 0L);

        assertThatThrownBy(() -> stateMachineService.updateStatus(taskId, request, ownerId))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("A rejection reason (rejectReason) is required");
    }

    @Test
    @DisplayName("FSM 6: REVIEW -> IN_PROGRESS với rejectReason đầy đủ lưu DB và đẩy SSE")
    void testMoveReviewToInProgress_withReason_success() {
        mockNode.setStatus(NodeStatus.REVIEW);

        when(nodeRepository.findById(taskId)).thenReturn(Optional.of(mockNode));
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(mockProject));
        when(nodeRepository.saveAndFlush(any(NodeEntity.class))).thenAnswer(i -> i.getArgument(0));
        when(nodeMapper.toKanbanTaskResponse(any())).thenReturn(mockResponse);

        UpdateNodeStatusRequest request = new UpdateNodeStatusRequest("IN_PROGRESS", "Thiếu test case", 0L);
        stateMachineService.updateStatus(taskId, request, ownerId);

        assertThat(mockNode.getStatus()).isEqualTo(NodeStatus.IN_PROGRESS);
        assertThat(mockNode.getRejectReason()).isEqualTo("Thiếu test case");
        verify(eventPublisher).publishNotification(any());
        verify(sseEmitterService).sendToUser(eq(collaboratorId), eq("TASK_REJECTED"), any());
    }

    @Test
    @DisplayName("Khóa lạc quan: Bắn lỗi 409 OptimisticLockingFailureException khi version không khớp")
    void testOptimisticLocking_versionMismatch() {
        mockNode.setVersion(2L); // Trong DB đã lên version 2

        when(nodeRepository.findById(taskId)).thenReturn(Optional.of(mockNode));

        UpdateNodeStatusRequest request = new UpdateNodeStatusRequest("IN_PROGRESS", null, 0L); // Gửi version 0

        assertThatThrownBy(() -> stateMachineService.updateStatus(taskId, request, collaboratorId))
            .isInstanceOf(OptimisticLockingFailureException.class)
            .hasMessageContaining("This task was changed by another member");
    }

    @Test
    @DisplayName("Terminal State: Task đã DONE không được phép chuyển sang bất kỳ trạng thái nào")
    void testTerminalState_cannotMoveFromDone() {
        mockNode.setStatus(NodeStatus.DONE);

        when(nodeRepository.findById(taskId)).thenReturn(Optional.of(mockNode));

        UpdateNodeStatusRequest request = new UpdateNodeStatusRequest("TODO", null, 0L);

        assertThatThrownBy(() -> stateMachineService.updateStatus(taskId, request, ownerId))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("This task is done and frozen");
    }

    @Test
    @DisplayName("Chặn nhảy cóc: Không cho phép TODO nhảy thẳng lên DONE")
    void testSkipSteps_todoToDone_throwsException() {
        mockNode.setStatus(NodeStatus.TODO);

        when(nodeRepository.findById(taskId)).thenReturn(Optional.of(mockNode));
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(mockProject));

        UpdateNodeStatusRequest request = new UpdateNodeStatusRequest("DONE", null, 0L);

        assertThatThrownBy(() -> stateMachineService.updateStatus(taskId, request, ownerId))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("A task must go through REVIEW before it can be completed");
    }

    @Test
    @DisplayName("Force Unlock: Owner mở khóa cưỡng bức thành công từ LOCKED sang TODO")
    void testForceUnlock_byOwner_success() {
        mockNode.setStatus(NodeStatus.LOCKED);

        when(nodeRepository.findById(taskId)).thenReturn(Optional.of(mockNode));
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(mockProject));
        when(nodeRepository.saveAndFlush(any(NodeEntity.class))).thenAnswer(i -> i.getArgument(0));
        when(nodeMapper.toKanbanTaskResponse(any())).thenReturn(mockResponse);

        KanbanTaskResponse result = stateMachineService.forceUnlock(taskId, ownerId);

        assertThat(mockNode.getStatus()).isEqualTo(NodeStatus.TODO);
        verify(sseEmitterService).sendToUser(eq(collaboratorId), eq("TASK_UNLOCKED"), any());
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.EnumSource(value = com.pipeline.wpe.common.enums.ProjectStatus.class, names = {"DRAFT", "PLANNING"})
    @DisplayName("Force Unlock: dự án chưa Start (DRAFT/PLANNING) thì báo PROJECT_NOT_STARTED, task vẫn LOCKED (G33)")
    void testForceUnlock_projectNotStarted_rejected(com.pipeline.wpe.common.enums.ProjectStatus status) {
        mockNode.setStatus(NodeStatus.LOCKED);
        mockProject.setStatus(status);

        when(nodeRepository.findById(taskId)).thenReturn(Optional.of(mockNode));
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(mockProject));

        assertThatThrownBy(() -> stateMachineService.forceUnlock(taskId, ownerId))
            .isInstanceOf(com.pipeline.wpe.exception.ConflictException.class)
            .hasMessageContaining("Start the project before unlocking tasks early");
        assertThat(mockNode.getStatus()).isEqualTo(NodeStatus.LOCKED);
        verify(nodeRepository, org.mockito.Mockito.never()).saveAndFlush(any(NodeEntity.class));
    }

    @Test
    @DisplayName("Force Unlock: Collaborator không có quyền Force Unlock")
    void testForceUnlock_byCollaborator_forbidden() {
        mockNode.setStatus(NodeStatus.LOCKED);

        when(nodeRepository.findById(taskId)).thenReturn(Optional.of(mockNode));
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(mockProject));

        assertThatThrownBy(() -> stateMachineService.forceUnlock(taskId, collaboratorId))
            .isInstanceOf(ForbiddenException.class)
            .hasMessageContaining("Only the project owner or a manager can force unlock a task");
    }

    @Test
    @DisplayName("Động cơ AND-Join: Mở khóa con khi 100% cha đều DONE")
    void testUnlockDownstreamTasks_allCompleted_unlocksWhenAllParentsDone() {
        Long parent1 = 1L;
        Long parent2 = 2L;
        Long childId = 3L;

        NodeDependencyEntity dep1 = NodeDependencyEntity.builder().parentNodeId(parent1).childNodeId(childId).build();
        NodeDependencyEntity dep2 = NodeDependencyEntity.builder().parentNodeId(parent2).childNodeId(childId).build();

        NodeEntity childNode = NodeEntity.builder()
            .id(childId)
            .status(NodeStatus.LOCKED)
            .joinPolicy(JoinPolicy.ALL_COMPLETED)
            .assignedUserId(collaboratorId)
            .code("CHILD-01")
            .build();

        NodeEntity parentNode1 = NodeEntity.builder().id(parent1).status(NodeStatus.DONE).build();
        NodeEntity parentNode2 = NodeEntity.builder().id(parent2).status(NodeStatus.DONE).build();

        when(dependencyRepository.findByParentNodeId(parent1)).thenReturn(List.of(dep1));
        when(nodeRepository.findById(childId)).thenReturn(Optional.of(childNode));
        when(dependencyRepository.findByChildNodeId(childId)).thenReturn(List.of(dep1, dep2));
        when(nodeRepository.findById(parent1)).thenReturn(Optional.of(parentNode1));
        when(nodeRepository.findById(parent2)).thenReturn(Optional.of(parentNode2));
        when(nodeRepository.save(any(NodeEntity.class))).thenAnswer(i -> i.getArgument(0));
        when(nodeMapper.toKanbanTaskResponse(any())).thenReturn(mockResponse);

        stateMachineService.unlockDownstreamTasks(parent1);

        assertThat(childNode.getStatus()).isEqualTo(NodeStatus.TODO);
        verify(sseEmitterService).sendToUser(eq(collaboratorId), eq("TASK_UNLOCKED"), any());
    }

    @Test
    @DisplayName("Động cơ AND-Join: Giữ nguyên LOCKED nếu còn ít nhất 1 cha chưa DONE")
    void testUnlockDownstreamTasks_allCompleted_staysLockedWhenOneParentNotDone() {
        Long parent1 = 1L;
        Long parent2 = 2L;
        Long childId = 3L;

        NodeDependencyEntity dep1 = NodeDependencyEntity.builder().parentNodeId(parent1).childNodeId(childId).build();
        NodeDependencyEntity dep2 = NodeDependencyEntity.builder().parentNodeId(parent2).childNodeId(childId).build();

        NodeEntity childNode = NodeEntity.builder()
            .id(childId)
            .status(NodeStatus.LOCKED)
            .joinPolicy(JoinPolicy.ALL_COMPLETED)
            .assignedUserId(collaboratorId)
            .build();

        NodeEntity parentNode1 = NodeEntity.builder().id(parent1).status(NodeStatus.DONE).build();
        NodeEntity parentNode2 = NodeEntity.builder().id(parent2).status(NodeStatus.IN_PROGRESS).build();

        when(dependencyRepository.findByParentNodeId(parent1)).thenReturn(List.of(dep1));
        when(nodeRepository.findById(childId)).thenReturn(Optional.of(childNode));
        when(dependencyRepository.findByChildNodeId(childId)).thenReturn(List.of(dep1, dep2));
        when(nodeRepository.findById(parent1)).thenReturn(Optional.of(parentNode1));
        when(nodeRepository.findById(parent2)).thenReturn(Optional.of(parentNode2));

        stateMachineService.unlockDownstreamTasks(parent1);

        assertThat(childNode.getStatus()).isEqualTo(NodeStatus.LOCKED);
        verify(nodeRepository, never()).save(any());
        verify(sseEmitterService, never()).sendToUser(any(), any(), any());
    }

    @Test
    @DisplayName("Động cơ OR-Join: Mở khóa con ngay khi có ít nhất 1 cha DONE")
    void testUnlockDownstreamTasks_anyCompleted_unlocksWhenAtLeastOneParentDone() {
        Long parent1 = 1L;
        Long parent2 = 2L;
        Long childId = 3L;

        NodeDependencyEntity dep1 = NodeDependencyEntity.builder().parentNodeId(parent1).childNodeId(childId).build();
        NodeDependencyEntity dep2 = NodeDependencyEntity.builder().parentNodeId(parent2).childNodeId(childId).build();

        NodeEntity childNode = NodeEntity.builder()
            .id(childId)
            .status(NodeStatus.LOCKED)
            .joinPolicy(JoinPolicy.ANY_COMPLETED)
            .assignedUserId(collaboratorId)
            .code("CHILD-OR")
            .build();

        NodeEntity parentNode1 = NodeEntity.builder().id(parent1).status(NodeStatus.DONE).build();
        NodeEntity parentNode2 = NodeEntity.builder().id(parent2).status(NodeStatus.TODO).build();

        when(dependencyRepository.findByParentNodeId(parent1)).thenReturn(List.of(dep1));
        when(nodeRepository.findById(childId)).thenReturn(Optional.of(childNode));
        when(dependencyRepository.findByChildNodeId(childId)).thenReturn(List.of(dep1, dep2));
        when(nodeRepository.findById(parent1)).thenReturn(Optional.of(parentNode1));
        when(nodeRepository.save(any(NodeEntity.class))).thenAnswer(i -> i.getArgument(0));
        when(nodeMapper.toKanbanTaskResponse(any())).thenReturn(mockResponse);

        stateMachineService.unlockDownstreamTasks(parent1);

        assertThat(childNode.getStatus()).isEqualTo(NodeStatus.TODO);
        verify(sseEmitterService).sendToUser(eq(collaboratorId), eq("TASK_UNLOCKED"), any());
    }

    @Test
    @DisplayName("Nộp bài kèm Artifact: Chuyển sang REVIEW và lưu Artifact Entity")
    void testSubmitTaskArtifact_success() {
        mockNode.setStatus(NodeStatus.IN_PROGRESS);

        when(nodeRepository.findById(taskId)).thenReturn(Optional.of(mockNode));
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(mockProject));
        when(nodeRepository.saveAndFlush(any(NodeEntity.class))).thenAnswer(i -> i.getArgument(0));
        when(nodeMapper.toKanbanTaskResponse(any())).thenReturn(mockResponse);

        ArtifactEntity savedArtifact = ArtifactEntity.builder()
            .id(100L)
            .projectId(projectId)
            .nodeId(taskId)
            .name("PR #42")
            .type(com.pipeline.wpe.common.enums.ArtifactType.PR)
            .url("https://github.com/org/repo/pull/42")
            .createdAt(Instant.now())
            .build();
        when(artifactRepository.save(any(ArtifactEntity.class))).thenReturn(savedArtifact);

        SubmitTaskArtifactRequest request = new SubmitTaskArtifactRequest(
            "10", "PR", "https://github.com/org/repo/pull/42", "Fix bug", "PR #42", null, 0L
        );

        SubmitTaskArtifactResponse response = stateMachineService.submitTaskArtifact(taskId, request, collaboratorId);

        assertThat(mockNode.getStatus()).isEqualTo(NodeStatus.REVIEW);
        assertThat(response.artifact()).isNotNull();
        assertThat(response.artifact().url()).isEqualTo("https://github.com/org/repo/pull/42");
        verify(sseEmitterService).sendToUser(eq(ownerId), eq("TASK_SUBMITTED"), any());
    }

    @Test
    @DisplayName("T4 getPhaseTasks: trả mọi task của phase (kể cả LOCKED, chưa giao) kèm artifact; bỏ task dự án khác")
    void testGetPhaseTasks_allTasksOfPhase() {
        NodeEntity locked = NodeEntity.builder().id(11L).projectId(projectId).phaseId(5L).code("WPE-011")
            .title("Khóa").status(NodeStatus.LOCKED).assignedUserId(null).version(0L).uiMetadata(Map.of()).build();
        NodeEntity otherProject = NodeEntity.builder().id(12L).projectId(99L).phaseId(5L).code("X")
            .title("Dự án khác").status(NodeStatus.TODO).version(0L).uiMetadata(Map.of()).build();
        when(nodeRepository.findByPhaseId(5L)).thenReturn(List.of(mockNode, locked, otherProject));
        KanbanTaskResponse lockedResponse = new KanbanTaskResponse(
            "11", "5", "WPE-011", "Khóa", null, "LOCKED", null, "ALL_COMPLETED", null, null, false, 0L, Map.of());
        when(nodeMapper.toKanbanTaskResponse(mockNode)).thenReturn(mockResponse);
        when(nodeMapper.toKanbanTaskResponse(locked)).thenReturn(lockedResponse);
        when(artifactRepository.findByNodeIdIn(any())).thenReturn(List.of());

        List<KanbanTaskResponse> tasks = stateMachineService.getPhaseTasks(projectId, 5L);

        assertThat(tasks).extracting(KanbanTaskResponse::id).containsExactly("10", "11");
        assertThat(tasks).extracting(KanbanTaskResponse::status).containsExactly("TODO", "LOCKED");
        assertThat(tasks.get(1).assignedUserId()).isNull();
        verify(nodeMapper, never()).toKanbanTaskResponse(otherProject);
    }

    @Test
    @DisplayName("G15 getMyTasks: gồm cả task LOCKED của người đó (cột Đang khóa)")
    void testGetMyTasks_includesLocked() {
        NodeEntity locked = NodeEntity.builder().id(11L).projectId(projectId).phaseId(5L).code("WPE-011")
            .title("Khóa").status(NodeStatus.LOCKED).assignedUserId(collaboratorId).version(0L).uiMetadata(Map.of()).build();
        when(nodeRepository.findByProjectIdAndAssignedUserIdOrderByDueDateAsc(projectId, collaboratorId))
            .thenReturn(List.of(mockNode, locked));
        when(nodeMapper.toKanbanTaskResponse(mockNode)).thenReturn(mockResponse);
        when(nodeMapper.toKanbanTaskResponse(locked)).thenReturn(new KanbanTaskResponse(
            "11", "5", "WPE-011", "Khóa", null, "LOCKED", String.valueOf(collaboratorId), "ALL_COMPLETED", null, null, false, 0L, Map.of()));
        when(artifactRepository.findByNodeIdIn(any())).thenReturn(List.of());

        List<KanbanTaskResponse> tasks = stateMachineService.getMyTasks(projectId, collaboratorId);

        assertThat(tasks).extracting(KanbanTaskResponse::status).containsExactly("TODO", "LOCKED");
    }

    @Test
    @DisplayName("G18 getReviewTasks: mọi task REVIEW của dự án, sắp theo id")
    void testGetReviewTasks_sortedById() {
        NodeEntity r2 = NodeEntity.builder().id(30L).projectId(projectId).code("WPE-030").title("B")
            .status(NodeStatus.REVIEW).version(0L).uiMetadata(Map.of()).build();
        NodeEntity r1 = NodeEntity.builder().id(20L).projectId(projectId).code("WPE-020").title("A")
            .status(NodeStatus.REVIEW).version(0L).uiMetadata(Map.of()).build();
        when(nodeRepository.findByProjectIdAndStatus(projectId, NodeStatus.REVIEW)).thenReturn(List.of(r2, r1));
        when(nodeMapper.toKanbanTaskResponse(r1)).thenReturn(new KanbanTaskResponse(
            "20", "5", "WPE-020", "A", null, "REVIEW", null, "ALL_COMPLETED", null, null, false, 0L, Map.of()));
        when(nodeMapper.toKanbanTaskResponse(r2)).thenReturn(new KanbanTaskResponse(
            "30", "5", "WPE-030", "B", null, "REVIEW", null, "ALL_COMPLETED", null, null, false, 0L, Map.of()));
        when(artifactRepository.findByNodeIdIn(any())).thenReturn(List.of());

        assertThat(stateMachineService.getReviewTasks(projectId))
            .extracting(KanbanTaskResponse::id).containsExactly("20", "30");
    }

    @Test
    @DisplayName("S03 getPhaseTasks: artifact lấy 1 lần (findByNodeIdIn), nhóm đúng theo task, không gọi findByNodeId")
    void testGetPhaseTasks_artifactsFetchedOnce() {
        NodeEntity second = NodeEntity.builder().id(11L).projectId(projectId).phaseId(5L).code("WPE-011")
            .title("Hai").status(NodeStatus.TODO).version(0L).uiMetadata(Map.of()).build();
        when(nodeRepository.findByPhaseId(5L)).thenReturn(List.of(second, mockNode));
        when(nodeMapper.toKanbanTaskResponse(mockNode)).thenReturn(mockResponse);
        when(nodeMapper.toKanbanTaskResponse(second)).thenReturn(new KanbanTaskResponse(
            "11", "5", "WPE-011", "Hai", null, "TODO", null, "ALL_COMPLETED", null, null, false, 0L, Map.of()));
        ArtifactEntity a1 = ArtifactEntity.builder().id(1L).nodeId(10L).name("A1")
            .type(com.pipeline.wpe.common.enums.ArtifactType.PR).url("u1").createdAt(Instant.now()).build();
        ArtifactEntity a2 = ArtifactEntity.builder().id(2L).nodeId(10L).name("A2")
            .type(com.pipeline.wpe.common.enums.ArtifactType.PR).url("u2").createdAt(Instant.now()).build();
        when(artifactRepository.findByNodeIdIn(any())).thenReturn(List.of(a1, a2));

        List<KanbanTaskResponse> tasks = stateMachineService.getPhaseTasks(projectId, 5L);

        assertThat(tasks).extracting(KanbanTaskResponse::id).containsExactly("10", "11");
        assertThat(tasks.get(0).artifacts()).hasSize(2);
        assertThat(tasks.get(1).artifacts()).isEmpty();
        verify(artifactRepository, times(1)).findByNodeIdIn(any());
        verify(artifactRepository, never()).findByNodeId(anyLong());
    }
}
