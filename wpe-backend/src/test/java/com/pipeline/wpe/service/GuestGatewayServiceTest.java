package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.dto.response.guest.GuestAccessResponse;
import com.pipeline.wpe.dto.response.guest.GuestOverviewResponse;
import com.pipeline.wpe.entity.ArtifactEntity;
import com.pipeline.wpe.entity.GuestLinkEntity;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.repository.ArtifactRepository;
import com.pipeline.wpe.repository.GuestLinkRepository;
import com.pipeline.wpe.repository.NodeRepository;
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
        assertThat(response.token()).hasSize(64);
        assertThat(response.shareUrl()).contains(response.token());
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
        assertThat(response.token()).isNull();
        assertThat(activeLink.getIsRevoked()).isTrue();
        verify(guestLinkRepository).save(activeLink);
    }

    @Test
    @DisplayName("7.2 Get Guest Overview - Token hợp lệ trả về tổng quan dự án")
    void testGetGuestOverview_Success() {
        String token = "64charstoken01234567890123456789012345678901234567890123456789123456";
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
            .hasMessageContaining("thu hồi");
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
            .hasMessageContaining("hết hạn");
    }
}
