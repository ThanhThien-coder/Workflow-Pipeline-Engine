package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.ArtifactType;
import com.pipeline.wpe.common.enums.FeedbackStatus;
import com.pipeline.wpe.common.enums.JoinPolicy;
import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.common.enums.ProjectStatus;
import com.pipeline.wpe.dto.response.graph.DependencyResponse;
import com.pipeline.wpe.dto.response.graph.PhaseResponse;
import com.pipeline.wpe.dto.response.graph.WorkflowGraphResponse;
import com.pipeline.wpe.dto.response.guest.GuestAccessResponse;
import com.pipeline.wpe.dto.response.guest.GuestOverviewResponse;
import com.pipeline.wpe.dto.response.guest.GuestReportResponse;
import com.pipeline.wpe.entity.ArtifactEntity;
import com.pipeline.wpe.entity.GuestLinkEntity;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.ProjectMemberEntity;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.entity.WorkPhaseEntity;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.repository.ArtifactRepository;
import com.pipeline.wpe.repository.GuestLinkRepository;
import com.pipeline.wpe.repository.NodeDependencyRepository;
import com.pipeline.wpe.entity.NodeDependencyEntity;
import com.pipeline.wpe.repository.NodeRepository;
import com.pipeline.wpe.repository.ProjectFeedbackRepository;
import com.pipeline.wpe.repository.UserRepository;
import com.pipeline.wpe.repository.WorkPhaseRepository;
import com.pipeline.wpe.security.CurrentUserProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GuestGatewayServiceTest {

    @Mock
    private GuestLinkRepository guestLinkRepository;

    @Mock
    private NodeRepository nodeRepository;

    @Mock
    private ArtifactRepository artifactRepository;

    @Mock
    private WorkPhaseRepository workPhaseRepository;

    @Mock
    private ProjectAuthorizationService authorizationService;

    @Mock
    private CurrentUserProvider currentUserProvider;

    @Mock
    private UserRepository userRepository;

    @Mock
    private NodeDependencyRepository nodeDependencyRepository;

    @Mock
    private com.pipeline.wpe.repository.ProjectMemberRepository projectMemberRepository;

    @Mock
    private ProjectFeedbackRepository projectFeedbackRepository;

    @Mock
    private WorkflowGraphService workflowGraphService;

    @InjectMocks
    private GuestGatewayService guestGatewayService;

    private final Long projectId = 1L;
    private final Long ownerId = 2L;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(guestGatewayService, "frontendBaseUrl", "http://localhost:5173");
    }

    @Test
    @DisplayName("7.1 Generate Guest Token - Owner sinh token thành công")
    void testGenerateGuestToken_Success() {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(ownerId);
        when(authorizationService.verifyProjectOwner(projectId, ownerId)).thenReturn(new ProjectEntity());
        when(guestLinkRepository.findByProjectIdAndIsRevokedFalse(projectId)).thenReturn(Optional.empty());

        when(guestLinkRepository.save(any(GuestLinkEntity.class))).thenAnswer(invocation -> {
            GuestLinkEntity entity = invocation.getArgument(0);
            entity.setId(10L);
            return entity;
        });

        GuestAccessResponse response = guestGatewayService.generateOrRenewGuestToken(projectId, 30);

        assertThat(response.enabled()).isTrue();
        assertThat(response.status()).isEqualTo(GuestAccessResponse.Status.ACTIVE);
        assertThat(response.token()).hasSize(64);
        assertThat(response.shareUrl()).isEqualTo("http://localhost:5173/guest?token=" + response.token());
        assertThat(response.expiresAt()).isAfter(Instant.now());
        verify(guestLinkRepository).save(any(GuestLinkEntity.class));
    }

    @Test
    @DisplayName("7.1 Revoke Guest Token - Owner thu hồi token thành công")
    void testRevokeGuestToken_Success() {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(ownerId);
        when(authorizationService.verifyProjectOwner(projectId, ownerId)).thenReturn(new ProjectEntity());

        GuestLinkEntity activeLink = GuestLinkEntity.builder()
            .id(10L)
            .projectId(projectId)
            .token("token123")
            .isRevoked(false)
            .expiresAt(Instant.now().plus(10, ChronoUnit.DAYS))
            .build();
        when(guestLinkRepository.findByProjectIdAndIsRevokedFalse(projectId)).thenReturn(Optional.of(activeLink));

        GuestAccessResponse response = guestGatewayService.revokeGuestToken(projectId);

        assertThat(response.enabled()).isFalse();
        assertThat(response.status()).isEqualTo(GuestAccessResponse.Status.REVOKED);
        assertThat(response.token()).isNull();
        assertThat(activeLink.getIsRevoked()).isTrue();
        verify(guestLinkRepository).save(activeLink);
    }


    @Test
    @DisplayName("Overview: hoạt động gần đây mang avatarUrl của người được giao, null khi không có ảnh hoặc chưa giao")
    void testGetGuestOverview_recentActivityIncludesAvatar() {
        String token = "example-guest-token-avatar";
        GuestLinkEntity link = GuestLinkEntity.builder().projectId(projectId).token(token).isRevoked(false)
            .expiresAt(Instant.now().plus(5, ChronoUnit.DAYS)).build();
        ProjectEntity project = ProjectEntity.builder().id(projectId).name("Test Pipeline")
            .ownerId(ownerId).status(ProjectStatus.ACTIVE).build();
        Instant created = Instant.now().minus(3, ChronoUnit.DAYS);
        NodeEntity withAvatar = NodeEntity.builder().id(1L).projectId(projectId).status(NodeStatus.DONE)
            .code("WPE-1").title("Task 1").assignedUserId(7L).createdAt(created).updatedAt(created.plusSeconds(3600)).build();
        NodeEntity noAvatar = NodeEntity.builder().id(2L).projectId(projectId).status(NodeStatus.IN_PROGRESS)
            .code("WPE-2").title("Task 2").assignedUserId(8L).createdAt(created).updatedAt(created.plusSeconds(7200)).build();
        NodeEntity unassigned = NodeEntity.builder().id(3L).projectId(projectId).status(NodeStatus.TODO)
            .code("WPE-3").title("Task 3").createdAt(created).updatedAt(created.plusSeconds(100)).build();
        UserEntity u7 = UserEntity.builder().id(7L).username("alex").avatarUrl("/uploads/avatars/example-alex.png").build();
        UserEntity u8 = UserEntity.builder().id(8L).username("sarah").build();

        when(guestLinkRepository.findByToken(token)).thenReturn(Optional.of(link));
        when(authorizationService.getProjectOrThrow(projectId)).thenReturn(project);
        when(nodeRepository.findByProjectId(projectId)).thenReturn(List.of(withAvatar, noAvatar, unassigned));
        when(artifactRepository.findByProjectIdAndIsPublicForGuestTrue(projectId)).thenReturn(List.of());
        when(workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(projectId)).thenReturn(List.of());
        when(userRepository.findAllById(any())).thenReturn(List.of(u7, u8));

        GuestOverviewResponse overview = guestGatewayService.getGuestOverview(token);

        List<GuestOverviewResponse.GuestActivityDto> acts = overview.recentActivity();
        assertThat(acts).hasSize(3);
        assertThat(acts.stream().filter(a -> a.actor().equals("WPE-1")).findFirst().orElseThrow().avatarUrl())
            .isEqualTo("/uploads/avatars/example-alex.png");
        assertThat(acts.stream().filter(a -> a.actor().equals("WPE-2")).findFirst().orElseThrow().avatarUrl()).isNull();
        assertThat(acts.stream().filter(a -> a.actor().equals("WPE-3")).findFirst().orElseThrow().avatarUrl()).isNull();
    }
    @Test
    @DisplayName("7.2 Get Guest Overview - Token hợp lệ trả về tổng quan dự án")
    void testGetGuestOverview_Success() {
        String token = "example-guest-token-overview";
        GuestLinkEntity link = GuestLinkEntity.builder()
            .projectId(projectId)
            .token(token)
            .isRevoked(false)
            .expiresAt(Instant.now().plus(5, ChronoUnit.DAYS))
            .build();

        ProjectEntity project = ProjectEntity.builder()
            .id(projectId)
            .name("Test Pipeline")
            .ownerId(ownerId)
            .status(ProjectStatus.ACTIVE)
            .build();

        NodeEntity node1 = NodeEntity.builder().id(1L).projectId(projectId).status(NodeStatus.DONE).code("WPE-1").title("Task 1").build();
        NodeEntity node2 = NodeEntity.builder().id(2L).projectId(projectId).status(NodeStatus.IN_PROGRESS).code("WPE-2").title("Task 2").build();

        ArtifactEntity artifact = ArtifactEntity.builder().id(5L).projectId(projectId).name("Doc").url("https://doc.url").isPublicForGuest(true).build();

        when(guestLinkRepository.findByToken(token)).thenReturn(Optional.of(link));
        when(authorizationService.getProjectOrThrow(projectId)).thenReturn(project);
        when(nodeRepository.findByProjectId(projectId)).thenReturn(List.of(node1, node2));
        when(artifactRepository.findByProjectIdAndIsPublicForGuestTrue(projectId)).thenReturn(List.of(artifact));
        when(workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(projectId)).thenReturn(List.of());

        GuestOverviewResponse overview = guestGatewayService.getGuestOverview(token);

        assertThat(overview.projectName()).isEqualTo("Test Pipeline");
        assertThat(overview.totalNodes()).isEqualTo(2);
        assertThat(overview.completedNodes()).isEqualTo(1);
        assertThat(overview.completionPct()).isEqualTo(50.0);
        assertThat(overview.publicArtifacts()).hasSize(1);
    }

    @Test
    @DisplayName("Overview: criticalNodes dung dinh nghia chung (chuoi phu thuoc node dai nhat)")
    void testGetGuestOverview_criticalNodesUsesSharedDefinition() {
        String token = "example-guest-token-critical";
        GuestLinkEntity link = GuestLinkEntity.builder().projectId(projectId).token(token).isRevoked(false)
            .expiresAt(Instant.now().plus(5, ChronoUnit.DAYS)).build();
        ProjectEntity project = ProjectEntity.builder().id(projectId).name("Test Pipeline")
            .ownerId(ownerId).status(ProjectStatus.ACTIVE).build();
        List<NodeEntity> nodes = List.of(
            NodeEntity.builder().id(1L).projectId(projectId).status(NodeStatus.DONE).code("WPE-1").title("A").build(),
            NodeEntity.builder().id(2L).projectId(projectId).status(NodeStatus.TODO).code("WPE-2").title("B").build(),
            NodeEntity.builder().id(3L).projectId(projectId).status(NodeStatus.LOCKED).code("WPE-3").title("C").build(),
            NodeEntity.builder().id(4L).projectId(projectId).status(NodeStatus.LOCKED).code("WPE-4").title("D").build(),
            NodeEntity.builder().id(5L).projectId(projectId).status(NodeStatus.LOCKED).code("WPE-5").title("E").build());
        when(guestLinkRepository.findByToken(token)).thenReturn(Optional.of(link));
        when(authorizationService.getProjectOrThrow(projectId)).thenReturn(project);
        when(nodeRepository.findByProjectId(projectId)).thenReturn(nodes);
        when(nodeDependencyRepository.findByProjectId(projectId)).thenReturn(List.of(
            NodeDependencyEntity.builder().projectId(projectId).parentNodeId(1L).childNodeId(2L).build(),
            NodeDependencyEntity.builder().projectId(projectId).parentNodeId(2L).childNodeId(3L).build()));
        when(artifactRepository.findByProjectIdAndIsPublicForGuestTrue(projectId)).thenReturn(List.of());
        when(workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(projectId)).thenReturn(List.of());

        GuestOverviewResponse overview = guestGatewayService.getGuestOverview(token);

        assertThat(overview.criticalNodes()).isEqualTo(3);
    }

    @Test
    @DisplayName("Overview: nhan phase la dung ten phase, khong ghep so thu tu (truoc day hien '0. Phase One')")
    void testGetGuestOverview_phaseLabelIsPlainName() {
        String token = "example-guest-token-phase";
        GuestLinkEntity link = GuestLinkEntity.builder().projectId(projectId).token(token).isRevoked(false)
            .expiresAt(Instant.now().plus(5, ChronoUnit.DAYS)).build();
        ProjectEntity project = ProjectEntity.builder().id(projectId).name("Test Pipeline")
            .ownerId(ownerId).status(ProjectStatus.ACTIVE).build();
        when(guestLinkRepository.findByToken(token)).thenReturn(Optional.of(link));
        when(authorizationService.getProjectOrThrow(projectId)).thenReturn(project);
        when(nodeRepository.findByProjectId(projectId)).thenReturn(List.of());
        when(artifactRepository.findByProjectIdAndIsPublicForGuestTrue(projectId)).thenReturn(List.of());
        when(workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(projectId)).thenReturn(List.of(
            com.pipeline.wpe.entity.WorkPhaseEntity.builder().projectId(projectId).name("Phase One").orderIndex(0).build()));

        GuestOverviewResponse overview = guestGatewayService.getGuestOverview(token);

        assertThat(overview.phaseLabel()).isEqualTo("Phase One");
    }

    @Test
    @DisplayName("7.2 Get Guest Overview - Token bị thu hồi ném ForbiddenException REVOKED_GUEST")
    void testGetGuestOverview_RevokedToken() {
        String token = "revokedtoken";
        GuestLinkEntity revokedLink = GuestLinkEntity.builder()
            .projectId(projectId)
            .token(token)
            .isRevoked(true)
            .expiresAt(Instant.now().plus(5, ChronoUnit.DAYS))
            .build();

        when(guestLinkRepository.findByToken(token)).thenReturn(Optional.of(revokedLink));

        assertThatThrownBy(() -> guestGatewayService.getGuestOverview(token))
            .isInstanceOf(ForbiddenException.class)
            .hasMessageContaining("revoked");
    }

    @Test
    @DisplayName("7.2 Get Guest Overview - Token hết hạn ném ForbiddenException REVOKED_GUEST")
    void testGetGuestOverview_ExpiredToken() {
        String token = "expiredtoken";
        GuestLinkEntity expiredLink = GuestLinkEntity.builder()
            .projectId(projectId)
            .token(token)
            .isRevoked(false)
            .expiresAt(Instant.now().minus(1, ChronoUnit.DAYS))
            .build();

        when(guestLinkRepository.findByToken(token)).thenReturn(Optional.of(expiredLink));

        assertThatThrownBy(() -> guestGatewayService.getGuestOverview(token))
            .isInstanceOf(ForbiddenException.class)
            .hasMessageContaining("expired");
    }

    @Test
    @DisplayName("G25: dự án DRAFT / PLANNING / PAUSED vẫn cho khách xem (chỉ chặn ARCHIVED)")
    void testGetGuestOverview_NonArchivedStatusesAllowed() {
        for (ProjectStatus status : List.of(ProjectStatus.DRAFT, ProjectStatus.PLANNING, ProjectStatus.PAUSED)) {
            String token = "example-guest-token-" + status.name().toLowerCase();
            GuestLinkEntity link = GuestLinkEntity.builder()
                .projectId(projectId)
                .token(token)
                .isRevoked(false)
                .expiresAt(Instant.now().plus(5, ChronoUnit.DAYS))
                .build();

            ProjectEntity project = ProjectEntity.builder()
                .id(projectId)
                .name(status.name() + " Project")
                .status(status)
                .build();

            when(guestLinkRepository.findByToken(token)).thenReturn(Optional.of(link));
            when(authorizationService.getProjectOrThrow(projectId)).thenReturn(project);

            GuestOverviewResponse overview = guestGatewayService.getGuestOverview(token);
            assertThat(overview.projectName()).isEqualTo(status.name() + " Project");
            // 7 ngày gần nhất, nhãn tiếng Anh
            assertThat(overview.velocity()).hasSize(7);
        }
    }

    @Test
    @DisplayName("7.2 Get Guest Overview - Dự án ARCHIVED ném ForbiddenException REVOKED_GUEST")
    void testGetGuestOverview_ProjectArchived() {
        String token = "example-guest-token-archived";
        GuestLinkEntity link = GuestLinkEntity.builder()
            .projectId(projectId)
            .token(token)
            .isRevoked(false)
            .expiresAt(Instant.now().plus(5, ChronoUnit.DAYS))
            .build();

        ProjectEntity project = ProjectEntity.builder()
            .id(projectId)
            .name("Archived Project")
            .status(ProjectStatus.ARCHIVED)
            .build();

        when(guestLinkRepository.findByToken(token)).thenReturn(Optional.of(link));
        when(authorizationService.getProjectOrThrow(projectId)).thenReturn(project);

        assertThatThrownBy(() -> guestGatewayService.getGuestOverview(token))
            .isInstanceOf(ForbiddenException.class)
            .satisfies(ex -> assertThat(((ForbiddenException) ex).getErrorCode()).isEqualTo("REVOKED_GUEST"))
            .hasMessageContaining("archived");
    }

    @Test
    @DisplayName("7.1 Generate Guest Token - Không phải Owner ném ForbiddenException ACCESS_DENIED")
    void testGenerateGuestToken_AccessDenied() {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(ownerId);
        when(authorizationService.verifyProjectOwner(projectId, ownerId))
            .thenThrow(new ForbiddenException("ACCESS_DENIED", "Chỉ Chủ dự án mới có quyền thực hiện."));

        assertThatThrownBy(() -> guestGatewayService.generateOrRenewGuestToken(projectId, 30))
            .isInstanceOf(ForbiddenException.class)
            .satisfies(ex -> assertThat(((ForbiddenException) ex).getErrorCode()).isEqualTo("ACCESS_DENIED"));

        verify(guestLinkRepository, never()).save(any());
    }

    @Test
    @DisplayName("7.1 Revoke Guest Token - Không phải Owner ném ForbiddenException ACCESS_DENIED")
    void testRevokeGuestToken_AccessDenied() {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(ownerId);
        when(authorizationService.verifyProjectOwner(projectId, ownerId))
            .thenThrow(new ForbiddenException("ACCESS_DENIED", "Chỉ Chủ dự án mới có quyền thực hiện."));

        assertThatThrownBy(() -> guestGatewayService.revokeGuestToken(projectId))
            .isInstanceOf(ForbiddenException.class)
            .satisfies(ex -> assertThat(((ForbiddenException) ex).getErrorCode()).isEqualTo("ACCESS_DENIED"));

        verify(guestLinkRepository, never()).save(any());
    }

    @Test
    @DisplayName("7.1 Get Guest Access State - Thành công xác thực đúng verifyProjectOwner")
    void testGetGuestAccessState_Success() {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(ownerId);
        when(authorizationService.verifyProjectOwner(projectId, ownerId)).thenReturn(new ProjectEntity());

        GuestLinkEntity activeLink = GuestLinkEntity.builder()
            .projectId(projectId)
            .token("active-token-123")
            .isRevoked(false)
            .expiresAt(Instant.now().plus(5, ChronoUnit.DAYS))
            .build();
        when(guestLinkRepository.findByProjectIdAndIsRevokedFalse(projectId)).thenReturn(Optional.of(activeLink));

        GuestAccessResponse response = guestGatewayService.getGuestAccessState(projectId);

        assertThat(response.enabled()).isTrue();
        assertThat(response.token()).isEqualTo("active-token-123");
        assertThat(response.shareUrl()).isEqualTo("http://localhost:5173/guest?token=active-token-123");
        assertThat(response.status()).isEqualTo(GuestAccessResponse.Status.ACTIVE);
        verify(authorizationService).verifyProjectOwner(projectId, ownerId);
        verify(authorizationService, never()).verifyProjectMemberOrOwner(any(), any());
    }

    @Test
    @DisplayName("Revoke Guest Token - không có link nào để thu hồi trả NONE")
    void testRevokeGuestToken_NothingToRevoke() {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(ownerId);
        when(authorizationService.verifyProjectOwner(projectId, ownerId)).thenReturn(new ProjectEntity());
        when(guestLinkRepository.findByProjectIdAndIsRevokedFalse(projectId)).thenReturn(Optional.empty());

        GuestAccessResponse response = guestGatewayService.revokeGuestToken(projectId);

        assertThat(response.status()).isEqualTo(GuestAccessResponse.Status.NONE);
        assertThat(response.enabled()).isFalse();
        verify(guestLinkRepository, never()).save(any());
    }

    @Test
    @DisplayName("Get Guest Access State - link chưa thu hồi nhưng hết hạn trả EXPIRED, không lộ token")
    void testGetGuestAccessState_Expired() {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(ownerId);
        when(authorizationService.verifyProjectOwner(projectId, ownerId)).thenReturn(new ProjectEntity());
        Instant expiredAt = Instant.now().minus(2, ChronoUnit.DAYS);
        GuestLinkEntity expiredLink = GuestLinkEntity.builder()
            .projectId(projectId).token("expired-token").isRevoked(false).expiresAt(expiredAt).build();
        when(guestLinkRepository.findByProjectIdAndIsRevokedFalse(projectId)).thenReturn(Optional.of(expiredLink));

        GuestAccessResponse response = guestGatewayService.getGuestAccessState(projectId);

        assertThat(response.status()).isEqualTo(GuestAccessResponse.Status.EXPIRED);
        assertThat(response.enabled()).isFalse();
        assertThat(response.token()).isNull();
        assertThat(response.shareUrl()).isNull();
        assertThat(response.expiresAt()).isEqualTo(expiredAt);
    }

    @Test
    @DisplayName("Get Guest Access State - link mới nhất đã thu hồi trả REVOKED")
    void testGetGuestAccessState_Revoked() {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(ownerId);
        when(authorizationService.verifyProjectOwner(projectId, ownerId)).thenReturn(new ProjectEntity());
        when(guestLinkRepository.findByProjectIdAndIsRevokedFalse(projectId)).thenReturn(Optional.empty());
        GuestLinkEntity revokedLink = GuestLinkEntity.builder()
            .projectId(projectId).token("revoked-token").isRevoked(true)
            .expiresAt(Instant.now().plus(5, ChronoUnit.DAYS)).build();
        when(guestLinkRepository.findFirstByProjectIdOrderByCreatedAtDesc(projectId)).thenReturn(Optional.of(revokedLink));

        GuestAccessResponse response = guestGatewayService.getGuestAccessState(projectId);

        assertThat(response.status()).isEqualTo(GuestAccessResponse.Status.REVOKED);
        assertThat(response.enabled()).isFalse();
        assertThat(response.token()).isNull();
        assertThat(response.shareUrl()).isNull();
    }

    @Test
    @DisplayName("Get Guest Access State - chưa từng tạo link trả NONE")
    void testGetGuestAccessState_None() {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(ownerId);
        when(authorizationService.verifyProjectOwner(projectId, ownerId)).thenReturn(new ProjectEntity());
        when(guestLinkRepository.findByProjectIdAndIsRevokedFalse(projectId)).thenReturn(Optional.empty());
        when(guestLinkRepository.findFirstByProjectIdOrderByCreatedAtDesc(projectId)).thenReturn(Optional.empty());

        GuestAccessResponse response = guestGatewayService.getGuestAccessState(projectId);

        assertThat(response.status()).isEqualTo(GuestAccessResponse.Status.NONE);
        assertThat(response.enabled()).isFalse();
        assertThat(response.token()).isNull();
    }

    @Test
    @DisplayName("7.1 Get Guest Access State - Không phải Owner ném ForbiddenException ACCESS_DENIED")
    void testGetGuestAccessState_AccessDenied() {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(ownerId);
        when(authorizationService.verifyProjectOwner(projectId, ownerId))
            .thenThrow(new ForbiddenException("ACCESS_DENIED", "Chỉ Chủ dự án mới có quyền thực hiện."));

        assertThatThrownBy(() -> guestGatewayService.getGuestAccessState(projectId))
            .isInstanceOf(ForbiddenException.class)
            .satisfies(ex -> assertThat(((ForbiddenException) ex).getErrorCode()).isEqualTo("ACCESS_DENIED"));

        verify(authorizationService).verifyProjectOwner(projectId, ownerId);
        verify(authorizationService, never()).verifyProjectMemberOrOwner(any(), any());
        verify(guestLinkRepository, never()).save(any());
    }

    private GuestLinkEntity activeLink(String token) {
        return GuestLinkEntity.builder().projectId(projectId).token(token).isRevoked(false)
            .expiresAt(Instant.now().plus(5, ChronoUnit.DAYS)).build();
    }

    @Test
    @DisplayName("S08: overview co phases theo orderIndex (2 phase), %, so task, memberCount khong dem trung owner")
    void testGetGuestOverview_phasesAndMemberCount() {
        String token = "example-guest-token-s08";
        ProjectEntity project = ProjectEntity.builder().id(projectId).name("P").ownerId(ownerId)
            .status(ProjectStatus.ACTIVE).build();
        com.pipeline.wpe.entity.WorkPhaseEntity ph1 = com.pipeline.wpe.entity.WorkPhaseEntity.builder()
            .id(10L).projectId(projectId).name("PHASE 1").subTitle("Design").orderIndex(0).build();
        com.pipeline.wpe.entity.WorkPhaseEntity ph2 = com.pipeline.wpe.entity.WorkPhaseEntity.builder()
            .id(11L).projectId(projectId).name("Build").orderIndex(1).build();
        List<NodeEntity> nodes = List.of(
            NodeEntity.builder().id(1L).projectId(projectId).phaseId(10L).status(NodeStatus.DONE).code("A-1").title("a").build(),
            NodeEntity.builder().id(2L).projectId(projectId).phaseId(10L).status(NodeStatus.DONE).code("A-2").title("b").build(),
            NodeEntity.builder().id(3L).projectId(projectId).phaseId(11L).status(NodeStatus.DONE).code("B-1").title("c").build(),
            NodeEntity.builder().id(4L).projectId(projectId).phaseId(11L).status(NodeStatus.IN_PROGRESS).code("B-2").title("d").build(),
            NodeEntity.builder().id(5L).projectId(projectId).phaseId(11L).status(NodeStatus.LOCKED).code("B-3").title("e").build());
        when(guestLinkRepository.findByToken(token)).thenReturn(Optional.of(activeLink(token)));
        when(authorizationService.getProjectOrThrow(projectId)).thenReturn(project);
        when(nodeRepository.findByProjectId(projectId)).thenReturn(nodes);
        when(artifactRepository.findByProjectIdAndIsPublicForGuestTrue(projectId)).thenReturn(List.of());
        when(workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(projectId)).thenReturn(List.of(ph1, ph2));
        when(projectMemberRepository.findByProjectIdAndRemovedAtIsNull(projectId)).thenReturn(List.of(
            com.pipeline.wpe.entity.ProjectMemberEntity.builder().projectId(projectId).userId(ownerId).build(),
            com.pipeline.wpe.entity.ProjectMemberEntity.builder().projectId(projectId).userId(7L).build(),
            com.pipeline.wpe.entity.ProjectMemberEntity.builder().projectId(projectId).userId(8L).build()));

        GuestOverviewResponse overview = guestGatewayService.getGuestOverview(token);

        assertThat(overview.memberCount()).isEqualTo(3);
        assertThat(overview.phases()).hasSize(2);
        GuestOverviewResponse.GuestPhaseDto first = overview.phases().get(0);
        assertThat(first.name()).isEqualTo("Design");
        assertThat(first.status()).isEqualTo("COMPLETED");
        assertThat(first.progressPct()).isEqualTo(100);
        assertThat(first.totalTasks()).isEqualTo(2);
        assertThat(first.doneTasks()).isEqualTo(2);
        GuestOverviewResponse.GuestPhaseDto second = overview.phases().get(1);
        assertThat(second.name()).isEqualTo("Build");
        assertThat(second.status()).isEqualTo("IN_PROGRESS");
        assertThat(second.progressPct()).isEqualTo(33);
        assertThat(second.totalTasks()).isEqualTo(3);
        assertThat(second.doneTasks()).isEqualTo(1);
        assertThat(overview.phases().toString()).doesNotContain("@");
    }

    @Test
    @DisplayName("S08: phase con (tao bang nut +, co parentPhaseId) hien thanh dong rieng voi task cua chinh no, khong gop vao phase cha")
    void testGetGuestOverview_childPhaseListedSeparately() {
        String token = "example-guest-token-s08-child";
        ProjectEntity project = ProjectEntity.builder().id(projectId).name("P").ownerId(ownerId)
            .status(ProjectStatus.ACTIVE).build();
        com.pipeline.wpe.entity.WorkPhaseEntity parent = com.pipeline.wpe.entity.WorkPhaseEntity.builder()
            .id(20L).projectId(projectId).name("Design").orderIndex(0).build();
        com.pipeline.wpe.entity.WorkPhaseEntity child = com.pipeline.wpe.entity.WorkPhaseEntity.builder()
            .id(21L).projectId(projectId).parentPhaseId(20L).name("Build").orderIndex(1).build();
        List<NodeEntity> nodes = List.of(
            NodeEntity.builder().id(1L).projectId(projectId).phaseId(20L).status(NodeStatus.DONE).code("A-1").title("a").build(),
            NodeEntity.builder().id(2L).projectId(projectId).phaseId(21L).status(NodeStatus.LOCKED).code("B-1").title("b").build(),
            NodeEntity.builder().id(3L).projectId(projectId).phaseId(21L).status(NodeStatus.LOCKED).code("B-2").title("c").build());
        when(guestLinkRepository.findByToken(token)).thenReturn(Optional.of(activeLink(token)));
        when(authorizationService.getProjectOrThrow(projectId)).thenReturn(project);
        when(nodeRepository.findByProjectId(projectId)).thenReturn(nodes);
        when(artifactRepository.findByProjectIdAndIsPublicForGuestTrue(projectId)).thenReturn(List.of());
        when(workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(projectId)).thenReturn(List.of(parent, child));
        when(projectMemberRepository.findByProjectIdAndRemovedAtIsNull(projectId)).thenReturn(List.of());

        GuestOverviewResponse overview = guestGatewayService.getGuestOverview(token);

        assertThat(overview.phases()).hasSize(2);
        assertThat(overview.phases().get(0).name()).isEqualTo("Design");
        assertThat(overview.phases().get(0).totalTasks()).isEqualTo(1);
        assertThat(overview.phases().get(0).status()).isEqualTo("COMPLETED");
        assertThat(overview.phases().get(1).name()).isEqualTo("Build");
        assertThat(overview.phases().get(1).totalTasks()).isEqualTo(2);
        assertThat(overview.phases().get(1).status()).isEqualTo("LOCKED");
    }

    @Test
    @DisplayName("S08: ai-summary co phan tich da luu -> dung khuon, risks bo muc LOW")
    void testGetGuestAiSummary_success() {
        String token = "example-guest-token-ai";
        java.util.Map<String, Object> analysis = new java.util.LinkedHashMap<>();
        analysis.put("analyzedAt", "2026-11-19T01:00:00Z");
        analysis.put("metrics", java.util.Map.of("status", "RED_ALERT"));
        analysis.put("actionableAdvice", List.of(java.util.Map.of("instruction", "Split task WPE-2", "priority", "HIGH")));
        analysis.put("bottlenecks", List.of(
            java.util.Map.of("nodeCode", "WPE-2", "title", "T", "reason", "Too slow", "severity", "HIGH"),
            java.util.Map.of("nodeCode", "WPE-9", "title", "T", "reason", "On track", "severity", "LOW")));
        analysis.put("taskTraps", List.of(java.util.Map.of("nodeCode", "WPE-3", "trapType", "OVER_SCOPED", "suggestion", "Break it down")));
        ProjectEntity project = ProjectEntity.builder().id(projectId).name("P").ownerId(ownerId)
            .status(ProjectStatus.ACTIVE).latestAiAnalysis(analysis).build();
        Instant now = Instant.now();
        NodeEntity doneRecent = NodeEntity.builder().id(1L).projectId(projectId).status(NodeStatus.DONE).code("WPE-1").title("a").completedAt(now.minusSeconds(3600)).build();
        NodeEntity doneOld = NodeEntity.builder().id(2L).projectId(projectId).status(NodeStatus.DONE).code("WPE-4").title("b").completedAt(now.minus(30, ChronoUnit.DAYS)).build();
        NodeEntity open = NodeEntity.builder().id(3L).projectId(projectId).status(NodeStatus.TODO).code("WPE-2").title("c").build();
        when(guestLinkRepository.findByToken(token)).thenReturn(Optional.of(activeLink(token)));
        when(authorizationService.getProjectOrThrow(projectId)).thenReturn(project);
        when(nodeRepository.findByProjectId(projectId)).thenReturn(List.of(doneRecent, doneOld, open));

        var summary = guestGatewayService.getGuestAiSummary(token).orElseThrow();

        assertThat(summary.content()).isEqualTo("Project health: red alert. 1 task was completed in the last 7 days; 1 task remains.");
        assertThat(summary.highlights()).containsExactly("Split task WPE-2");
        assertThat(summary.risks()).containsExactly("WPE-2: Too slow", "WPE-3: Break it down");
        assertThat(summary.generatedAt()).isEqualTo("2026-11-19T01:00:00Z");
    }

    @Test
    @DisplayName("S08: ai-summary chua co phan tich -> Optional rong (controller tra 404)")
    void testGetGuestAiSummary_noAnalysis() {
        String token = "example-guest-token-noai";
        ProjectEntity project = ProjectEntity.builder().id(projectId).name("P").ownerId(ownerId)
            .status(ProjectStatus.ACTIVE).build();
        when(guestLinkRepository.findByToken(token)).thenReturn(Optional.of(activeLink(token)));
        when(authorizationService.getProjectOrThrow(projectId)).thenReturn(project);

        assertThat(guestGatewayService.getGuestAiSummary(token)).isEmpty();
    }

    @Test
    @DisplayName("S08: ai-summary voi link bi thu hoi -> ForbiddenException REVOKED_GUEST nhu overview")
    void testGetGuestAiSummary_revoked() {
        String token = "revoked-ai";
        GuestLinkEntity link = GuestLinkEntity.builder().projectId(projectId).token(token).isRevoked(true)
            .expiresAt(Instant.now().plus(5, ChronoUnit.DAYS)).build();
        when(guestLinkRepository.findByToken(token)).thenReturn(Optional.of(link));

        assertThatThrownBy(() -> guestGatewayService.getGuestAiSummary(token))
            .isInstanceOfSatisfying(ForbiddenException.class, e -> assertThat(e.getErrorCode()).isEqualTo("REVOKED_GUEST"));
    }

    @Test
    @DisplayName("G1 report: map đầy đủ thông tin node gồm startedAt, completedAt, reopenedAt")
    void testGetGuestOverview_reportMapsNodeFields() {
        String token = "example-guest-token-report-nodes";
        Instant createdAt = Instant.parse("2026-10-03T05:00:00Z");
        Instant startedAt = Instant.parse("2026-11-09T05:00:00Z");
        Instant completedAt = Instant.parse("2026-11-12T05:00:00Z");
        Instant reopenedAt = Instant.parse("2026-11-11T05:00:00Z");
        Instant dueDate = Instant.parse("2026-11-30T05:00:00Z");

        ProjectEntity project = ProjectEntity.builder().id(projectId).name("Report Project").description("Desc")
            .ownerId(ownerId).status(ProjectStatus.ACTIVE).createdAt(createdAt).build();
        WorkPhaseEntity phase = WorkPhaseEntity.builder().id(101L).projectId(projectId).name("Analysis").orderIndex(0).build();
        NodeEntity node = NodeEntity.builder()
            .id(5007L).projectId(projectId).phaseId(101L).code("WPE-07").title("Sequence diagrams")
            .description("Borrow flow").status(NodeStatus.DONE).joinPolicy(JoinPolicy.ALL_COMPLETED)
            .assignedUserId(13L).dueDate(dueDate).estimatedHours(12)
            .createdAt(createdAt).startedAt(startedAt).completedAt(completedAt).reopenedAt(reopenedAt)
            .build();
        NodeDependencyEntity dep = NodeDependencyEntity.builder().projectId(projectId).parentNodeId(5006L).childNodeId(5007L).build();
        PhaseResponse phaseDto = new PhaseResponse("101", "Analysis", null, "indigo", 0, List.of(), "COMPLETED", 100, 1, 1, Map.of());
        WorkflowGraphResponse builtGraph = new WorkflowGraphResponse(
            List.of(phaseDto),
            List.of(List.of("100", "101")),
            List.of(),
            List.of(new DependencyResponse("5006", "5007"))
        );

        when(guestLinkRepository.findByToken(token)).thenReturn(Optional.of(activeLink(token)));
        when(authorizationService.getProjectOrThrow(projectId)).thenReturn(project);
        when(workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(projectId)).thenReturn(List.of(phase));
        when(nodeRepository.findByProjectId(projectId)).thenReturn(List.of(node));
        when(nodeDependencyRepository.findByProjectId(projectId)).thenReturn(List.of(dep));
        when(workflowGraphService.buildGraph(eq(projectId), anyList(), anyList(), anyList(), anyList())).thenReturn(builtGraph);

        GuestReportResponse report = guestGatewayService.getGuestOverview(token).report();

        assertThat(report).isNotNull();
        assertThat(report.graph().phases()).containsExactly(phaseDto);
        assertThat(report.graph().phaseEdges()).containsExactly(List.of("100", "101"));
        assertThat(report.graph().dependencies()).containsExactly(new DependencyResponse("5006", "5007"));
        assertThat(report.graph().nodes()).hasSize(1);
        GuestReportResponse.GuestNodeDto mapped = report.graph().nodes().get(0);
        assertThat(mapped.id()).isEqualTo("5007");
        assertThat(mapped.phaseId()).isEqualTo("101");
        assertThat(mapped.code()).isEqualTo("WPE-07");
        assertThat(mapped.title()).isEqualTo("Sequence diagrams");
        assertThat(mapped.description()).isEqualTo("Borrow flow");
        assertThat(mapped.status()).isEqualTo("DONE");
        assertThat(mapped.joinPolicy()).isEqualTo("ALL_COMPLETED");
        assertThat(mapped.assignedUserId()).isEqualTo("13");
        assertThat(mapped.dueDate()).isEqualTo(dueDate);
        assertThat(mapped.estimatedHours()).isEqualTo(12);
        assertThat(mapped.createdAt()).isEqualTo(createdAt);
        assertThat(mapped.startedAt()).isEqualTo(startedAt);
        assertThat(mapped.completedAt()).isEqualTo(completedAt);
        assertThat(mapped.reopenedAt()).isEqualTo(reopenedAt);
    }

    @Test
    @DisplayName("G1 report: tính isOverdue đúng cho quá hạn, DONE, không có hạn và hạn hôm nay theo giờ VN")
    void testGetGuestOverview_reportIsOverdueFourCases() {
        String token = "example-guest-token-overdue";
        ZoneId vnZone = ZoneId.of("Asia/Ho_Chi_Minh");
        LocalDate todayVn = LocalDate.now(vnZone);
        Instant yesterdayVn = todayVn.minusDays(1).atTime(23, 59).atZone(vnZone).toInstant();
        Instant todayEarlyVn = todayVn.atTime(0, 1).atZone(vnZone).toInstant();

        ProjectEntity project = ProjectEntity.builder().id(projectId).name("P").ownerId(ownerId).status(ProjectStatus.ACTIVE).build();
        NodeEntity overdueNode = NodeEntity.builder().id(1L).projectId(projectId).code("T-1").title("Overdue")
            .status(NodeStatus.IN_PROGRESS).joinPolicy(JoinPolicy.ALL_COMPLETED).dueDate(yesterdayVn).isOverdue(false).build();
        NodeEntity donePastDue = NodeEntity.builder().id(2L).projectId(projectId).code("T-2").title("Done")
            .status(NodeStatus.DONE).joinPolicy(JoinPolicy.ALL_COMPLETED).dueDate(yesterdayVn).isOverdue(true).build();
        NodeEntity noDueDate = NodeEntity.builder().id(3L).projectId(projectId).code("T-3").title("No due")
            .status(NodeStatus.TODO).joinPolicy(JoinPolicy.ALL_COMPLETED).dueDate(null).isOverdue(true).build();
        NodeEntity dueToday = NodeEntity.builder().id(4L).projectId(projectId).code("T-4").title("Today")
            .status(NodeStatus.TODO).joinPolicy(JoinPolicy.ALL_COMPLETED).dueDate(todayEarlyVn).isOverdue(false).build();

        when(guestLinkRepository.findByToken(token)).thenReturn(Optional.of(activeLink(token)));
        when(authorizationService.getProjectOrThrow(projectId)).thenReturn(project);
        when(nodeRepository.findByProjectId(projectId)).thenReturn(List.of(overdueNode, donePastDue, noDueDate, dueToday));
        when(workflowGraphService.buildGraph(eq(projectId), anyList(), anyList(), anyList(), anyList()))
            .thenReturn(new WorkflowGraphResponse(List.of(), List.of(), List.of(), List.of()));

        List<GuestReportResponse.GuestNodeDto> nodes = guestGatewayService.getGuestOverview(token).report().graph().nodes();

        assertThat(nodes).extracting(GuestReportResponse.GuestNodeDto::id, GuestReportResponse.GuestNodeDto::isOverdue)
            .containsExactly(
                org.assertj.core.groups.Tuple.tuple("1", true),
                org.assertj.core.groups.Tuple.tuple("2", false),
                org.assertj.core.groups.Tuple.tuple("3", false),
                org.assertj.core.groups.Tuple.tuple("4", false)
            );
    }

    @Test
    @DisplayName("G1 report: members gồm owner, thành viên (kể cả VIEWER), người đã rời (FORMER) và không lộ email")
    void testGetGuestOverview_reportMembersAndNoEmail() {
        String token = "example-guest-token-members";
        ProjectEntity project = ProjectEntity.builder().id(projectId).name("P").ownerId(ownerId).status(ProjectStatus.ACTIVE).build();
        ProjectMemberEntity activeViewer = ProjectMemberEntity.builder().projectId(projectId).userId(7L).role(ProjectRole.VIEWER).build();
        ProjectMemberEntity activeManager = ProjectMemberEntity.builder().projectId(projectId).userId(8L).role(ProjectRole.MANAGER).build();
        NodeEntity formerTask = NodeEntity.builder().id(1L).projectId(projectId).code("T-1").title("Task")
            .status(NodeStatus.TODO).joinPolicy(JoinPolicy.ALL_COMPLETED).assignedUserId(9L).build();

        UserEntity ownerUser = UserEntity.builder().id(ownerId).username("owner").fullName("An Nguyễn").email("owner@secret.dev").build();
        UserEntity viewerUser = UserEntity.builder().id(7L).username("viewer_acc").fullName("  ").email("viewer@secret.dev").build();
        UserEntity managerUser = UserEntity.builder().id(8L).username("mgr").fullName("Bình Trần").email("mgr@secret.dev").build();
        UserEntity formerUser = UserEntity.builder().id(9L).username("former_acc").fullName("Chi Lê").email("former@secret.dev").build();

        when(guestLinkRepository.findByToken(token)).thenReturn(Optional.of(activeLink(token)));
        when(authorizationService.getProjectOrThrow(projectId)).thenReturn(project);
        when(nodeRepository.findByProjectId(projectId)).thenReturn(List.of(formerTask));
        when(projectMemberRepository.findByProjectIdAndRemovedAtIsNull(projectId)).thenReturn(List.of(activeViewer, activeManager));
        when(userRepository.findAllById(any())).thenReturn(List.of(ownerUser, viewerUser, managerUser, formerUser));
        when(workflowGraphService.buildGraph(eq(projectId), anyList(), anyList(), anyList(), anyList()))
            .thenReturn(new WorkflowGraphResponse(List.of(), List.of(), List.of(), List.of()));

        GuestReportResponse report = guestGatewayService.getGuestOverview(token).report();

        assertThat(report.members()).containsExactly(
            new GuestReportResponse.GuestMemberDto("2", "An Nguyễn", "OWNER"),
            new GuestReportResponse.GuestMemberDto("7", "viewer_acc", "VIEWER"),
            new GuestReportResponse.GuestMemberDto("8", "Bình Trần", "MANAGER"),
            new GuestReportResponse.GuestMemberDto("9", "Chi Lê", "FORMER")
        );
        assertThat(report.members().toString()).doesNotContain("secret.dev").doesNotContain("@");
    }

    @Test
    @DisplayName("G1 report: bỏ artifact url javascript: và không chứa artifact ẩn")
    void testGetGuestOverview_reportArtifactsFiltersUnsafeAndHidden() {
        String token = "example-guest-token-artifacts";
        ProjectEntity project = ProjectEntity.builder().id(projectId).name("P").ownerId(ownerId).status(ProjectStatus.ACTIVE).build();
        Instant created = Instant.parse("2026-11-10T05:00:00Z");

        ArtifactEntity validHttps = ArtifactEntity.builder().id(901L).projectId(projectId).nodeId(5002L)
            .name("SRS").type(null).url("https://docs.google.com/doc").isPublicForGuest(true).createdAt(created).build();
        ArtifactEntity validHttpUpper = ArtifactEntity.builder().id(902L).projectId(projectId).nodeId(null)
            .name("Demo").type(ArtifactType.DOCS).url("HTTP://example.com/demo").isPublicForGuest(true).createdAt(created).build();
        ArtifactEntity jsUrl = ArtifactEntity.builder().id(903L).projectId(projectId).nodeId(5003L)
            .name("XSS").type(ArtifactType.OTHER_LINK).url("javascript:alert(1)").isPublicForGuest(true).createdAt(created).build();
        ArtifactEntity hidden = ArtifactEntity.builder().id(904L).projectId(projectId).nodeId(5004L)
            .name("Internal").type(ArtifactType.DOCS).url("https://internal.example.com").isPublicForGuest(false).createdAt(created).build();

        when(guestLinkRepository.findByToken(token)).thenReturn(Optional.of(activeLink(token)));
        when(authorizationService.getProjectOrThrow(projectId)).thenReturn(project);
        when(artifactRepository.findByProjectIdAndIsPublicForGuestTrue(projectId))
            .thenReturn(List.of(validHttps, validHttpUpper, jsUrl, hidden));
        when(workflowGraphService.buildGraph(eq(projectId), anyList(), anyList(), anyList(), anyList()))
            .thenReturn(new WorkflowGraphResponse(List.of(), List.of(), List.of(), List.of()));

        GuestReportResponse report = guestGatewayService.getGuestOverview(token).report();

        assertThat(report.artifacts()).containsExactly(
            new GuestReportResponse.GuestArtifactDto("901", "SRS", "OTHER_LINK", "https://docs.google.com/doc", "5002", created),
            new GuestReportResponse.GuestArtifactDto("902", "Demo", "DOCS", "HTTP://example.com/demo", null, created)
        );
        verify(artifactRepository, never()).findByProjectId(any());
    }

    @Test
    @DisplayName("G1 report: buildGraph ném RuntimeException thì report == null nhưng overview vẫn giữ projectName")
    void testGetGuestOverview_reportNullWhenBuildGraphThrows() {
        String token = "example-guest-token-buildgraph-fail";
        ProjectEntity project = ProjectEntity.builder().id(projectId).name("Resilient Project")
            .ownerId(ownerId).status(ProjectStatus.ACTIVE).build();
        when(guestLinkRepository.findByToken(token)).thenReturn(Optional.of(activeLink(token)));
        when(authorizationService.getProjectOrThrow(projectId)).thenReturn(project);
        when(workflowGraphService.buildGraph(eq(projectId), anyList(), anyList(), anyList(), anyList()))
            .thenThrow(new RuntimeException("unexpected graph error"));

        GuestOverviewResponse overview = guestGatewayService.getGuestOverview(token);

        assertThat(overview.projectName()).isEqualTo("Resilient Project");
        assertThat(overview.report()).isNull();
    }

    @Test
    @DisplayName("G1 report: linkExpiresAt lấy đúng từ GuestLinkEntity.expiresAt")
    void testGetGuestOverview_reportLinkExpiresAt() {
        String token = "example-guest-token-expiry";
        Instant expiresAt = Instant.parse("2026-12-20T05:00:00Z");
        Instant projectCreated = Instant.parse("2026-10-03T05:00:00Z");
        GuestLinkEntity link = GuestLinkEntity.builder().projectId(projectId).token(token)
            .isRevoked(false).expiresAt(expiresAt).build();
        ProjectEntity project = ProjectEntity.builder().id(projectId).name("Expiry Project")
            .description("Summary").ownerId(ownerId).status(ProjectStatus.ACTIVE).createdAt(projectCreated).build();

        when(guestLinkRepository.findByToken(token)).thenReturn(Optional.of(link));
        when(authorizationService.getProjectOrThrow(projectId)).thenReturn(project);
        when(workflowGraphService.buildGraph(eq(projectId), anyList(), anyList(), anyList(), anyList()))
            .thenReturn(new WorkflowGraphResponse(List.of(), List.of(), List.of(), List.of()));

        GuestReportResponse report = guestGatewayService.getGuestOverview(token).report();

        assertThat(report.serverNow()).isNotNull();
        assertThat(report.project()).isEqualTo(new GuestReportResponse.GuestProjectDto(
            "Expiry Project", "Summary", "ACTIVE", projectCreated, expiresAt
        ));
    }

    @Test
    @DisplayName("G1 report: feedback đếm đúng total và resolved")
    void testGetGuestOverview_reportFeedbackCounts() {
        String token = "example-guest-token-feedback";
        ProjectEntity project = ProjectEntity.builder().id(projectId).name("P").ownerId(ownerId).status(ProjectStatus.ACTIVE).build();
        when(guestLinkRepository.findByToken(token)).thenReturn(Optional.of(activeLink(token)));
        when(authorizationService.getProjectOrThrow(projectId)).thenReturn(project);
        when(projectFeedbackRepository.countByProjectId(projectId)).thenReturn(4L);
        when(projectFeedbackRepository.countByProjectIdAndStatus(projectId, FeedbackStatus.RESOLVED)).thenReturn(3L);
        when(workflowGraphService.buildGraph(eq(projectId), anyList(), anyList(), anyList(), anyList()))
            .thenReturn(new WorkflowGraphResponse(List.of(), List.of(), List.of(), List.of()));

        GuestReportResponse report = guestGatewayService.getGuestOverview(token).report();

        assertThat(report.feedback()).isEqualTo(new GuestReportResponse.GuestFeedbackDto(4L, 3L));
    }
}
