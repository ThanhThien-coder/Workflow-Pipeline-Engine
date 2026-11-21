package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.common.enums.ProjectStatus;
import com.pipeline.wpe.dto.response.guest.GuestAccessResponse;
import com.pipeline.wpe.dto.response.guest.GuestOverviewResponse;
import com.pipeline.wpe.entity.ArtifactEntity;
import com.pipeline.wpe.entity.GuestLinkEntity;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.repository.ArtifactRepository;
import com.pipeline.wpe.repository.GuestLinkRepository;
import com.pipeline.wpe.repository.NodeDependencyRepository;
import com.pipeline.wpe.entity.NodeDependencyEntity;
import com.pipeline.wpe.repository.NodeRepository;
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
import java.time.temporal.ChronoUnit;
import java.util.List;
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
    @DisplayName("G25: dự án DRAFT vẫn cho khách xem (chỉ chặn ARCHIVED)")
    void testGetGuestOverview_NonArchivedStatusesAllowed() {
        for (ProjectStatus status : List.of(ProjectStatus.DRAFT)) {
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
}
