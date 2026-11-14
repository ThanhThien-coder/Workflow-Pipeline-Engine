package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.InvitationStatus;
import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.dto.request.project.CreateInvitationRequest;
import com.pipeline.wpe.dto.response.notification.NotificationResponse;
import com.pipeline.wpe.entity.NotificationEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.ProjectInvitationEntity;
import com.pipeline.wpe.entity.UserEntity;
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
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock
    private NotificationRepository notificationRepository;

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
    private WorkflowEventPublisher workflowEventPublisher;

    @InjectMocks
    private NotificationService notificationService;

    private final Long alexId = 2L;
    private final Long sarahId = 3L;
    private final Long meomeoId = 10L;

    @Test
    @DisplayName("FC3: alex mời meomeo -> meomeo có 1 thông báo chứa invitationId trong linkUrl, sarah không thấy thông báo đó")
    void alexInvitesMeomeo_meomeoSeesNotification_sarahDoesNot() {
        ProjectInvitationService invitationService = new ProjectInvitationService(
                projectInvitationRepository,
                projectRepository,
                userRepository,
                projectMemberRepository,
                projectAuthorizationService,
                notificationRepository,
                workflowEventPublisher
        );

        Long projectId = 1L;
        Long invitationId = 77L;

        ProjectEntity project = ProjectEntity.builder()
                .id(projectId)
                .name("Core Banking Pipeline")
                .ownerId(alexId)
                .build();
        UserEntity alex = UserEntity.builder()
                .id(alexId)
                .username("alex.kim")
                .fullName("Alex Kim")
                .build();
        UserEntity meomeo = UserEntity.builder()
                .id(meomeoId)
                .username("meomeo")
                .email("meomeo@pipeline.engine")
                .fullName("Meo Meo")
                .build();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(userRepository.findById(alexId)).thenReturn(Optional.of(alex));
        when(userRepository.findByEmail("meomeo")).thenReturn(Optional.empty());
        when(userRepository.findByUsername("meomeo")).thenReturn(Optional.of(meomeo));
        when(projectMemberRepository.existsByProjectIdAndUserIdAndRemovedAtIsNull(projectId, meomeoId)).thenReturn(false);
        when(projectInvitationRepository.findByProjectIdAndInviteeIdAndStatus(projectId, meomeoId, InvitationStatus.PENDING))
                .thenReturn(Optional.empty());

        ProjectInvitationEntity savedInvitation = ProjectInvitationEntity.builder()
                .id(invitationId)
                .projectId(projectId)
                .inviterId(alexId)
                .inviteeId(meomeoId)
                .role(ProjectRole.COLLABORATOR)
                .status(InvitationStatus.PENDING)
                .createdAt(Instant.now())
                .expiresAt(Instant.now().plus(7, ChronoUnit.DAYS))
                .version(0L)
                .build();
        when(projectInvitationRepository.save(any(ProjectInvitationEntity.class))).thenReturn(savedInvitation);

        List<NotificationEntity> inMemoryNotifications = new ArrayList<>();
        when(notificationRepository.save(any(NotificationEntity.class))).thenAnswer(inv -> {
            NotificationEntity n = inv.getArgument(0);
            if (n.getId() == null) {
                n.setId(501L);
            }
            if (n.getCreatedAt() == null) {
                n.setCreatedAt(Instant.now());
            }
            inMemoryNotifications.add(n);
            return n;
        });

        when(notificationRepository.findByUserIdOrderByCreatedAtDesc(anyLong())).thenAnswer(inv -> {
            Long uid = inv.getArgument(0);
            return inMemoryNotifications.stream()
                    .filter(n -> Objects.equals(n.getUserId(), uid))
                    .sorted(Comparator.comparing(NotificationEntity::getCreatedAt).reversed())
                    .toList();
        });

        // Alex mời meomeo
        invitationService.sendInvitation(projectId, new CreateInvitationRequest("meomeo", ProjectRole.COLLABORATOR), alexId);

        // Meomeo đọc danh sách thông báo
        List<NotificationResponse> meomeoNotifs = notificationService.getNotifications(meomeoId, false, 30);
        assertThat(meomeoNotifs).hasSize(1);
        assertThat(meomeoNotifs.get(0).linkUrl()).contains("invitationId=" + invitationId);
        assertThat(meomeoNotifs.get(0).isRead()).isFalse();

        // Sarah đọc danh sách thông báo -> không thấy thông báo của meomeo
        List<NotificationResponse> sarahNotifs = notificationService.getNotifications(sarahId, false, 30);
        assertThat(sarahNotifs).isEmpty();
    }

    @Test
    @DisplayName("FC3: Đánh dấu đọc thông báo của người khác -> ném ResourceNotFoundException (404)")
    void markAsRead_otherUsersNotification_throws404() {
        Long notifId = 501L;
        when(notificationRepository.findById(notifId)).thenReturn(Optional.of(
                NotificationEntity.builder()
                        .id(notifId)
                        .userId(meomeoId)
                        .title("Lời mời tham gia dự án")
                        .isRead(false)
                        .createdAt(Instant.now())
                        .build()
        ));

        assertThatThrownBy(() -> notificationService.markAsRead(notifId, sarahId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("FC3: Đánh dấu đọc thông báo của chính mình -> cập nhật isRead = true")
    void markAsRead_ownNotification_marksRead() {
        Long notifId = 501L;
        NotificationEntity entity = NotificationEntity.builder()
                .id(notifId)
                .userId(meomeoId)
                .title("Lời mời tham gia dự án")
                .message("Alex Kim đã mời bạn")
                .linkUrl("/workspace?action=open-invite-modal&invitationId=77")
                .isRead(false)
                .createdAt(Instant.now())
                .build();

        when(notificationRepository.findById(notifId)).thenReturn(Optional.of(entity));
        when(notificationRepository.save(any(NotificationEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        NotificationResponse response = notificationService.markAsRead(notifId, meomeoId);

        assertThat(response.id()).isEqualTo("501");
        assertThat(response.isRead()).isTrue();
        verify(notificationRepository).save(entity);
    }

    @Test
    @DisplayName("FC3: markAllAsRead chỉ đánh dấu đã đọc các thông báo chưa đọc của chính user đó")
    void markAllAsRead_marksAllUnreadOfCurrentUser() {
        NotificationEntity n1 = NotificationEntity.builder().id(1L).userId(meomeoId).isRead(false).build();
        NotificationEntity n2 = NotificationEntity.builder().id(2L).userId(meomeoId).isRead(false).build();

        when(notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(meomeoId))
                .thenReturn(List.of(n1, n2));

        int count = notificationService.markAllAsRead(meomeoId);

        assertThat(count).isEqualTo(2);
        assertThat(n1.getIsRead()).isTrue();
        assertThat(n2.getIsRead()).isTrue();
        verify(notificationRepository).saveAll(List.of(n1, n2));
    }
}
