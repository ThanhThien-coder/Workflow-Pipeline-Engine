package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.InvitationStatus;
import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.common.enums.SystemRole;
import com.pipeline.wpe.dto.event.InvitationAcceptedEvent;
import com.pipeline.wpe.dto.event.InvitationCreatedEvent;
import com.pipeline.wpe.dto.request.project.CreateInvitationRequest;
import com.pipeline.wpe.dto.response.project.InvitationDetailResponse;
import com.pipeline.wpe.dto.response.project.InvitationResponse;
import com.pipeline.wpe.entity.NotificationEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.ProjectInvitationEntity;
import com.pipeline.wpe.entity.ProjectMemberEntity;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.exception.ConflictException;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.NotificationRepository;
import com.pipeline.wpe.repository.ProjectInvitationRepository;
import com.pipeline.wpe.repository.ProjectMemberRepository;
import com.pipeline.wpe.repository.ProjectRepository;
import com.pipeline.wpe.repository.UserRepository;
import com.pipeline.wpe.service.event.WorkflowEventPublisher;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
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
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProjectInvitationServiceTest {

    @Mock
    private ProjectInvitationRepository projectInvitationRepository;

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ProjectMemberRepository projectMemberRepository;

    @Mock
    private ProjectAuthorizationService projectAuthorizationService;

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private WorkflowEventPublisher workflowEventPublisher;

    @InjectMocks
    private ProjectInvitationService projectInvitationService;

    private final Long projectId = 10L;
    private final Long inviterId = 1L;
    private final Long inviteeId = 2L;
    private final Long otherUserId = 99L;
    private final Long invitationId = 50L;

    @Test
    @DisplayName("sendInvitation: Gửi lời mời thành công và tạo đúng Notification với SSOT Deep-link")
    void shouldSendInvitationAndCreateNotificationWithDeepLink() {
        ProjectEntity project = ProjectEntity.builder()
                .id(projectId)
                .name("Core Banking Pipeline")
                .ownerId(inviterId)
                .build();

        UserEntity inviter = UserEntity.builder()
                .id(inviterId)
                .username("alex.kim")
                .fullName("Alex Kim")
                .build();

        UserEntity invitee = UserEntity.builder()
                .id(inviteeId)
                .username("sarah.chen")
                .email("sarah.chen@pipeline.engine")
                .fullName("Sarah Chen")
                .build();

        CreateInvitationRequest req = new CreateInvitationRequest("sarah.chen@pipeline.engine", ProjectRole.COLLABORATOR);

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(userRepository.findById(inviterId)).thenReturn(Optional.of(inviter));
        when(userRepository.findByEmail("sarah.chen@pipeline.engine")).thenReturn(Optional.of(invitee));
        when(projectMemberRepository.existsByProjectIdAndUserIdAndRemovedAtIsNull(projectId, inviteeId)).thenReturn(false);
        when(projectInvitationRepository.findByProjectIdAndInviteeIdAndStatus(projectId, inviteeId, InvitationStatus.PENDING)).thenReturn(Optional.empty());

        ProjectInvitationEntity savedInvitation = ProjectInvitationEntity.builder()
                .id(invitationId)
                .projectId(projectId)
                .inviterId(inviterId)
                .inviteeId(inviteeId)
                .role(ProjectRole.COLLABORATOR)
                .status(InvitationStatus.PENDING)
                .createdAt(Instant.now())
                .expiresAt(Instant.now().plus(7, ChronoUnit.DAYS))
                .version(0L)
                .build();

        when(projectInvitationRepository.save(any(ProjectInvitationEntity.class))).thenReturn(savedInvitation);

        InvitationResponse response = projectInvitationService.sendInvitation(projectId, req, inviterId);

        assertThat(response).isNotNull();
        assertThat(response.id()).isEqualTo(invitationId);
        assertThat(response.projectId()).isEqualTo(projectId);
        assertThat(response.projectName()).isEqualTo("Core Banking Pipeline");
        assertThat(response.inviteeEmail()).isEqualTo("sarah.chen@pipeline.engine");
        assertThat(response.role()).isEqualTo(ProjectRole.COLLABORATOR);
        assertThat(response.status()).isEqualTo(InvitationStatus.PENDING);

        // Kiểm tra Notification được lưu trực tiếp vào bảng notification với Deep-Link
        ArgumentCaptor<NotificationEntity> notifCaptor = ArgumentCaptor.forClass(NotificationEntity.class);
        verify(notificationRepository, times(1)).save(notifCaptor.capture());
        NotificationEntity savedNotif = notifCaptor.getValue();
        assertThat(savedNotif.getUserId()).isEqualTo(inviteeId);
        assertThat(savedNotif.getLinkUrl()).isEqualTo("/workspace?action=open-invite-modal&invitationId=" + invitationId);
        assertThat(savedNotif.getMessage()).contains("Alex Kim đã mời bạn tham gia dự án \"Core Banking Pipeline\"");
        assertThat(savedNotif.getIsRead()).isFalse();

        // Kiểm tra Event được publish qua RabbitMQ
        verify(workflowEventPublisher, times(1)).publishInvitationCreated(any(InvitationCreatedEvent.class));
    }

    @Test
    @DisplayName("acceptInvitation: Chấp nhận lời mời chuyển status sang ACCEPTED và ghi nhận đúng vào ProjectMemberEntity")
    void shouldAcceptInvitationAndAddToProjectMember() {
        ProjectInvitationEntity invitation = ProjectInvitationEntity.builder()
                .id(invitationId)
                .projectId(projectId)
                .inviterId(inviterId)
                .inviteeId(inviteeId)
                .role(ProjectRole.COLLABORATOR)
                .status(InvitationStatus.PENDING)
                .expiresAt(Instant.now().plus(5, ChronoUnit.DAYS))
                .build();

        NotificationEntity unreadNotif = NotificationEntity.builder()
                .id(101L)
                .userId(inviteeId)
                .linkUrl("/workspace?action=open-invite-modal&invitationId=" + invitationId)
                .isRead(false)
                .build();

        when(projectInvitationRepository.findById(invitationId)).thenReturn(Optional.of(invitation));
        when(projectMemberRepository.existsByProjectIdAndUserIdAndRemovedAtIsNull(projectId, inviteeId)).thenReturn(false);
        when(notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(inviteeId)).thenReturn(List.of(unreadNotif));
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(ProjectEntity.builder().id(projectId).name("Core Banking Pipeline").build()));
        when(userRepository.findById(inviteeId)).thenReturn(Optional.of(UserEntity.builder().id(inviteeId).username("sarah.chen").build()));

        projectInvitationService.acceptInvitation(invitationId, inviteeId);

        assertThat(invitation.getStatus()).isEqualTo(InvitationStatus.ACCEPTED);
        assertThat(invitation.getRespondedAt()).isNotNull();

        // Kiểm tra MemberEntity được lưu vào ProjectMember
        ArgumentCaptor<ProjectMemberEntity> memberCaptor = ArgumentCaptor.forClass(ProjectMemberEntity.class);
        verify(projectMemberRepository, times(1)).save(memberCaptor.capture());
        ProjectMemberEntity member = memberCaptor.getValue();
        assertThat(member.getProjectId()).isEqualTo(projectId);
        assertThat(member.getUserId()).isEqualTo(inviteeId);
        assertThat(member.getRole()).isEqualTo(ProjectRole.COLLABORATOR);
        assertThat(member.getRemovedAt()).isNull();

        // Kiểm tra notification được đánh dấu đã đọc
        assertThat(unreadNotif.getIsRead()).isTrue();
        verify(notificationRepository, times(1)).save(unreadNotif);

        // Kiểm tra publish event
        verify(workflowEventPublisher, times(1)).publishInvitationAccepted(any(InvitationAcceptedEvent.class));
    }

    @Test
    @DisplayName("acceptInvitation: Chặn người ngoài (không phải invitee) cố tình chấp thuận lời mời")
    void shouldBlockUnauthorizedUserFromAcceptingInvitation() {
        ProjectInvitationEntity invitation = ProjectInvitationEntity.builder()
                .id(invitationId)
                .projectId(projectId)
                .inviteeId(inviteeId) // Invitee chính chủ là inviteeId = 2L
                .status(InvitationStatus.PENDING)
                .expiresAt(Instant.now().plus(5, ChronoUnit.DAYS))
                .build();

        when(projectInvitationRepository.findById(invitationId)).thenReturn(Optional.of(invitation));

        // otherUserId (99L) cố tình accept
        assertThatThrownBy(() -> projectInvitationService.acceptInvitation(invitationId, otherUserId))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("Bạn không có quyền phản hồi lời mời này.");

        verify(projectMemberRepository, never()).save(any(ProjectMemberEntity.class));
    }

    @Test
    @DisplayName("rejectInvitation: Từ chối lời mời chuyển status sang REJECTED và tuyệt đối KHÔNG thêm vào ProjectMember")
    void shouldRejectInvitationAndNotAddToProjectMember() {
        ProjectInvitationEntity invitation = ProjectInvitationEntity.builder()
                .id(invitationId)
                .projectId(projectId)
                .inviteeId(inviteeId)
                .status(InvitationStatus.PENDING)
                .expiresAt(Instant.now().plus(5, ChronoUnit.DAYS))
                .build();

        NotificationEntity unreadNotif = NotificationEntity.builder()
                .id(101L)
                .userId(inviteeId)
                .linkUrl("/workspace?action=open-invite-modal&invitationId=" + invitationId)
                .isRead(false)
                .build();

        when(projectInvitationRepository.findById(invitationId)).thenReturn(Optional.of(invitation));
        when(notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(inviteeId)).thenReturn(List.of(unreadNotif));

        projectInvitationService.rejectInvitation(invitationId, inviteeId);

        assertThat(invitation.getStatus()).isEqualTo(InvitationStatus.REJECTED);
        assertThat(invitation.getRespondedAt()).isNotNull();

        // Tuyệt đối không thêm vào ProjectMember
        verify(projectMemberRepository, never()).save(any(ProjectMemberEntity.class));

        // Đã đánh dấu notification liên quan đã đọc
        assertThat(unreadNotif.getIsRead()).isTrue();
        verify(notificationRepository, times(1)).save(unreadNotif);
    }

    @Test
    @DisplayName("revokeInvitation: Chủ dự án hoặc Inviter thu hồi lời mời thành công")
    void shouldRevokeInvitationByInviterOrOwner() {
        ProjectInvitationEntity invitation = ProjectInvitationEntity.builder()
                .id(invitationId)
                .projectId(projectId)
                .inviterId(inviterId)
                .inviteeId(inviteeId)
                .status(InvitationStatus.PENDING)
                .build();

        ProjectEntity project = ProjectEntity.builder()
                .id(projectId)
                .ownerId(inviterId)
                .build();

        when(projectInvitationRepository.findById(invitationId)).thenReturn(Optional.of(invitation));
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));

        projectInvitationService.revokeInvitation(invitationId, inviterId);

        assertThat(invitation.getStatus()).isEqualTo(InvitationStatus.REVOKED);
        assertThat(invitation.getRespondedAt()).isNotNull();
        verify(projectInvitationRepository, times(1)).save(invitation);
    }

    @Test
    @DisplayName("revokeInvitation: Chặn người lạ cố tình thu hồi lời mời")
    void shouldBlockUnauthorizedUserFromRevokingInvitation() {
        ProjectInvitationEntity invitation = ProjectInvitationEntity.builder()
                .id(invitationId)
                .projectId(projectId)
                .inviterId(inviterId)
                .inviteeId(inviteeId)
                .status(InvitationStatus.PENDING)
                .build();

        ProjectEntity project = ProjectEntity.builder()
                .id(projectId)
                .ownerId(inviterId)
                .build();

        when(projectInvitationRepository.findById(invitationId)).thenReturn(Optional.of(invitation));
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(userRepository.findById(otherUserId)).thenReturn(Optional.of(
                UserEntity.builder().id(otherUserId).systemRole(SystemRole.USER).build()
        ));

        assertThatThrownBy(() -> projectInvitationService.revokeInvitation(invitationId, otherUserId))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("Chỉ người gửi lời mời hoặc chủ dự án mới có quyền thu hồi lời mời này.");
    }

    @Test
    @DisplayName("sendInvitation: Chặn gửi trùng lời mời khi đã có lời mời PENDING")
    void shouldThrowConflictWhenInvitationAlreadyPending() {
        ProjectEntity project = ProjectEntity.builder()
                .id(projectId)
                .ownerId(inviterId)
                .build();

        UserEntity inviter = UserEntity.builder().id(inviterId).username("alex.kim").build();
        UserEntity invitee = UserEntity.builder().id(inviteeId).username("sarah.chen").email("sarah.chen@pipeline.engine").build();

        CreateInvitationRequest req = new CreateInvitationRequest("sarah.chen@pipeline.engine", ProjectRole.COLLABORATOR);

        ProjectInvitationEntity activePending = ProjectInvitationEntity.builder()
                .id(99L)
                .projectId(projectId)
                .inviterId(inviterId)
                .inviteeId(inviteeId)
                .role(ProjectRole.COLLABORATOR)
                .status(InvitationStatus.PENDING)
                .expiresAt(Instant.now().plus(5, ChronoUnit.DAYS))
                .build();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(userRepository.findById(inviterId)).thenReturn(Optional.of(inviter));
        when(userRepository.findByEmail("sarah.chen@pipeline.engine")).thenReturn(Optional.of(invitee));
        when(projectMemberRepository.existsByProjectIdAndUserIdAndRemovedAtIsNull(projectId, inviteeId)).thenReturn(false);
        when(projectInvitationRepository.findByProjectIdAndInviteeIdAndStatus(projectId, inviteeId, InvitationStatus.PENDING))
                .thenReturn(Optional.of(activePending));

        assertThatThrownBy(() -> projectInvitationService.sendInvitation(projectId, req, inviterId))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("đã có một lời mời đang chờ phản hồi.");

        verify(projectInvitationRepository, never()).save(any(ProjectInvitationEntity.class));
    }

    @Test
    @DisplayName("sendInvitation: Chặn COLLABORATOR gửi lời mời (chỉ OWNER mới được gửi)")
    void shouldThrowForbidden_whenCollaboratorSendsInvitation() {
        ProjectEntity project = ProjectEntity.builder()
                .id(projectId)
                .ownerId(inviterId)
                .build();

        CreateInvitationRequest req = new CreateInvitationRequest("sarah.chen@pipeline.engine", ProjectRole.COLLABORATOR);

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));

        assertThatThrownBy(() -> projectInvitationService.sendInvitation(projectId, req, otherUserId))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("Chỉ chủ dự án (OWNER) mới được gửi lời mời.");

        verify(projectInvitationRepository, never()).save(any(ProjectInvitationEntity.class));
    }

    @Test
    @DisplayName("sendInvitation: Chặn ADMIN không phải owner gửi lời mời")
    void shouldThrowForbidden_whenAdminNotOwnerSendsInvitation() {
        ProjectEntity project = ProjectEntity.builder()
                .id(projectId)
                .ownerId(inviterId)
                .build();

        CreateInvitationRequest req = new CreateInvitationRequest("sarah.chen@pipeline.engine", ProjectRole.COLLABORATOR);

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));

        assertThatThrownBy(() -> projectInvitationService.sendInvitation(projectId, req, otherUserId))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("Chỉ chủ dự án (OWNER) mới được gửi lời mời.");

        verify(projectInvitationRepository, never()).save(any(ProjectInvitationEntity.class));
    }

    @Test
    @DisplayName("sendInvitation: Chặn gửi lời mời với vai trò OWNER")
    void shouldThrowIllegalArgument_whenInvitingWithRoleOwner() {
        ProjectEntity project = ProjectEntity.builder()
                .id(projectId)
                .ownerId(inviterId)
                .build();

        CreateInvitationRequest req = new CreateInvitationRequest("sarah.chen@pipeline.engine", ProjectRole.OWNER);

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));

        assertThatThrownBy(() -> projectInvitationService.sendInvitation(projectId, req, inviterId))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Không thể mời với vai trò OWNER. Dùng chức năng chuyển quyền sở hữu.");

        verify(projectInvitationRepository, never()).save(any(ProjectInvitationEntity.class));
    }

    @Test
    @DisplayName("acceptInvitation: Người từng bị xóa mềm khi chấp nhận lời mời mới thì tạo entity mới (id null), không khôi phục dòng cũ")
    void shouldCreateNewMemberRecord_whenSoftDeletedMemberAcceptsInvitation() {
        ProjectInvitationEntity invitation = ProjectInvitationEntity.builder()
                .id(invitationId)
                .projectId(projectId)
                .inviterId(inviterId)
                .inviteeId(inviteeId)
                .role(ProjectRole.COLLABORATOR)
                .status(InvitationStatus.PENDING)
                .expiresAt(Instant.now().plus(5, ChronoUnit.DAYS))
                .build();

        NotificationEntity unreadNotif = NotificationEntity.builder()
                .id(101L)
                .userId(inviteeId)
                .linkUrl("/workspace?action=open-invite-modal&invitationId=" + invitationId)
                .isRead(false)
                .build();

        when(projectInvitationRepository.findById(invitationId)).thenReturn(Optional.of(invitation));
        when(projectMemberRepository.existsByProjectIdAndUserIdAndRemovedAtIsNull(projectId, inviteeId)).thenReturn(false);
        when(notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(inviteeId)).thenReturn(List.of(unreadNotif));
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(ProjectEntity.builder().id(projectId).name("Core Banking Pipeline").build()));
        when(userRepository.findById(inviteeId)).thenReturn(Optional.of(UserEntity.builder().id(inviteeId).username("sarah.chen").build()));

        projectInvitationService.acceptInvitation(invitationId, inviteeId);

        assertThat(invitation.getStatus()).isEqualTo(InvitationStatus.ACCEPTED);

        ArgumentCaptor<ProjectMemberEntity> memberCaptor = ArgumentCaptor.forClass(ProjectMemberEntity.class);
        verify(projectMemberRepository, times(1)).save(memberCaptor.capture());
        ProjectMemberEntity saved = memberCaptor.getValue();

        assertThat(saved.getId()).isNull();
        assertThat(saved.getProjectId()).isEqualTo(projectId);
        assertThat(saved.getUserId()).isEqualTo(inviteeId);
        assertThat(saved.getRole()).isEqualTo(ProjectRole.COLLABORATOR);
        assertThat(saved.getRemovedAt()).isNull();
        assertThat(saved.getJoinedAt()).isNotNull();

        verify(workflowEventPublisher, times(1)).publishInvitationAccepted(any(InvitationAcceptedEvent.class));
    }

    @Test
    @DisplayName("acceptInvitation: Chấp nhận lời mời quá hạn ném ConflictException INVITATION_EXPIRED và lưu status EXPIRED")
    void shouldThrowConflictAndSaveExpired_whenAcceptingOverdueInvitation() {
        ProjectInvitationEntity invitation = ProjectInvitationEntity.builder()
                .id(invitationId)
                .projectId(projectId)
                .inviterId(inviterId)
                .inviteeId(inviteeId)
                .role(ProjectRole.COLLABORATOR)
                .status(InvitationStatus.PENDING)
                .expiresAt(Instant.now().minus(1, ChronoUnit.HOURS))
                .build();

        when(projectInvitationRepository.findById(invitationId)).thenReturn(Optional.of(invitation));

        assertThatThrownBy(() -> projectInvitationService.acceptInvitation(invitationId, inviteeId))
                .isInstanceOf(ConflictException.class)
                .satisfies(e -> {
                    ConflictException ce = (ConflictException) e;
                    assertThat(ce.getErrorCode()).isEqualTo("INVITATION_EXPIRED");
                    assertThat(ce.getMessage()).isEqualTo("Lời mời đã hết hạn.");
                });

        assertThat(invitation.getStatus()).isEqualTo(InvitationStatus.EXPIRED);
        assertThat(invitation.getRespondedAt()).isNotNull();
        verify(projectInvitationRepository, times(1)).save(invitation);
        verify(projectMemberRepository, never()).save(any());
    }

    @Test
    @DisplayName("rejectInvitation: Từ chối lời mời quá hạn ném ConflictException INVITATION_EXPIRED và lưu status EXPIRED")
    void shouldThrowConflictAndSaveExpired_whenRejectingOverdueInvitation() {
        ProjectInvitationEntity invitation = ProjectInvitationEntity.builder()
                .id(invitationId)
                .projectId(projectId)
                .inviterId(inviterId)
                .inviteeId(inviteeId)
                .role(ProjectRole.COLLABORATOR)
                .status(InvitationStatus.PENDING)
                .expiresAt(Instant.now().minus(1, ChronoUnit.HOURS))
                .build();

        when(projectInvitationRepository.findById(invitationId)).thenReturn(Optional.of(invitation));

        assertThatThrownBy(() -> projectInvitationService.rejectInvitation(invitationId, inviteeId))
                .isInstanceOf(ConflictException.class)
                .satisfies(e -> {
                    ConflictException ce = (ConflictException) e;
                    assertThat(ce.getErrorCode()).isEqualTo("INVITATION_EXPIRED");
                    assertThat(ce.getMessage()).isEqualTo("Lời mời đã hết hạn.");
                });

        assertThat(invitation.getStatus()).isEqualTo(InvitationStatus.EXPIRED);
        assertThat(invitation.getRespondedAt()).isNotNull();
        verify(projectInvitationRepository, times(1)).save(invitation);
        verify(projectMemberRepository, never()).save(any());
    }

    @Test
    @DisplayName("sendInvitation: Khi lời mời PENDING cũ đã quá hạn thì saveAndFlush lời mời cũ sang EXPIRED và tạo lời mời mới")
    void shouldExpireOldAndCreateNew_whenSendingWithOverduePendingInvitation() {
        ProjectEntity project = ProjectEntity.builder()
                .id(projectId)
                .name("Core Banking Pipeline")
                .ownerId(inviterId)
                .build();

        UserEntity inviter = UserEntity.builder().id(inviterId).username("alex.kim").fullName("Alex Kim").build();
        UserEntity invitee = UserEntity.builder().id(inviteeId).username("sarah.chen").email("example-sarah@example-pipeline.org").build();

        ProjectInvitationEntity oldInvitation = ProjectInvitationEntity.builder()
                .id(999L)
                .projectId(projectId)
                .inviterId(inviterId)
                .inviteeId(inviteeId)
                .role(ProjectRole.VIEWER)
                .status(InvitationStatus.PENDING)
                .expiresAt(Instant.now().minus(2, ChronoUnit.DAYS))
                .build();

        CreateInvitationRequest req = new CreateInvitationRequest("example-sarah@example-pipeline.org", ProjectRole.COLLABORATOR);

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(userRepository.findById(inviterId)).thenReturn(Optional.of(inviter));
        when(userRepository.findByEmail("example-sarah@example-pipeline.org")).thenReturn(Optional.of(invitee));
        when(projectMemberRepository.existsByProjectIdAndUserIdAndRemovedAtIsNull(projectId, inviteeId)).thenReturn(false);
        when(projectInvitationRepository.findByProjectIdAndInviteeIdAndStatus(projectId, inviteeId, InvitationStatus.PENDING))
                .thenReturn(Optional.of(oldInvitation));

        ProjectInvitationEntity newSaved = ProjectInvitationEntity.builder()
                .id(invitationId)
                .projectId(projectId)
                .inviterId(inviterId)
                .inviteeId(inviteeId)
                .role(ProjectRole.COLLABORATOR)
                .status(InvitationStatus.PENDING)
                .createdAt(Instant.now())
                .expiresAt(Instant.now().plus(7, ChronoUnit.DAYS))
                .build();
        when(projectInvitationRepository.save(any(ProjectInvitationEntity.class))).thenReturn(newSaved);

        InvitationResponse response = projectInvitationService.sendInvitation(projectId, req, inviterId);

        assertThat(response.id()).isEqualTo(invitationId);
        assertThat(oldInvitation.getStatus()).isEqualTo(InvitationStatus.EXPIRED);
        assertThat(oldInvitation.getRespondedAt()).isNotNull();
        verify(projectInvitationRepository, times(1)).saveAndFlush(oldInvitation);
        verify(projectInvitationRepository, times(1)).save(any(ProjectInvitationEntity.class));
    }

    @Test
    @DisplayName("acceptInvitation và rejectInvitation: Có @Transactional với noRollbackFor chứa ConflictException.class")
    void shouldHaveNoRollbackForConflictExceptionOnAcceptAndReject() throws Exception {
        org.springframework.transaction.annotation.Transactional acceptTx =
                ProjectInvitationService.class.getMethod("acceptInvitation", Long.class, Long.class)
                        .getAnnotation(org.springframework.transaction.annotation.Transactional.class);
        assertThat(acceptTx).isNotNull();
        assertThat(acceptTx.noRollbackFor()).contains(ConflictException.class);

        org.springframework.transaction.annotation.Transactional rejectTx =
                ProjectInvitationService.class.getMethod("rejectInvitation", Long.class, Long.class)
                        .getAnnotation(org.springframework.transaction.annotation.Transactional.class);
        assertThat(rejectTx).isNotNull();
        assertThat(rejectTx.noRollbackFor()).contains(ConflictException.class);
    }
}
