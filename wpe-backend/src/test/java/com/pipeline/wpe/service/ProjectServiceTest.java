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
import com.pipeline.wpe.exception.ConflictException;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
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
        when(nodeRepository.countByProjectIdsGroupByStatus(List.of(1L))).thenReturn(List.<Object[]>of(
            new Object[]{1L, NodeStatus.DONE, 6L},
            new Object[]{1L, NodeStatus.IN_PROGRESS, 2L},
            new Object[]{1L, NodeStatus.TODO, 2L}
        ));

        List<ProjectSummaryResponse> result = projectService.getMyProjects(userId);

        assertThat(result).hasSize(1);
        ProjectSummaryResponse summary = result.get(0);
        assertThat(summary.id()).isEqualTo(1L);
        assertThat(summary.name()).isEqualTo("Banking Workflow");
        assertThat(summary.ownerName()).isEqualTo("Alex Kim");
        assertThat(summary.totalNodes()).isEqualTo(10);
        assertThat(summary.nodeCount()).isEqualTo(10);
        assertThat(summary.completedNodes()).isEqualTo(6);
        assertThat(summary.doneNodes()).isEqualTo(6);
        assertThat(summary.inProgressNodes()).isEqualTo(2);
        assertThat(summary.activeNodes()).isEqualTo(4);
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
            .status(ProjectStatus.DRAFT)
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
        assertThat(response.status()).isEqualTo("DRAFT");
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
            .status(ProjectStatus.ACTIVE)
            .createdAt(now)
            .updatedAt(now)
            .build();

        UpdateProjectStatusRequest req = new UpdateProjectStatusRequest("PAUSED");

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(projectRepository.save(any(ProjectEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(userRepository.findById(userId)).thenReturn(Optional.of(
            UserEntity.builder().id(userId).username("alex.kim").fullName("Alex Kim").build()
        ));
        when(nodeRepository.countByProjectIdsGroupByStatus(List.of(projectId))).thenReturn(List.<Object[]>of(
            new Object[]{projectId, NodeStatus.DONE, 2L},
            new Object[]{projectId, NodeStatus.IN_PROGRESS, 1L},
            new Object[]{projectId, NodeStatus.TODO, 2L}
        ));

        ProjectSummaryResponse response = projectService.updateProjectStatus(projectId, req, userId);

        assertThat(response).isNotNull();
        assertThat(response.status()).isEqualTo("PAUSED");
        assertThat(response.totalNodes()).isEqualTo(5);
        assertThat(response.completedNodes()).isEqualTo(2);
        assertThat(response.progressPercentage()).isEqualTo(40.0);
    }

    @Test
    @DisplayName("getMyProjects: Lọc chính xác theo từng tab all, mine, shared, archived")
    void shouldFilterProjectsByTabCorrectly() {
        Instant now = Instant.now();
        ProjectEntity p1 = ProjectEntity.builder().id(1L).name("P1").ownerId(userId).status(ProjectStatus.ACTIVE).createdAt(now).updatedAt(now).build();
        ProjectEntity p2 = ProjectEntity.builder().id(2L).name("P2").ownerId(otherUserId).status(ProjectStatus.ACTIVE).createdAt(now).updatedAt(now).build();
        ProjectEntity p3 = ProjectEntity.builder().id(3L).name("P3").ownerId(userId).status(ProjectStatus.ARCHIVED).createdAt(now).updatedAt(now).build();

        when(projectRepository.findAllAccessibleProjects(userId)).thenReturn(List.of(p1, p2, p3));
        when(userRepository.findAllById(any())).thenReturn(List.of(
            UserEntity.builder().id(userId).fullName("Alex Kim").build(),
            UserEntity.builder().id(otherUserId).fullName("Other User").build()
        ));
        when(nodeRepository.countByProjectIdsGroupByStatus(any())).thenReturn(List.of());

        List<ProjectSummaryResponse> all = projectService.getMyProjects(userId, "all", "ts");
        assertThat(all.stream().map(ProjectSummaryResponse::id).toList()).containsExactly(2L, 1L);

        List<ProjectSummaryResponse> mine = projectService.getMyProjects(userId, "mine", "ts");
        assertThat(mine.stream().map(ProjectSummaryResponse::id).toList()).containsExactly(1L);

        List<ProjectSummaryResponse> shared = projectService.getMyProjects(userId, "shared", "ts");
        assertThat(shared.stream().map(ProjectSummaryResponse::id).toList()).containsExactly(2L);

        List<ProjectSummaryResponse> archived = projectService.getMyProjects(userId, "archived", "ts");
        assertThat(archived.stream().map(ProjectSummaryResponse::id).toList()).containsExactly(3L);
    }

    @Test
    @DisplayName("getMyProjects: Gom nhóm và tính toán đúng nodeCount, activeNodes, doneNodes từ 1 truy vấn GROUP BY")
    void shouldCalculateNodeStatsFromSingleGroupByQuery() {
        Instant now = Instant.now();
        ProjectEntity p1 = ProjectEntity.builder().id(1L).name("P1").ownerId(userId).status(ProjectStatus.ACTIVE).createdAt(now).updatedAt(now).build();

        when(projectRepository.findAllAccessibleProjects(userId)).thenReturn(List.of(p1));
        when(userRepository.findAllById(List.of(userId))).thenReturn(List.of(
            UserEntity.builder().id(userId).fullName("Alex Kim").build()
        ));
        when(nodeRepository.countByProjectIdsGroupByStatus(List.of(1L))).thenReturn(List.<Object[]>of(
            new Object[]{1L, NodeStatus.TODO, 2L},
            new Object[]{1L, NodeStatus.IN_PROGRESS, 1L},
            new Object[]{1L, NodeStatus.REVIEW, 1L},
            new Object[]{1L, NodeStatus.DONE, 3L},
            new Object[]{1L, NodeStatus.LOCKED, 1L}
        ));

        List<ProjectSummaryResponse> result = projectService.getMyProjects(userId, "all", "ts");

        assertThat(result).hasSize(1);
        ProjectSummaryResponse summary = result.get(0);
        assertThat(summary.nodeCount()).isEqualTo(8);
        assertThat(summary.activeNodes()).isEqualTo(4);
        assertThat(summary.doneNodes()).isEqualTo(3);
        assertThat(summary.inProgressNodes()).isEqualTo(1);
        verify(nodeRepository, times(1)).countByProjectIdsGroupByStatus(any());
    }

    @Test
    @DisplayName("getMyProjects: Sắp xếp chính xác theo done và nodes giảm dần")
    void shouldSortProjectsByDoneAndNodesCorrectly() {
        Instant now = Instant.now();
        ProjectEntity p1 = ProjectEntity.builder().id(1L).name("P1").ownerId(userId).status(ProjectStatus.ACTIVE).createdAt(now).updatedAt(now).build();
        ProjectEntity p2 = ProjectEntity.builder().id(2L).name("P2").ownerId(userId).status(ProjectStatus.ACTIVE).createdAt(now).updatedAt(now).build();

        when(projectRepository.findAllAccessibleProjects(userId)).thenReturn(List.of(p1, p2));
        when(userRepository.findAllById(any())).thenReturn(List.of(
            UserEntity.builder().id(userId).fullName("Alex Kim").build()
        ));
        when(nodeRepository.countByProjectIdsGroupByStatus(any())).thenReturn(List.<Object[]>of(
            new Object[]{1L, NodeStatus.DONE, 1L},
            new Object[]{1L, NodeStatus.TODO, 4L},
            new Object[]{2L, NodeStatus.DONE, 3L}
        ));

        List<ProjectSummaryResponse> sortedByDone = projectService.getMyProjects(userId, "all", "done");
        assertThat(sortedByDone.stream().map(ProjectSummaryResponse::id).toList()).containsExactly(2L, 1L);

        List<ProjectSummaryResponse> sortedByNodes = projectService.getMyProjects(userId, "all", "nodes");
        assertThat(sortedByNodes.stream().map(ProjectSummaryResponse::id).toList()).containsExactly(1L, 2L);
    }

    @Test
    @DisplayName("getMyProjects: Ném IllegalArgumentException khi tab không hợp lệ")
    void shouldThrowIllegalArgumentException_whenTabIsInvalid() {
        assertThatThrownBy(() -> projectService.getMyProjects(userId, "xyz", "ts"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Tham số tab không hợp lệ: xyz");
    }

    @ParameterizedTest
    @CsvSource({
        "ACTIVE, PAUSED",
        "PAUSED, ACTIVE",
        "ACTIVE, ARCHIVED",
        "DRAFT, ARCHIVED",
        "PLANNING, ARCHIVED",
        "COMPLETED, ARCHIVED",
        "ARCHIVED, DRAFT",
        "ACTIVE, COMPLETED"
    })
    @DisplayName("updateProjectStatus: Cho phép chuyển trạng thái hợp lệ")
    void shouldAllowValidStatusTransitions(ProjectStatus from, ProjectStatus to) {
        Instant now = Instant.now();
        ProjectEntity project = ProjectEntity.builder()
            .id(projectId)
            .ownerId(userId)
            .name("Workflow")
            .status(from)
            .createdAt(now)
            .updatedAt(now)
            .build();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(projectRepository.save(any(ProjectEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(userRepository.findById(userId)).thenReturn(Optional.of(
            UserEntity.builder().id(userId).fullName("Alex Kim").build()
        ));
        when(nodeRepository.countByProjectIdsGroupByStatus(List.of(projectId))).thenReturn(List.of());

        ProjectSummaryResponse resp = projectService.updateProjectStatus(
            projectId, new UpdateProjectStatusRequest(to.name()), userId
        );

        assertThat(resp.status()).isEqualTo(to.name());
        verify(projectRepository, times(1)).save(any(ProjectEntity.class));
    }

    @Test
    @DisplayName("FC4: Archive dự án DRAFT thành công -> ARCHIVED")
    void shouldArchiveDraftProjectSuccessfully() {
        Instant now = Instant.now();
        ProjectEntity project = ProjectEntity.builder()
            .id(projectId)
            .ownerId(userId)
            .name("Draft Project")
            .status(ProjectStatus.DRAFT)
            .createdAt(now)
            .updatedAt(now)
            .build();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(projectRepository.save(any(ProjectEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(userRepository.findById(userId)).thenReturn(Optional.of(
            UserEntity.builder().id(userId).fullName("Alex Kim").build()
        ));
        when(nodeRepository.countByProjectIdsGroupByStatus(List.of(projectId))).thenReturn(List.of());

        ProjectSummaryResponse resp = projectService.updateProjectStatus(
            projectId, new UpdateProjectStatusRequest("ARCHIVED"), userId
        );

        assertThat(resp.status()).isEqualTo("ARCHIVED");
        assertThat(project.getStatus()).isEqualTo(ProjectStatus.ARCHIVED);
    }

    @Test
    @DisplayName("FC4: Khôi phục dự án chưa từng xuất bản (không có node hoặc toàn bộ LOCKED) -> về DRAFT thay vì ACTIVE")
    void shouldRestoreUnpublishedArchivedProjectToDraft() {
        Instant now = Instant.now();
        ProjectEntity project = ProjectEntity.builder()
            .id(projectId)
            .ownerId(userId)
            .name("Unpublished Archived Project")
            .status(ProjectStatus.ARCHIVED)
            .createdAt(now)
            .updatedAt(now)
            .build();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(projectRepository.save(any(ProjectEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(userRepository.findById(userId)).thenReturn(Optional.of(
            UserEntity.builder().id(userId).fullName("Alex Kim").build()
        ));
        when(nodeRepository.countByProjectIdsGroupByStatus(List.of(projectId))).thenReturn(List.<Object[]>of(
            new Object[]{projectId, NodeStatus.LOCKED, 3L}
        ));

        ProjectSummaryResponse resp = projectService.updateProjectStatus(
            projectId, new UpdateProjectStatusRequest("ACTIVE"), userId
        );

        assertThat(resp.status()).isEqualTo("DRAFT");
        assertThat(project.getStatus()).isEqualTo(ProjectStatus.DRAFT);
    }

    @Test
    @DisplayName("FC4: Khôi phục dự án đã xuất bản (có node khác LOCKED) -> về ACTIVE")
    void shouldRestorePublishedArchivedProjectToActive() {
        Instant now = Instant.now();
        ProjectEntity project = ProjectEntity.builder()
            .id(projectId)
            .ownerId(userId)
            .name("Published Archived Project")
            .status(ProjectStatus.ARCHIVED)
            .createdAt(now)
            .updatedAt(now)
            .build();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(projectRepository.save(any(ProjectEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(userRepository.findById(userId)).thenReturn(Optional.of(
            UserEntity.builder().id(userId).fullName("Alex Kim").build()
        ));
        when(nodeRepository.countByProjectIdsGroupByStatus(List.of(projectId))).thenReturn(List.<Object[]>of(
            new Object[]{projectId, NodeStatus.TODO, 2L},
            new Object[]{projectId, NodeStatus.LOCKED, 1L}
        ));

        ProjectSummaryResponse resp = projectService.updateProjectStatus(
            projectId, new UpdateProjectStatusRequest("ACTIVE"), userId
        );

        assertThat(resp.status()).isEqualTo("ACTIVE");
        assertThat(project.getStatus()).isEqualTo(ProjectStatus.ACTIVE);
    }

    @ParameterizedTest
    @CsvSource({
        "DRAFT",
        "PLANNING"
    })
    @DisplayName("updateProjectStatus: DRAFT/PLANNING -> ACTIVE ném ConflictException USE_PUBLISH")
    void shouldThrowConflictExceptionWithUsePublish_whenActivatingDraftOrPlanning(ProjectStatus initialStatus) {
        ProjectEntity project = ProjectEntity.builder()
            .id(projectId)
            .ownerId(userId)
            .status(initialStatus)
            .build();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));

        UpdateProjectStatusRequest req = new UpdateProjectStatusRequest("ACTIVE");

        assertThatThrownBy(() -> projectService.updateProjectStatus(projectId, req, userId))
            .isInstanceOf(ConflictException.class)
            .satisfies(ex -> {
                ConflictException ce = (ConflictException) ex;
                assertThat(ce.getErrorCode()).isEqualTo("USE_PUBLISH");
            });

        verify(projectRepository, never()).save(any());
    }

    @ParameterizedTest
    @CsvSource({
        "COMPLETED, ACTIVE",
        "ARCHIVED, PAUSED",
        "ACTIVE, ACTIVE"
    })
    @DisplayName("updateProjectStatus: Chuyển trạng thái không hợp lệ ném ConflictException INVALID_PROJECT_STATUS")
    void shouldThrowConflictExceptionWithInvalidStatus_whenTransitionNotAllowed(ProjectStatus from, ProjectStatus to) {
        ProjectEntity project = ProjectEntity.builder()
            .id(projectId)
            .ownerId(userId)
            .status(from)
            .build();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));

        UpdateProjectStatusRequest req = new UpdateProjectStatusRequest(to.name());

        assertThatThrownBy(() -> projectService.updateProjectStatus(projectId, req, userId))
            .isInstanceOf(ConflictException.class)
            .satisfies(ex -> {
                ConflictException ce = (ConflictException) ex;
                assertThat(ce.getErrorCode()).isEqualTo("INVALID_PROJECT_STATUS");
            });

        verify(projectRepository, never()).save(any());
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
    @DisplayName("FC4: Chặn người không phải OWNER lưu trữ (archive) hoặc khôi phục dự án -> ném AccessDeniedException (403)")
    void shouldThrowAccessDeniedWhenNonOwnerTriesToArchiveOrRestore() {
        ProjectEntity draftProject = ProjectEntity.builder()
            .id(projectId)
            .ownerId(userId)
            .status(ProjectStatus.DRAFT)
            .build();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(draftProject));
        when(userRepository.findById(otherUserId)).thenReturn(Optional.of(
            UserEntity.builder().id(otherUserId).systemRole(SystemRole.USER).build()
        ));

        assertThatThrownBy(() -> projectService.updateProjectStatus(
            projectId, new UpdateProjectStatusRequest("ARCHIVED"), otherUserId
        )).isInstanceOf(AccessDeniedException.class);

        draftProject.setStatus(ProjectStatus.ARCHIVED);
        assertThatThrownBy(() -> projectService.updateProjectStatus(
            projectId, new UpdateProjectStatusRequest("ACTIVE"), otherUserId
        )).isInstanceOf(AccessDeniedException.class);

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

    @Test
    @DisplayName("FC4: deleteProject bởi OWNER xóa toàn bộ node, work_phase, project_member và project")
    void shouldDeleteProjectAndChildrenWhenCalledByOwner() {
        ProjectEntity project = ProjectEntity.builder()
            .id(projectId)
            .ownerId(userId)
            .name("To Delete")
            .status(ProjectStatus.DRAFT)
            .build();

        when(projectAuthorizationService.verifyProjectOwner(projectId, userId)).thenReturn(project);

        projectService.deleteProject(projectId, userId);

        verify(projectAuthorizationService).verifyProjectOwner(projectId, userId);
        verify(nodeRepository).deleteByProjectId(projectId);
        verify(workPhaseRepository).deleteByProjectId(projectId);
        verify(projectMemberRepository).deleteByProjectId(projectId);
        verify(projectRepository).delete(project);
    }

    @Test
    @DisplayName("FC4: deleteProject bởi người không phải OWNER ném ForbiddenException (403)")
    void shouldThrowForbiddenWhenNonOwnerDeletesProject() {
        when(projectAuthorizationService.verifyProjectOwner(projectId, otherUserId))
            .thenThrow(new ForbiddenException("ACCESS_DENIED", "Chỉ Chủ dự án (Project Owner) mới có quyền thực hiện hành động này."));

        assertThatThrownBy(() -> projectService.deleteProject(projectId, otherUserId))
            .isInstanceOf(ForbiddenException.class);

        verify(nodeRepository, never()).deleteByProjectId(any());
        verify(workPhaseRepository, never()).deleteByProjectId(any());
        verify(projectMemberRepository, never()).deleteByProjectId(any());
        verify(projectRepository, never()).delete(any());
    }

    @Test
    @DisplayName("FC4: deleteProject khi dự án không tồn tại ném ResourceNotFoundException (404)")
    void shouldThrowNotFoundWhenDeletingNonExistentProject() {
        when(projectAuthorizationService.verifyProjectOwner(999L, userId))
            .thenThrow(new ResourceNotFoundException("Không tìm thấy dự án với ID: 999"));

        assertThatThrownBy(() -> projectService.deleteProject(999L, userId))
            .isInstanceOf(ResourceNotFoundException.class);

        verify(projectRepository, never()).delete(any());
    }
}
