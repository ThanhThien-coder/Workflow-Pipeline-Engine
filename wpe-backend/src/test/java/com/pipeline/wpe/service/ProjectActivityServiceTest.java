package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.*;
import com.pipeline.wpe.dto.response.activity.ProjectActivityItemResponse;
import com.pipeline.wpe.entity.*;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.repository.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProjectActivityServiceTest {

    @Mock
    private ProjectAuthorizationService projectAuthorizationService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ProjectMemberRepository projectMemberRepository;

    @Mock
    private ProjectInvitationRepository projectInvitationRepository;

    @Mock
    private NodeRepository nodeRepository;

    @Mock
    private ArtifactRepository artifactRepository;

    @Mock
    private GuestLinkRepository guestLinkRepository;

    @Mock
    private ProjectFeedbackRepository projectFeedbackRepository;

    @InjectMocks
    private ProjectActivityService projectActivityService;

    @Test
    @DisplayName("Dự án mẫu: có dòng 'tạo dự án', có dòng thành viên sarah, có dòng task WPE-xxx; sắp mới nhất trước; limit đúng")
    void getProjectActivity_sampleProject_returnsExpectedEventsSortedNewestFirstAndRespectsLimit() {
        Long projectId = 1L;
        Long ownerId = 2L;
        Long sarahId = 3L;

        Instant t0 = Instant.parse("2026-11-01T08:00:00Z"); // Tạo dự án
        Instant t1 = Instant.parse("2026-11-01T09:00:00Z"); // Thành viên sarah vào
        Instant t2 = Instant.parse("2026-11-02T10:00:00Z"); // Đổi trạng thái dự án sang ACTIVE
        Instant t3 = Instant.parse("2026-11-03T11:00:00Z"); // Task WPE-001 DONE
        Instant t4 = Instant.parse("2026-11-04T12:00:00Z"); // Task WPE-002 IN_PROGRESS

        ProjectEntity project = ProjectEntity.builder()
                .id(projectId)
                .ownerId(ownerId)
                .name("Core Banking Pipeline")
                .status(ProjectStatus.ACTIVE)
                .createdAt(t0)
                .updatedAt(t2)
                .build();

        UserEntity alex = UserEntity.builder()
                .id(ownerId)
                .username("alex.kim")
                .fullName("Alex Kim")
                .email("alex.kim@pipeline.engine")
                .build();

        UserEntity sarah = UserEntity.builder()
                .id(sarahId)
                .username("sarah.chen")
                .fullName("Sarah Chen")
                .email("sarah.chen@pipeline.engine")
                .build();

        ProjectMemberEntity ownerMember = ProjectMemberEntity.builder()
                .id(10L)
                .projectId(projectId)
                .userId(ownerId)
                .role(ProjectRole.OWNER)
                .joinedAt(t0)
                .build();

        ProjectMemberEntity sarahMember = ProjectMemberEntity.builder()
                .id(11L)
                .projectId(projectId)
                .userId(sarahId)
                .role(ProjectRole.COLLABORATOR)
                .joinedAt(t1)
                .build();

        NodeEntity node1 = NodeEntity.builder()
                .id(1L)
                .projectId(projectId)
                .code("WPE-001")
                .title("Database Schema 3NF")
                .status(NodeStatus.DONE)
                .assignedUserId(ownerId)
                .createdAt(t0)
                .updatedAt(t3)
                .build();

        NodeEntity node2 = NodeEntity.builder()
                .id(2L)
                .projectId(projectId)
                .code("WPE-002")
                .title("JWT Token Rotation")
                .status(NodeStatus.IN_PROGRESS)
                .assignedUserId(sarahId)
                .createdAt(t0)
                .updatedAt(t4)
                .build();

        when(projectAuthorizationService.verifyProjectMemberOrOwner(projectId, ownerId)).thenReturn(project);
        when(projectMemberRepository.findByProjectIdOrderByJoinedAtAsc(projectId))
                .thenReturn(List.of(ownerMember, sarahMember));
        when(projectInvitationRepository.findByProjectIdOrderByCreatedAtDesc(projectId)).thenReturn(List.of());
        when(nodeRepository.findByProjectId(projectId)).thenReturn(List.of(node1, node2));
        when(artifactRepository.findByProjectIdOrderByCreatedAtDesc(projectId)).thenReturn(List.of());
        when(guestLinkRepository.findByProjectIdOrderByCreatedAtDesc(projectId)).thenReturn(List.of());
        when(projectFeedbackRepository.findByProjectIdOrderByCreatedAtDesc(projectId)).thenReturn(List.of());
        when(userRepository.findAllById(any())).thenReturn(List.of(alex, sarah));

        List<ProjectActivityItemResponse> allEvents = projectActivityService.getProjectActivity(projectId, ownerId, 50);

        assertThat(allEvents).isNotEmpty();

        // Có dòng "tạo dự án"
        assertThat(allEvents)
                .anySatisfy(item -> assertThat(item.message().toLowerCase()).contains("tạo dự án"));

        // Có dòng thành viên sarah
        assertThat(allEvents)
                .anySatisfy(item -> {
                    String combined = (item.actorName() + " " + item.message()).toLowerCase();
                    assertThat(combined).contains("sarah");
                });

        // Có dòng task WPE-xxx với id dạng node-{id}-updated
        assertThat(allEvents)
                .anySatisfy(item -> {
                    assertThat(item.id()).isEqualTo("node-2-updated");
                    assertThat(item.targetCode()).isEqualTo("WPE-002");
                    assertThat(item.message()).contains("WPE-002");
                });

        // Sắp xếp mới nhất trước (createdAt giảm dần)
        for (int i = 0; i < allEvents.size() - 1; i++) {
            assertThat(allEvents.get(i).createdAt())
                    .isAfterOrEqualTo(allEvents.get(i + 1).createdAt());
        }

        // Kiểm tra limit cắt đúng số lượng
        List<ProjectActivityItemResponse> limitedEvents = projectActivityService.getProjectActivity(projectId, ownerId, 2);
        assertThat(limitedEvents).hasSize(2);
        assertThat(limitedEvents.get(0).id()).isEqualTo(allEvents.get(0).id());
        assertThat(limitedEvents.get(1).id()).isEqualTo(allEvents.get(1).id());
    }

    @Test
    @DisplayName("Tổng hợp đầy đủ lời mời, minh chứng, link khách và góp ý")
    void getProjectActivity_includesInvitationsArtifactsGuestLinksAndFeedbacks() {
        Long projectId = 1L;
        Long ownerId = 2L;
        Long inviteeId = 4L;
        Instant base = Instant.now().minus(5, ChronoUnit.DAYS);

        ProjectEntity project = ProjectEntity.builder()
                .id(projectId)
                .ownerId(ownerId)
                .name("Demo Project")
                .status(ProjectStatus.DRAFT)
                .createdAt(base)
                .updatedAt(base)
                .build();

        UserEntity alex = UserEntity.builder().id(ownerId).username("alex.kim").fullName("Alex Kim").build();
        UserEntity meomeo = UserEntity.builder().id(inviteeId).username("meomeo").fullName("Meo Meo").email("meo@wpe.io").build();

        ProjectInvitationEntity inv = ProjectInvitationEntity.builder()
                .id(50L)
                .projectId(projectId)
                .inviterId(ownerId)
                .inviteeId(inviteeId)
                .role(ProjectRole.COLLABORATOR)
                .status(InvitationStatus.ACCEPTED)
                .createdAt(base.plus(1, ChronoUnit.HOURS))
                .respondedAt(base.plus(2, ChronoUnit.HOURS))
                .build();

        NodeEntity node = NodeEntity.builder()
                .id(12L)
                .projectId(projectId)
                .code("WPE-012")
                .title("API Integration")
                .status(NodeStatus.REVIEW)
                .assignedUserId(inviteeId)
                .createdAt(base)
                .updatedAt(base.plus(3, ChronoUnit.HOURS))
                .build();

        ArtifactEntity artifact = ArtifactEntity.builder()
                .id(77L)
                .projectId(projectId)
                .nodeId(12L)
                .uploadedBy(inviteeId)
                .name("PR #42")
                .type(ArtifactType.PR)
                .url("https://github.com/org/repo/pull/42")
                .createdAt(base.plus(4, ChronoUnit.HOURS))
                .build();

        GuestLinkEntity guestLink = GuestLinkEntity.builder()
                .id(88L)
                .projectId(projectId)
                .token("gst_123")
                .isRevoked(false)
                .createdAt(base.plus(5, ChronoUnit.HOURS))
                .build();

        ProjectFeedbackEntity feedback = ProjectFeedbackEntity.builder()
                .id(99L)
                .projectId(projectId)
                .nodeId(12L)
                .reviewerName("GV Hướng Dẫn")
                .reviewerRole(ReviewerRole.TEACHER)
                .content("Cần bổ sung kiểm thử")
                .createdAt(base.plus(6, ChronoUnit.HOURS))
                .build();

        when(projectAuthorizationService.verifyProjectMemberOrOwner(projectId, ownerId)).thenReturn(project);
        when(projectMemberRepository.findByProjectIdOrderByJoinedAtAsc(projectId)).thenReturn(List.of());
        when(projectInvitationRepository.findByProjectIdOrderByCreatedAtDesc(projectId)).thenReturn(List.of(inv));
        when(nodeRepository.findByProjectId(projectId)).thenReturn(List.of(node));
        when(artifactRepository.findByProjectIdOrderByCreatedAtDesc(projectId)).thenReturn(List.of(artifact));
        when(guestLinkRepository.findByProjectIdOrderByCreatedAtDesc(projectId)).thenReturn(List.of(guestLink));
        when(projectFeedbackRepository.findByProjectIdOrderByCreatedAtDesc(projectId)).thenReturn(List.of(feedback));
        when(userRepository.findAllById(any())).thenReturn(List.of(alex, meomeo));

        List<ProjectActivityItemResponse> result = projectActivityService.getProjectActivity(projectId, ownerId, 50);

        assertThat(result).extracting(ProjectActivityItemResponse::type)
                .contains("PROJECT_CREATED", "INVITATION_SENT", "INVITATION_ACCEPTED", "TASK_STATUS_CHANGED", "ARTIFACT_SUBMITTED", "GUEST_LINK_CREATED", "FEEDBACK_CREATED");
    }

    @Test
    @DisplayName("Người ngoài dự án gọi lấy nhật ký hoạt động -> ném ForbiddenException (403)")
    void getProjectActivity_whenOutsider_throwsForbiddenException() {
        Long projectId = 1L;
        Long outsiderId = 99L;

        when(projectAuthorizationService.verifyProjectMemberOrOwner(projectId, outsiderId))
                .thenThrow(new ForbiddenException("ACCESS_DENIED", "Bạn không phải là thành viên của dự án này."));

        assertThatThrownBy(() -> projectActivityService.getProjectActivity(projectId, outsiderId, 50))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("Bạn không phải là thành viên của dự án này.");

        verifyNoInteractions(nodeRepository, artifactRepository, projectMemberRepository);
    }

    @Test
    @DisplayName("Node mới clone từ template chưa cập nhật (updatedAt == createdAt) không sinh dòng TASK_STATUS_CHANGED")
    void getProjectActivity_skipsUntouchedNodesWhereUpdatedAtEqualsCreatedAt() {
        Long projectId = 1L;
        Long ownerId = 2L;
        Instant t0 = Instant.parse("2026-11-01T08:00:00Z");
        Instant t1 = Instant.parse("2026-11-01T09:00:00Z");

        ProjectEntity project = ProjectEntity.builder()
                .id(projectId)
                .ownerId(ownerId)
                .name("Template Clone")
                .status(ProjectStatus.DRAFT)
                .createdAt(t0)
                .updatedAt(t0)
                .build();

        UserEntity alex = UserEntity.builder().id(ownerId).username("alex.kim").fullName("Alex Kim").build();

        NodeEntity untouchedNode = NodeEntity.builder()
                .id(101L)
                .projectId(projectId)
                .code("WPE-101")
                .title("Untouched Template Node")
                .status(NodeStatus.LOCKED)
                .createdAt(t0)
                .updatedAt(t0)
                .build();

        NodeEntity updatedNode = NodeEntity.builder()
                .id(102L)
                .projectId(projectId)
                .code("WPE-102")
                .title("Updated Node")
                .status(NodeStatus.TODO)
                .assignedUserId(ownerId)
                .createdAt(t0)
                .updatedAt(t1)
                .build();

        when(projectAuthorizationService.verifyProjectMemberOrOwner(projectId, ownerId)).thenReturn(project);
        when(projectMemberRepository.findByProjectIdOrderByJoinedAtAsc(projectId)).thenReturn(List.of());
        when(projectInvitationRepository.findByProjectIdOrderByCreatedAtDesc(projectId)).thenReturn(List.of());
        when(nodeRepository.findByProjectId(projectId)).thenReturn(List.of(untouchedNode, updatedNode));
        when(artifactRepository.findByProjectIdOrderByCreatedAtDesc(projectId)).thenReturn(List.of());
        when(guestLinkRepository.findByProjectIdOrderByCreatedAtDesc(projectId)).thenReturn(List.of());
        when(projectFeedbackRepository.findByProjectIdOrderByCreatedAtDesc(projectId)).thenReturn(List.of());
        when(userRepository.findAllById(any())).thenReturn(List.of(alex));

        List<ProjectActivityItemResponse> result = projectActivityService.getProjectActivity(projectId, ownerId, 50);

        assertThat(result).extracting(ProjectActivityItemResponse::id)
                .contains("node-102-updated")
                .doesNotContain("node-101-updated");
    }

    @Test
    @DisplayName("Link khách đã thu hồi vẫn giữ dòng tạo (-created) và thêm dòng thu hồi (-revoked) ghi rõ không rõ thời điểm thu hồi")
    void getProjectActivity_revokedGuestLink_emitsBothCreatedAndRevokedWithUnknownTimeNote() {
        Long projectId = 1L;
        Long ownerId = 2L;
        Instant t0 = Instant.parse("2026-11-01T08:00:00Z");
        Instant tLink = Instant.parse("2026-11-02T10:00:00Z");

        ProjectEntity project = ProjectEntity.builder()
                .id(projectId)
                .ownerId(ownerId)
                .name("Guest Link Project")
                .status(ProjectStatus.ACTIVE)
                .createdAt(t0)
                .updatedAt(t0)
                .build();

        UserEntity alex = UserEntity.builder().id(ownerId).username("alex.kim").fullName("Alex Kim").build();

        GuestLinkEntity revokedLink = GuestLinkEntity.builder()
                .id(89L)
                .projectId(projectId)
                .token("gst_revoked")
                .isRevoked(true)
                .createdAt(tLink)
                .expiresAt(tLink.plus(7, ChronoUnit.DAYS))
                .build();

        when(projectAuthorizationService.verifyProjectMemberOrOwner(projectId, ownerId)).thenReturn(project);
        when(projectMemberRepository.findByProjectIdOrderByJoinedAtAsc(projectId)).thenReturn(List.of());
        when(projectInvitationRepository.findByProjectIdOrderByCreatedAtDesc(projectId)).thenReturn(List.of());
        when(nodeRepository.findByProjectId(projectId)).thenReturn(List.of());
        when(artifactRepository.findByProjectIdOrderByCreatedAtDesc(projectId)).thenReturn(List.of());
        when(guestLinkRepository.findByProjectIdOrderByCreatedAtDesc(projectId)).thenReturn(List.of(revokedLink));
        when(projectFeedbackRepository.findByProjectIdOrderByCreatedAtDesc(projectId)).thenReturn(List.of());
        when(userRepository.findAllById(any())).thenReturn(List.of(alex));

        List<ProjectActivityItemResponse> result = projectActivityService.getProjectActivity(projectId, ownerId, 50);

        assertThat(result).extracting(ProjectActivityItemResponse::id)
                .contains("guest-link-89-created", "guest-link-89-revoked");

        ProjectActivityItemResponse revokedEvent = result.stream()
                .filter(e -> "guest-link-89-revoked".equals(e.id()))
                .findFirst()
                .orElseThrow();
        assertThat(revokedEvent.type()).isEqualTo("GUEST_LINK_REVOKED");
        assertThat(revokedEvent.createdAt()).isEqualTo(tLink);
        assertThat(revokedEvent.message().toLowerCase()).contains("không rõ thời điểm thu hồi");
    }
}
