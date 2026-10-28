package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.common.enums.ProjectStatus;
import com.pipeline.wpe.common.enums.SystemRole;
import com.pipeline.wpe.dto.project.CreateProjectRequest;
import com.pipeline.wpe.dto.project.ProjectDetailResponse;
import com.pipeline.wpe.dto.project.ProjectSummaryResponse;
import com.pipeline.wpe.dto.project.UpdateProjectStatusRequest;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.ProjectMemberEntity;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.entity.WorkPhaseEntity;
import com.pipeline.wpe.exception.AccessDeniedException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProjectServiceTest {

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private ProjectMemberRepository projectMemberRepository;

    @Mock
    private NodeRepository nodeRepository;

    @Mock
    private WorkPhaseRepository workPhaseRepository;

    @Mock
    private ProjectAuthorizationService projectAuthorizationService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private TemplateCloneService templateCloneService;

    @InjectMocks
    private ProjectService projectService;

    private final Long userId = 2L;
    private final Long otherUserId = 99L;
    private final Long projectId = 1L;

    @Test
    @DisplayName("getMyProjects: Trả về đúng danh sách dự án và tính toán chính xác số node")
    void shouldReturnMyProjectsWithAccurateNodeCounts() {
        Instant now = Instant.now();
        ProjectEntity p1 = ProjectEntity.builder()
            .id(1L)
            .name("Banking Workflow")
            .description("Core banking pipeline")
            .ownerId(userId)
            .status(ProjectStatus.ACTIVE)
            .createdAt(now)
            .updatedAt(now)
            .build();

        UserEntity ownerUser = UserEntity.builder()
            .id(userId)
            .username("alex.kim")
            .fullName("Alex Kim")
            .build();

        when(projectRepository.findAllAccessibleProjects(userId)).thenReturn(List.of(p1));
        when(userRepository.findAllById(List.of(userId))).thenReturn(List.of(ownerUser));
        when(nodeRepository.countByProjectId(1L)).thenReturn(10L);
        when(nodeRepository.countByProjectIdAndStatus(1L, NodeStatus.DONE)).thenReturn(6L);
        when(nodeRepository.countByProjectIdAndStatus(1L, NodeStatus.IN_PROGRESS)).thenReturn(2L);

        List<ProjectSummaryResponse> result = projectService.getMyProjects(userId);

        assertThat(result).hasSize(1);
        ProjectSummaryResponse summary = result.get(0);
        assertThat(summary.id()).isEqualTo(1L);
        assertThat(summary.name()).isEqualTo("Banking Workflow");
        assertThat(summary.ownerName()).isEqualTo("Alex Kim");
        assertThat(summary.totalNodes()).isEqualTo(10);
        assertThat(summary.completedNodes()).isEqualTo(6);
        assertThat(summary.inProgressNodes()).isEqualTo(2);
        assertThat(summary.progressPercentage()).isEqualTo(60.0);
    }

    @Test
    @DisplayName("createProject: Khởi tạo dự án thành công và tự động ghi nhận Member OWNER")
    void shouldCreateProjectAndRegisterOwnerMember() {
        CreateProjectRequest req = new CreateProjectRequest("Payment Pipeline", "Process payments", null, "PRIVATE");

        ProjectEntity savedEntity = ProjectEntity.builder()
            .id(100L)
            .name("Payment Pipeline")
            .description("Process payments")
            .ownerId(userId)
            .status(ProjectStatus.PLANNING)
            .createdAt(Instant.now())
            .updatedAt(Instant.now())
            .build();

        when(projectRepository.save(any(ProjectEntity.class))).thenReturn(savedEntity);
        when(userRepository.findById(userId)).thenReturn(Optional.of(
            UserEntity.builder().id(userId).username("alex.kim").fullName("Alex Kim").build()
        ));

        ProjectDetailResponse response = projectService.createProject(req, userId);

        assertThat(response).isNotNull();
        assertThat(response.id()).isEqualTo(100L);
        assertThat(response.name()).isEqualTo("Payment Pipeline");
        assertThat(response.status()).isEqualTo("PLANNING");
        assertThat(response.ownerId()).isEqualTo(userId);
        assertThat(response.ownerName()).isEqualTo("Alex Kim");

        // Kiểm tra MemberEntity được lưu với vai trò OWNER
        ArgumentCaptor<ProjectMemberEntity> memberCaptor = ArgumentCaptor.forClass(ProjectMemberEntity.class);
        verify(projectMemberRepository, times(1)).save(memberCaptor.capture());
        ProjectMemberEntity savedMember = memberCaptor.getValue();
        assertThat(savedMember.getProjectId()).isEqualTo(100L);
        assertThat(savedMember.getUserId()).isEqualTo(userId);
        assertThat(savedMember.getRole()).isEqualTo(ProjectRole.OWNER);
        assertThat(savedMember.getRemovedAt()).isNull();
    }

    @Test
    @DisplayName("getProjectDetail: Lấy chi tiết dự án thành công cho thành viên dự án")
    void shouldReturnProjectDetailForAuthorizedMember() {
        Instant now = Instant.now();
        ProjectEntity project = ProjectEntity.builder()
            .id(projectId)
            .name("Core Engine")
            .description("Pipeline desc")
            .ownerId(userId)
            .status(ProjectStatus.ACTIVE)
            .latestAiAnalysis(Map.of("health", 100))
            .createdAt(now)
            .updatedAt(now)
            .build();

        WorkPhaseEntity phase = WorkPhaseEntity.builder()
            .id(10L)
            .projectId(projectId)
            .name("Phase 1")
            .orderIndex(0)
            .build();

        NodeEntity node1 = NodeEntity.builder().id(1L).projectId(projectId).phaseId(10L).status(NodeStatus.DONE).build();
        NodeEntity node2 = NodeEntity.builder().id(2L).projectId(projectId).phaseId(10L).status(NodeStatus.IN_PROGRESS).build();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(userRepository.findById(userId)).thenReturn(Optional.of(
            UserEntity.builder().id(userId).username("alex.kim").fullName("Alex Kim").build()
        ));
        when(workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(projectId)).thenReturn(List.of(phase));
        when(nodeRepository.findByProjectId(projectId)).thenReturn(List.of(node1, node2));

        ProjectDetailResponse detail = projectService.getProjectDetail(projectId, userId);

        assertThat(detail).isNotNull();
        assertThat(detail.id()).isEqualTo(projectId);
        assertThat(detail.totalNodes()).isEqualTo(2);
        assertThat(detail.completedNodes()).isEqualTo(1);
        assertThat(detail.inProgressNodes()).isEqualTo(1);
        assertThat(detail.progressPercentage()).isEqualTo(50.0);
        assertThat(detail.phases()).hasSize(1);
        assertThat(detail.phases().get(0).nodeCount()).isEqualTo(2);
    }

    @Test
    @DisplayName("getProjectDetail: Ném AccessDeniedException khi người dùng không thuộc dự án")
    void shouldThrowAccessDeniedWhenUserNotMemberOrOwner() {
        ProjectEntity project = ProjectEntity.builder()
            .id(projectId)
            .ownerId(userId)
            .build();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(projectMemberRepository.existsByProjectIdAndUserIdAndRemovedAtIsNull(projectId, otherUserId)).thenReturn(false);
        when(userRepository.findById(otherUserId)).thenReturn(Optional.of(
            UserEntity.builder().id(otherUserId).systemRole(SystemRole.USER).build()
        ));

        assertThatThrownBy(() -> projectService.getProjectDetail(projectId, otherUserId))
            .isInstanceOf(AccessDeniedException.class)
            .hasMessageContaining("Bạn không có quyền truy cập vào dự án này.");
    }

    @Test
    @DisplayName("updateProjectStatus: Cập nhật trạng thái thành công khi người gọi là OWNER")
    void shouldUpdateProjectStatusWhenUserIsOwner() {
        Instant now = Instant.now();
        ProjectEntity project = ProjectEntity.builder()
            .id(projectId)
            .ownerId(userId)
            .name("Fintech Core")
            .status(ProjectStatus.PLANNING)
            .createdAt(now)
            .updatedAt(now)
            .build();

        UpdateProjectStatusRequest req = new UpdateProjectStatusRequest("ACTIVE");

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(projectRepository.save(any(ProjectEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(userRepository.findById(userId)).thenReturn(Optional.of(
            UserEntity.builder().id(userId).username("alex.kim").fullName("Alex Kim").build()
        ));
        when(nodeRepository.countByProjectId(projectId)).thenReturn(5L);
        when(nodeRepository.countByProjectIdAndStatus(projectId, NodeStatus.DONE)).thenReturn(2L);
        when(nodeRepository.countByProjectIdAndStatus(projectId, NodeStatus.IN_PROGRESS)).thenReturn(1L);

        ProjectSummaryResponse response = projectService.updateProjectStatus(projectId, req, userId);

        assertThat(response).isNotNull();
        assertThat(response.status()).isEqualTo("ACTIVE");
        assertThat(response.totalNodes()).isEqualTo(5);
        assertThat(response.completedNodes()).isEqualTo(2);
        assertThat(response.progressPercentage()).isEqualTo(40.0);
    }

    @Test
    @DisplayName("updateProjectStatus: Chặn quyền và ném Exception khi người gọi không phải OWNER")
    void shouldThrowAccessDeniedWhenNonOwnerTriesToUpdateStatus() {
        ProjectEntity project = ProjectEntity.builder()
            .id(projectId)
            .ownerId(userId) // Owner là userId = 2
            .status(ProjectStatus.PLANNING)
            .build();

        UpdateProjectStatusRequest req = new UpdateProjectStatusRequest("ACTIVE");

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(userRepository.findById(otherUserId)).thenReturn(Optional.of(
            UserEntity.builder().id(otherUserId).systemRole(SystemRole.USER).build()
        ));

        // otherUserId (99) không phải owner (2) và không phải ADMIN
        assertThatThrownBy(() -> projectService.updateProjectStatus(projectId, req, otherUserId))
            .isInstanceOf(AccessDeniedException.class)
            .hasMessageContaining("Chỉ chủ sở hữu dự án mới có quyền đổi trạng thái");

        verify(projectRepository, never()).save(any(ProjectEntity.class));
    }

    @Test
    @DisplayName("updateProjectStatus: Ném ResourceNotFoundException nếu projectId không tồn tại")
    void shouldThrowNotFoundWhenProjectDoesNotExist() {
        when(projectRepository.findById(999L)).thenReturn(Optional.empty());

        UpdateProjectStatusRequest req = new UpdateProjectStatusRequest("ACTIVE");

        assertThatThrownBy(() -> projectService.updateProjectStatus(999L, req, userId))
            .isInstanceOf(ResourceNotFoundException.class)
            .hasMessageContaining("Không tìm thấy dự án với ID: 999");
    }
}
