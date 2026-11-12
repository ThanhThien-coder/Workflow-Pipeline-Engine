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
    @DisplayName("FSM 1: TODO -> IN_PROGRESS bởi Assignee thành công")
    void testMoveTodoToInProgress_success() {
        when(nodeRepository.findById(taskId)).thenReturn(Optional.of(mockNode));
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(mockProject));
        when(nodeRepository.save(any(NodeEntity.class))).thenAnswer(i -> i.getArgument(0));
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
        when(nodeRepository.save(any(NodeEntity.class))).thenAnswer(i -> i.getArgument(0));
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
        when(nodeRepository.save(any(NodeEntity.class))).thenAnswer(i -> i.getArgument(0));
        when(nodeMapper.toKanbanTaskResponse(any())).thenReturn(mockResponse);

        UpdateNodeStatusRequest request = new UpdateNodeStatusRequest("DONE", null, 0L);
        stateMachineService.updateStatus(taskId, request, ownerId);

        assertThat(mockNode.getStatus()).isEqualTo(NodeStatus.DONE);
        verify(eventPublisher).publishTaskCompleted(any(TaskCompletedEvent.class));
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
            .hasMessageContaining("Chỉ Chủ dự án hoặc Quản lý");

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
        when(nodeRepository.save(any(NodeEntity.class))).thenAnswer(i -> i.getArgument(0));
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
        when(nodeRepository.save(any(NodeEntity.class))).thenAnswer(i -> i.getArgument(0));
        when(nodeMapper.toKanbanTaskResponse(any())).thenReturn(mockResponse);

        UpdateNodeStatusRequest request = new UpdateNodeStatusRequest("IN_PROGRESS", "example-reason: Cần làm lại", 0L);
        stateMachineService.updateStatus(taskId, request, managerId);

        assertThat(mockNode.getStatus()).isEqualTo(NodeStatus.IN_PROGRESS);
        assertThat(mockNode.getRejectReason()).isEqualTo("example-reason: Cần làm lại");
        verify(eventPublisher).publishNotification(any());
        verify(sseEmitterService).sendToUser(eq(collaboratorId), eq("TASK_REJECTED"), any());
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
            .hasMessageContaining("Bắt buộc phải nhập lý do từ chối");
    }

    @Test
    @DisplayName("FSM 6: REVIEW -> IN_PROGRESS với rejectReason đầy đủ lưu DB và đẩy SSE")
    void testMoveReviewToInProgress_withReason_success() {
        mockNode.setStatus(NodeStatus.REVIEW);

        when(nodeRepository.findById(taskId)).thenReturn(Optional.of(mockNode));
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(mockProject));
        when(nodeRepository.save(any(NodeEntity.class))).thenAnswer(i -> i.getArgument(0));
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
            .hasMessageContaining("Tác vụ đã bị thay đổi bởi thành viên khác");
    }

    @Test
    @DisplayName("Terminal State: Task đã DONE không được phép chuyển sang bất kỳ trạng thái nào")
    void testTerminalState_cannotMoveFromDone() {
        mockNode.setStatus(NodeStatus.DONE);

        when(nodeRepository.findById(taskId)).thenReturn(Optional.of(mockNode));

        UpdateNodeStatusRequest request = new UpdateNodeStatusRequest("TODO", null, 0L);

        assertThatThrownBy(() -> stateMachineService.updateStatus(taskId, request, ownerId))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Tác vụ đã hoàn tất và đóng băng");
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
            .hasMessageContaining("Tác vụ bắt buộc phải qua bước REVIEW trước khi nghiệm thu");
    }

    @Test
    @DisplayName("Force Unlock: Owner mở khóa cưỡng bức thành công từ LOCKED sang TODO")
    void testForceUnlock_byOwner_success() {
        mockNode.setStatus(NodeStatus.LOCKED);

        when(nodeRepository.findById(taskId)).thenReturn(Optional.of(mockNode));
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(mockProject));
        when(nodeRepository.save(any(NodeEntity.class))).thenAnswer(i -> i.getArgument(0));
        when(nodeMapper.toKanbanTaskResponse(any())).thenReturn(mockResponse);

        KanbanTaskResponse result = stateMachineService.forceUnlock(taskId, ownerId);

        assertThat(mockNode.getStatus()).isEqualTo(NodeStatus.TODO);
        verify(sseEmitterService).sendToUser(eq(collaboratorId), eq("TASK_UNLOCKED"), any());
    }

    @Test
    @DisplayName("Force Unlock: Collaborator không có quyền Force Unlock")
    void testForceUnlock_byCollaborator_forbidden() {
        mockNode.setStatus(NodeStatus.LOCKED);

        when(nodeRepository.findById(taskId)).thenReturn(Optional.of(mockNode));
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(mockProject));

        assertThatThrownBy(() -> stateMachineService.forceUnlock(taskId, collaboratorId))
            .isInstanceOf(ForbiddenException.class)
            .hasMessageContaining("Chỉ Chủ dự án (Project Owner) mới có quyền mở khóa cưỡng bức");
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
        when(nodeRepository.save(any(NodeEntity.class))).thenAnswer(i -> i.getArgument(0));
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
}
