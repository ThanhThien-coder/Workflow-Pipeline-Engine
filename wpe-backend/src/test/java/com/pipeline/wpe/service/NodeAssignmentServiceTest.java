package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.common.enums.ProjectStatus;
import com.pipeline.wpe.dto.request.node.UpdateNodeAssignmentRequest;
import com.pipeline.wpe.dto.response.graph.GraphNodeResponse;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.exception.ConflictException;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.NodeRepository;
import com.pipeline.wpe.repository.ProjectMemberRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.OptimisticLockingFailureException;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NodeAssignmentServiceTest {

    @Mock
    private NodeRepository nodeRepository;

    @Mock
    private ProjectMemberRepository projectMemberRepository;

    @Mock
    private ProjectAuthorizationService authorizationService;

    @InjectMocks
    private NodeAssignmentService nodeAssignmentService;

    private NodeEntity mockNode;
    private ProjectEntity mockProject;

    private final Long projectId = 1L;
    private final Long nodeId = 100L;
    private final Long ownerId = 10L;
    private final Long managerId = 20L;
    private final Long collaboratorId = 30L;
    private final Long newAssigneeId = 40L;

    @BeforeEach
    void setUp() {
        mockProject = ProjectEntity.builder()
            .id(projectId)
            .ownerId(ownerId)
            .status(ProjectStatus.ACTIVE)
            .name("example-project")
            .build();

        mockNode = NodeEntity.builder()
            .id(nodeId)
            .projectId(projectId)
            .code("example-node-100")
            .title("example-title")
            .description("example-desc")
            .status(NodeStatus.TODO)
            .version(1L)
            .isOverdue(true)
            .uiMetadata(Map.of())
            .build();
    }

    @Test
    @DisplayName("updateAssignment: Manager đổi người làm thành công")
    void testUpdateAssignment_byManager_success() {
        when(nodeRepository.findById(nodeId)).thenReturn(Optional.of(mockNode));
        when(authorizationService.verifyProjectOwnerOrManager(projectId, managerId)).thenReturn(mockProject);
        when(projectMemberRepository.existsByProjectIdAndUserIdAndRemovedAtIsNull(projectId, newAssigneeId)).thenReturn(true);
        when(nodeRepository.save(any(NodeEntity.class))).thenAnswer(i -> i.getArgument(0));

        UpdateNodeAssignmentRequest request = new UpdateNodeAssignmentRequest(newAssigneeId, null, 1L);
        GraphNodeResponse response = nodeAssignmentService.updateAssignment(nodeId, request, managerId);

        assertThat(response.assignedUserId()).isEqualTo(String.valueOf(newAssigneeId));
        assertThat(mockNode.getAssignedUserId()).isEqualTo(newAssigneeId);
    }

    @Test
    @DisplayName("updateAssignment: Collaborator bị Forbidden khi verifyProjectOwnerOrManager ném lỗi")
    void testUpdateAssignment_byCollaborator_forbidden() {
        when(nodeRepository.findById(nodeId)).thenReturn(Optional.of(mockNode));
        when(authorizationService.verifyProjectOwnerOrManager(projectId, collaboratorId))
            .thenThrow(new ForbiddenException("ACCESS_DENIED", "example-forbidden"));

        UpdateNodeAssignmentRequest request = new UpdateNodeAssignmentRequest(newAssigneeId, null, 1L);

        assertThatThrownBy(() -> nodeAssignmentService.updateAssignment(nodeId, request, collaboratorId))
            .isInstanceOf(ForbiddenException.class)
            .hasMessageContaining("example-forbidden");
    }

    @Test
    @DisplayName("updateAssignment: Người được giao không phải thành viên ném IllegalArgumentException chứa ASSIGNEE_NOT_MEMBER")
    void testUpdateAssignment_assigneeNotMember_throwsException() {
        Long outsiderId = 999L;
        when(nodeRepository.findById(nodeId)).thenReturn(Optional.of(mockNode));
        when(authorizationService.verifyProjectOwnerOrManager(projectId, managerId)).thenReturn(mockProject);
        when(projectMemberRepository.existsByProjectIdAndUserIdAndRemovedAtIsNull(projectId, outsiderId)).thenReturn(false);

        UpdateNodeAssignmentRequest request = new UpdateNodeAssignmentRequest(outsiderId, null, 1L);

        assertThatThrownBy(() -> nodeAssignmentService.updateAssignment(nodeId, request, managerId))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("ASSIGNEE_NOT_MEMBER");
    }

    @Test
    @DisplayName("updateAssignment: Sai version ném OptimisticLockingFailureException")
    void testUpdateAssignment_versionMismatch_throwsException() {
        when(nodeRepository.findById(nodeId)).thenReturn(Optional.of(mockNode));
        when(authorizationService.verifyProjectOwnerOrManager(projectId, managerId)).thenReturn(mockProject);

        UpdateNodeAssignmentRequest request = new UpdateNodeAssignmentRequest(newAssigneeId, null, 999L);

        assertThatThrownBy(() -> nodeAssignmentService.updateAssignment(nodeId, request, managerId))
            .isInstanceOf(OptimisticLockingFailureException.class)
            .hasMessageContaining("Công việc đã bị thay đổi");
    }

    @Test
    @DisplayName("updateAssignment: Dự án ARCHIVED ném ConflictException PROJECT_ARCHIVED")
    void testUpdateAssignment_projectArchived_throwsException() {
        mockProject.setStatus(ProjectStatus.ARCHIVED);
        when(nodeRepository.findById(nodeId)).thenReturn(Optional.of(mockNode));
        when(authorizationService.verifyProjectOwnerOrManager(projectId, managerId)).thenReturn(mockProject);

        UpdateNodeAssignmentRequest request = new UpdateNodeAssignmentRequest(newAssigneeId, null, 1L);

        assertThatThrownBy(() -> nodeAssignmentService.updateAssignment(nodeId, request, managerId))
            .isInstanceOf(ConflictException.class)
            .satisfies(ex -> assertThat(((ConflictException) ex).getErrorCode()).isEqualTo("PROJECT_ARCHIVED"));
    }

    @Test
    @DisplayName("updateAssignment: dueDate ở tương lai làm isOverdue = false")
    void testUpdateAssignment_futureDueDate_clearsIsOverdue() {
        Instant future = Instant.now().plusSeconds(3600);
        when(nodeRepository.findById(nodeId)).thenReturn(Optional.of(mockNode));
        when(authorizationService.verifyProjectOwnerOrManager(projectId, managerId)).thenReturn(mockProject);
        when(nodeRepository.save(any(NodeEntity.class))).thenAnswer(i -> i.getArgument(0));

        UpdateNodeAssignmentRequest request = new UpdateNodeAssignmentRequest(null, future, 1L);
        GraphNodeResponse response = nodeAssignmentService.updateAssignment(nodeId, request, managerId);

        assertThat(mockNode.getDueDate()).isEqualTo(future);
        assertThat(mockNode.getIsOverdue()).isFalse();
        assertThat(response.dueDate()).isEqualTo(future);
    }

    @Test
    @DisplayName("updateAssignment: Cả assignedUserId và dueDate đều null ném IllegalArgumentException")
    void testUpdateAssignment_bothNull_throwsException() {
        when(nodeRepository.findById(nodeId)).thenReturn(Optional.of(mockNode));
        when(authorizationService.verifyProjectOwnerOrManager(projectId, managerId)).thenReturn(mockProject);

        UpdateNodeAssignmentRequest request = new UpdateNodeAssignmentRequest(null, null, 1L);

        assertThatThrownBy(() -> nodeAssignmentService.updateAssignment(nodeId, request, managerId))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Cần ít nhất assignedUserId hoặc dueDate.");
    }

    @Test
    @DisplayName("updateAssignment: Node đã DONE ném IllegalArgumentException")
    void testUpdateAssignment_nodeDone_throwsException() {
        mockNode.setStatus(NodeStatus.DONE);
        when(nodeRepository.findById(nodeId)).thenReturn(Optional.of(mockNode));
        when(authorizationService.verifyProjectOwnerOrManager(projectId, managerId)).thenReturn(mockProject);

        UpdateNodeAssignmentRequest request = new UpdateNodeAssignmentRequest(newAssigneeId, null, 1L);

        assertThatThrownBy(() -> nodeAssignmentService.updateAssignment(nodeId, request, managerId))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Tác vụ đã hoàn tất, không thể đổi người làm hoặc hạn chót.");
    }

    @Test
    @DisplayName("updateAssignment: Không tìm thấy node ném ResourceNotFoundException")
    void testUpdateAssignment_nodeNotFound_throwsException() {
        when(nodeRepository.findById(999L)).thenReturn(Optional.empty());

        UpdateNodeAssignmentRequest request = new UpdateNodeAssignmentRequest(newAssigneeId, null, 1L);

        assertThatThrownBy(() -> nodeAssignmentService.updateAssignment(999L, request, managerId))
            .isInstanceOf(ResourceNotFoundException.class);
    }
}
