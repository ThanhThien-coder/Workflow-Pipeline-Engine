package com.pipeline.wpe.admin;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.pipeline.wpe.common.enums.InvitationStatus;
import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.common.enums.ProjectStatus;
import com.pipeline.wpe.common.enums.SystemRole;
import com.pipeline.wpe.dto.response.admin.AdminWorkspaceDetailResponse;
import com.pipeline.wpe.dto.response.admin.AdminWorkspaceResponse;
import com.pipeline.wpe.dto.response.admin.OwnerCandidateResponse;
import com.pipeline.wpe.entity.GuestLinkEntity;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.ProjectMemberEntity;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.entity.WorkPhaseEntity;
import com.pipeline.wpe.exception.ConflictException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.GuestLinkRepository;
import com.pipeline.wpe.repository.NodeRepository;
import com.pipeline.wpe.repository.ProjectInvitationRepository;
import com.pipeline.wpe.repository.ProjectMemberRepository;
import com.pipeline.wpe.repository.ProjectRepository;
import com.pipeline.wpe.repository.UserRepository;
import com.pipeline.wpe.repository.WorkPhaseRepository;
import com.pipeline.wpe.service.admin.AdminAuditAction;
import com.pipeline.wpe.service.admin.AdminAuditService;
import com.pipeline.wpe.service.admin.AdminProjectOwnerService;
import com.pipeline.wpe.service.admin.AdminWorkspaceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminWorkspaceServiceTest {

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ProjectMemberRepository projectMemberRepository;

    @Mock
    private WorkPhaseRepository workPhaseRepository;

    @Mock
    private NodeRepository nodeRepository;

    @Mock
    private ProjectInvitationRepository projectInvitationRepository;

    @Mock
    private GuestLinkRepository guestLinkRepository;

    @Mock
    private AdminProjectOwnerService adminProjectOwnerService;

    @Mock
    private AdminAuditService adminAuditService;

    @InjectMocks
    private AdminWorkspaceService adminWorkspaceService;

    private UserEntity ownerUser;
    private ProjectEntity project1;

    @BeforeEach
    void setUp() {
        ownerUser = UserEntity.builder()
            .id(10L)
            .username("alex.kim")
            .fullName("Alex Kim")
            .email("alex.kim@pipeline.engine")
            .systemRole(SystemRole.USER)
            .isLocked(false)
            .build();

        project1 = ProjectEntity.builder()
            .id(1L)
            .name("E-Commerce DAG Pipeline")
            .description("Mô tả quy trình thương mại điện tử")
            .ownerId(10L)
            .status(ProjectStatus.ACTIVE)
            .createdAt(Instant.now().minus(5, ChronoUnit.DAYS))
            .updatedAt(Instant.now().minus(1, ChronoUnit.DAYS))
            .build();
    }

    @Test
    @DisplayName("listWorkspaces tính đúng memberCount và progressPercentage")
    void testListWorkspaces_calculatesMemberCountAndProgress() {
        when(projectRepository.findAll()).thenReturn(List.of(project1));
        when(userRepository.findAll()).thenReturn(List.of(ownerUser));

        ProjectMemberEntity m1 = ProjectMemberEntity.builder().projectId(1L).userId(10L).role(ProjectRole.OWNER).build();
        ProjectMemberEntity m2 = ProjectMemberEntity.builder().projectId(1L).userId(11L).role(ProjectRole.COLLABORATOR).build();
        ProjectMemberEntity mRemoved = ProjectMemberEntity.builder().projectId(1L).userId(12L).role(ProjectRole.VIEWER).removedAt(Instant.now()).build();
        when(projectMemberRepository.findAll()).thenReturn(List.of(m1, m2, mRemoved));

        WorkPhaseEntity phase1 = WorkPhaseEntity.builder().id(101L).projectId(1L).name("Phase 1").build();
        when(workPhaseRepository.findAll()).thenReturn(List.of(phase1));

        NodeEntity n1 = NodeEntity.builder().id(1001L).projectId(1L).status(NodeStatus.DONE).title("Task 1").build();
        NodeEntity n2 = NodeEntity.builder().id(1002L).projectId(1L).status(NodeStatus.DONE).title("Task 2").build();
        NodeEntity n3 = NodeEntity.builder().id(1003L).projectId(1L).status(NodeStatus.IN_PROGRESS).title("Task 3").build();
        NodeEntity n4 = NodeEntity.builder().id(1004L).projectId(1L).status(NodeStatus.TODO).title("Task 4").build();
        when(nodeRepository.findAll()).thenReturn(List.of(n1, n2, n3, n4));

        List<AdminWorkspaceResponse> result = adminWorkspaceService.listWorkspaces(null, null);

        assertThat(result).hasSize(1);
        AdminWorkspaceResponse res = result.get(0);
        assertThat(res.id()).isEqualTo("1");
        assertThat(res.name()).isEqualTo("E-Commerce DAG Pipeline");
        assertThat(res.ownerId()).isEqualTo("10");
        assertThat(res.ownerName()).isEqualTo("Alex Kim");
        assertThat(res.ownerMaskedEmail()).isEqualTo("a***@pipeline.engine");
        assertThat(res.status()).isEqualTo("ACTIVE");
        assertThat(res.memberCount()).isEqualTo(2); // m1 & m2, mRemoved excluded
        assertThat(res.phaseCount()).isEqualTo(1);
        assertThat(res.nodeCount()).isEqualTo(4);
        assertThat(res.doneNodeCount()).isEqualTo(2);
        assertThat(res.progressPercentage()).isEqualTo(50); // 2 / 4 = 50%
    }

    @Test
    @DisplayName("listWorkspaces: lọc query theo tên chủ, KHÔNG khớp email")
    void testListWorkspaces_filtersByQuery_doesNotMatchEmail() {
        when(projectRepository.findAll()).thenReturn(List.of(project1));
        when(userRepository.findAll()).thenReturn(List.of(ownerUser));
        when(projectMemberRepository.findAll()).thenReturn(List.of());
        when(workPhaseRepository.findAll()).thenReturn(List.of());
        when(nodeRepository.findAll()).thenReturn(List.of());

        // Khớp họ tên chủ
        List<AdminWorkspaceResponse> byFullName = adminWorkspaceService.listWorkspaces("Alex", null);
        assertThat(byFullName).hasSize(1);

        // Khớp username chủ
        List<AdminWorkspaceResponse> byUsername = adminWorkspaceService.listWorkspaces("alex.kim", null);
        assertThat(byUsername).hasSize(1);

        // Khớp tên dự án
        List<AdminWorkspaceResponse> byProjectName = adminWorkspaceService.listWorkspaces("commerce", null);
        assertThat(byProjectName).hasSize(1);

        // KHÔNG khớp email: query theo domain email hoặc email thật trả về danh sách rỗng
        List<AdminWorkspaceResponse> byEmail = adminWorkspaceService.listWorkspaces("pipeline.engine", null);
        assertThat(byEmail).isEmpty();

        List<AdminWorkspaceResponse> byFullEmail = adminWorkspaceService.listWorkspaces("alex.kim@pipeline.engine", null);
        assertThat(byFullEmail).isEmpty();
    }

    @Test
    @DisplayName("archiveWorkspace: dự án ACTIVE -> ARCHIVED, cập nhật updatedAt và gọi adminAuditService.record với WORKSPACE_ARCHIVED")
    void testArchiveWorkspace_activeProject_archivesAndAudits() {
        when(projectRepository.findById(1L)).thenReturn(Optional.of(project1));
        when(projectRepository.save(any(ProjectEntity.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userRepository.findById(10L)).thenReturn(Optional.of(ownerUser));
        when(projectMemberRepository.findByProjectIdAndRemovedAtIsNull(1L)).thenReturn(List.of());
        when(workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(1L)).thenReturn(List.of());
        when(nodeRepository.findByProjectId(1L)).thenReturn(List.of());

        AdminWorkspaceResponse response = adminWorkspaceService.archiveWorkspace(1L, 99L);

        assertThat(response.status()).isEqualTo("ARCHIVED");
        assertThat(project1.getStatus()).isEqualTo(ProjectStatus.ARCHIVED);
        verify(projectRepository).save(project1);
        verify(adminAuditService).record(
            eq(99L),
            isNull(),
            eq(AdminAuditAction.WORKSPACE_ARCHIVED),
            eq("PROJECT"),
            eq("1"),
            eq("E-Commerce DAG Pipeline (ACTIVE)")
        );
    }

    @Test
    @DisplayName("archiveWorkspace lần 2: đã ARCHIVED -> ném ConflictException mã ALREADY_ARCHIVED")
    void testArchiveWorkspace_alreadyArchived_throwsConflictException() {
        project1.setStatus(ProjectStatus.ARCHIVED);
        when(projectRepository.findById(1L)).thenReturn(Optional.of(project1));

        assertThatThrownBy(() -> adminWorkspaceService.archiveWorkspace(1L, 99L))
            .isInstanceOf(ConflictException.class)
            .satisfies(ex -> assertThat(((ConflictException) ex).getErrorCode()).isEqualTo("ALREADY_ARCHIVED"));

        verify(projectRepository, never()).save(any());
        verify(adminAuditService, never()).record(any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("getWorkspaceDetail: đủ 4 khóa role, 5 khóa status, overdue đúng")
    void testGetWorkspaceDetail_validatesRolesStatusesOverdue() {
        when(projectRepository.findById(1L)).thenReturn(Optional.of(project1));
        when(userRepository.findById(10L)).thenReturn(Optional.of(ownerUser));

        ProjectMemberEntity mOwner = ProjectMemberEntity.builder().projectId(1L).userId(10L).role(ProjectRole.OWNER).build();
        ProjectMemberEntity mManager = ProjectMemberEntity.builder().projectId(1L).userId(11L).role(ProjectRole.MANAGER).build();
        when(projectMemberRepository.findByProjectIdAndRemovedAtIsNull(1L)).thenReturn(List.of(mOwner, mManager));
        when(projectInvitationRepository.countByProjectIdAndStatus(1L, InvitationStatus.PENDING)).thenReturn(2L);
        when(workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(1L)).thenReturn(List.of(
            WorkPhaseEntity.builder().id(101L).projectId(1L).name("P1").build()
        ));

        Instant past = Instant.now().minus(2, ChronoUnit.DAYS);
        Instant future = Instant.now().plus(2, ChronoUnit.DAYS);
        Instant nodeUpdated = Instant.now().minus(3, ChronoUnit.HOURS);

        NodeEntity n1 = NodeEntity.builder().id(1L).projectId(1L).status(NodeStatus.LOCKED).dueDate(past).updatedAt(nodeUpdated).build(); // Overdue!
        NodeEntity n2 = NodeEntity.builder().id(2L).projectId(1L).status(NodeStatus.TODO).dueDate(past).updatedAt(nodeUpdated).build(); // Overdue!
        NodeEntity n3 = NodeEntity.builder().id(3L).projectId(1L).status(NodeStatus.IN_PROGRESS).dueDate(future).updatedAt(nodeUpdated).build();
        NodeEntity n4 = NodeEntity.builder().id(4L).projectId(1L).status(NodeStatus.REVIEW).dueDate(null).updatedAt(nodeUpdated).build();
        NodeEntity n5 = NodeEntity.builder().id(5L).projectId(1L).status(NodeStatus.DONE).dueDate(past).updatedAt(nodeUpdated).build(); // DONE is not overdue
        when(nodeRepository.findByProjectId(1L)).thenReturn(List.of(n1, n2, n3, n4, n5));

        GuestLinkEntity activeGuestLink = GuestLinkEntity.builder()
            .id(1L)
            .projectId(1L)
            .token("active-secret-token")
            .isRevoked(false)
            .expiresAt(future)
            .build();
        when(guestLinkRepository.findByProjectIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(activeGuestLink));

        OwnerCandidateResponse candidate = new OwnerCandidateResponse("11", "Manager Name", "manager.user");
        when(adminProjectOwnerService.findOwnerCandidates(1L, 10L)).thenReturn(List.of(candidate));

        AdminWorkspaceDetailResponse detail = adminWorkspaceService.getWorkspaceDetail(1L);

        assertThat(detail.id()).isEqualTo("1");
        assertThat(detail.owner().ownerId()).isEqualTo("10");
        assertThat(detail.owner().ownerName()).isEqualTo("Alex Kim");
        assertThat(detail.owner().ownerMaskedEmail()).isEqualTo("a***@pipeline.engine");

        // Đủ 4 khóa role
        assertThat(detail.membersByRole()).containsOnlyKeys("OWNER", "MANAGER", "COLLABORATOR", "VIEWER");
        assertThat(detail.membersByRole().get("OWNER")).isEqualTo(1);
        assertThat(detail.membersByRole().get("MANAGER")).isEqualTo(1);
        assertThat(detail.membersByRole().get("COLLABORATOR")).isEqualTo(0);
        assertThat(detail.membersByRole().get("VIEWER")).isEqualTo(0);

        assertThat(detail.pendingInvitationCount()).isEqualTo(2);
        assertThat(detail.phaseCount()).isEqualTo(1);
        assertThat(detail.nodeCount()).isEqualTo(5);

        // Đủ 5 khóa status
        assertThat(detail.nodesByStatus()).containsOnlyKeys("LOCKED", "TODO", "IN_PROGRESS", "REVIEW", "DONE");
        assertThat(detail.nodesByStatus().get("LOCKED")).isEqualTo(1);
        assertThat(detail.nodesByStatus().get("TODO")).isEqualTo(1);
        assertThat(detail.nodesByStatus().get("IN_PROGRESS")).isEqualTo(1);
        assertThat(detail.nodesByStatus().get("REVIEW")).isEqualTo(1);
        assertThat(detail.nodesByStatus().get("DONE")).isEqualTo(1);

        // Overdue đúng: n1 và n2 (n5 DONE không tính) -> 2
        assertThat(detail.overdueCount()).isEqualTo(2);

        // Guest link active
        assertThat(detail.guestLinkActive()).isTrue();
        assertThat(detail.guestLinkExpiresAt()).isEqualTo(future);

        assertThat(detail.lastActivityAt()).isEqualTo(nodeUpdated);
        assertThat(detail.ownerCandidates()).containsExactly(candidate);
    }

    @Test
    @DisplayName("getWorkspaceDetail: guest link đã thu hồi -> guestLinkActive=false và guestLinkExpiresAt=null")
    void testGetWorkspaceDetail_revokedGuestLink_returnsInactive() {
        when(projectRepository.findById(1L)).thenReturn(Optional.of(project1));
        when(userRepository.findById(10L)).thenReturn(Optional.of(ownerUser));
        when(projectMemberRepository.findByProjectIdAndRemovedAtIsNull(1L)).thenReturn(List.of());
        when(projectInvitationRepository.countByProjectIdAndStatus(1L, InvitationStatus.PENDING)).thenReturn(0L);
        when(workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(1L)).thenReturn(List.of());
        when(nodeRepository.findByProjectId(1L)).thenReturn(List.of());

        GuestLinkEntity revokedLink = GuestLinkEntity.builder()
            .id(1L)
            .projectId(1L)
            .token("revoked-token")
            .isRevoked(true)
            .expiresAt(Instant.now().plus(10, ChronoUnit.DAYS))
            .build();
        when(guestLinkRepository.findByProjectIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(revokedLink));
        when(adminProjectOwnerService.findOwnerCandidates(1L, 10L)).thenReturn(List.of());

        AdminWorkspaceDetailResponse detail = adminWorkspaceService.getWorkspaceDetail(1L);

        assertThat(detail.guestLinkActive()).isFalse();
        assertThat(detail.guestLinkExpiresAt()).isNull();
    }

    @Test
    @DisplayName("serialize detail bằng ObjectMapper: KHÔNG chứa tiêu đề node giả lập và KHÔNG chứa token link khách")
    void testGetWorkspaceDetail_serializationDoesNotContainSensitiveTaskOrTokenData() throws Exception {
        when(projectRepository.findById(1L)).thenReturn(Optional.of(project1));
        when(userRepository.findById(10L)).thenReturn(Optional.of(ownerUser));
        when(projectMemberRepository.findByProjectIdAndRemovedAtIsNull(1L)).thenReturn(List.of());
        when(projectInvitationRepository.countByProjectIdAndStatus(1L, InvitationStatus.PENDING)).thenReturn(0L);
        when(workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(1L)).thenReturn(List.of());

        NodeEntity nodeWithTitle = NodeEntity.builder()
            .id(101L)
            .projectId(1L)
            .title("Database Schema 3NF")
            .description("Nội dung nhạy cảm của dự án")
            .status(NodeStatus.DONE)
            .build();
        when(nodeRepository.findByProjectId(1L)).thenReturn(List.of(nodeWithTitle));

        GuestLinkEntity link = GuestLinkEntity.builder()
            .id(1L)
            .projectId(1L)
            .token("secret-guest-token-12345-never-expose")
            .isRevoked(false)
            .expiresAt(Instant.now().plus(5, ChronoUnit.DAYS))
            .build();
        when(guestLinkRepository.findByProjectIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(link));
        when(adminProjectOwnerService.findOwnerCandidates(1L, 10L)).thenReturn(List.of());

        AdminWorkspaceDetailResponse detail = adminWorkspaceService.getWorkspaceDetail(1L);

        ObjectMapper objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
        String json = objectMapper.writeValueAsString(detail);

        // Xác minh chỉ trả metadata, tuyệt đối KHÔNG chứa tiêu đề task, mô tả task, hay token link khách
        assertThat(json).doesNotContain("Database Schema 3NF");
        assertThat(json).doesNotContain("Nội dung nhạy cảm của dự án");
        assertThat(json).doesNotContain("secret-guest-token-12345-never-expose");

        // Nhưng chứa thông tin metadata
        assertThat(json).contains("\"nodeCount\":1");
        assertThat(json).contains("\"progressPercentage\":100");
        assertThat(json).contains("\"guestLinkActive\":true");
    }
}
