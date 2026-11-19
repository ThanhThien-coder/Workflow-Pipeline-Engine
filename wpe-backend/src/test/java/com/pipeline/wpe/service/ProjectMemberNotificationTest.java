package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.dto.event.NotificationEvent;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.ProjectMemberEntity;
import com.pipeline.wpe.repository.NodeRepository;
import com.pipeline.wpe.repository.ProjectMemberRepository;
import com.pipeline.wpe.repository.ProjectRepository;
import com.pipeline.wpe.repository.UserRepository;
import com.pipeline.wpe.service.event.WorkflowEventPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProjectMemberNotificationTest {

    @Mock private ProjectAuthorizationService projectAuthorizationService;
    @Mock private ProjectRepository projectRepository;
    @Mock private ProjectMemberRepository projectMemberRepository;
    @Mock private UserRepository userRepository;
    @Mock private NodeRepository nodeRepository;
    @Mock private WorkflowEventPublisher eventPublisher;
    @InjectMocks private ProjectMemberService service;

    private ProjectEntity project;
    private ProjectMemberEntity member;

    @BeforeEach
    void setUp() {
        project = ProjectEntity.builder().id(1L).ownerId(1L).name("Demo Project").build();
        member = ProjectMemberEntity.builder().id(10L).projectId(1L).userId(2L).role(ProjectRole.COLLABORATOR).build();
        lenient().when(projectAuthorizationService.verifyProjectOwner(1L, 1L)).thenReturn(project);
        lenient().when(projectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull(1L, 2L)).thenReturn(Optional.of(member));
        lenient().when(projectMemberRepository.save(any(ProjectMemberEntity.class))).thenAnswer(i -> i.getArgument(0));
        lenient().when(userRepository.findById(any())).thenReturn(Optional.empty());
    }

    @Test
    @DisplayName("updateRole sang MANAGER gửi đúng 1 thông báo ROLE_CHANGED cho người bị đổi")
    void updateRoleSendsOneNotification() {
        service.updateRole(1L, 2L, ProjectRole.MANAGER, 1L);

        ArgumentCaptor<NotificationEvent> captor = ArgumentCaptor.forClass(NotificationEvent.class);
        verify(eventPublisher, times(1)).publishNotification(captor.capture());
        NotificationEvent e = captor.getValue();
        assertThat(e.recipientUserId()).isEqualTo(2L);
        assertThat(e.type()).isEqualTo("ROLE_CHANGED");
        assertThat(e.title()).isEqualTo("Your project role changed");
        assertThat(e.message()).isEqualTo("You are now MANAGER in project \"Demo Project\".");
        assertThat(e.targetUrl()).isEqualTo("/project/1/workflow");
    }

    @Test
    @DisplayName("updateRole sang đúng vai trò cũ thì không gửi thông báo")
    void updateRoleSameRoleSendsNothing() {
        service.updateRole(1L, 2L, ProjectRole.COLLABORATOR, 1L);
        verify(eventPublisher, never()).publishNotification(any());
    }

    @Test
    @DisplayName("updateRole chuyển chủ dự án gửi 2 thông báo cho chủ mới (OWNER) và chủ cũ (COLLABORATOR)")
    void transferOwnerNotifiesBoth() {
        ProjectMemberEntity oldOwner = ProjectMemberEntity.builder().id(9L).projectId(1L).userId(1L).role(ProjectRole.OWNER).build();
        when(projectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull(1L, 1L)).thenReturn(Optional.of(oldOwner));

        service.updateRole(1L, 2L, ProjectRole.OWNER, 1L);

        ArgumentCaptor<NotificationEvent> captor = ArgumentCaptor.forClass(NotificationEvent.class);
        verify(eventPublisher, times(2)).publishNotification(captor.capture());
        List<NotificationEvent> events = captor.getAllValues();
        assertThat(events).extracting(NotificationEvent::recipientUserId).containsExactlyInAnyOrder(2L, 1L);
        assertThat(events).extracting(NotificationEvent::type).containsOnly("ROLE_CHANGED");
        assertThat(events.stream().filter(e -> e.recipientUserId() == 2L).findFirst().get().message()).contains("OWNER");
        assertThat(events.stream().filter(e -> e.recipientUserId() == 1L).findFirst().get().message()).contains("COLLABORATOR");
    }

    @Test
    @DisplayName("removeMember gửi thông báo MEMBER_REMOVED cho người bị xóa")
    void removeMemberNotifies() {
        when(nodeRepository.findByProjectIdAndAssignedUserIdAndStatusNot(any(), any(), any())).thenReturn(List.of());

        service.removeMember(1L, 2L, 1L);

        ArgumentCaptor<NotificationEvent> captor = ArgumentCaptor.forClass(NotificationEvent.class);
        verify(eventPublisher, times(1)).publishNotification(captor.capture());
        NotificationEvent e = captor.getValue();
        assertThat(e.recipientUserId()).isEqualTo(2L);
        assertThat(e.type()).isEqualTo("MEMBER_REMOVED");
        assertThat(e.title()).isEqualTo("Removed from project");
        assertThat(e.message()).isEqualTo("You were removed from project \"Demo Project\".");
        assertThat(e.targetUrl()).isEqualTo("/workspaces?removedFrom=1");
    }

    @Test
    @DisplayName("Gửi thông báo lỗi không làm hỏng thao tác chính")
    void notificationFailureDoesNotBreakOperation() {
        doThrow(new RuntimeException("rabbit down")).when(eventPublisher).publishNotification(any());
        service.updateRole(1L, 2L, ProjectRole.VIEWER, 1L);
        assertThat(member.getRole()).isEqualTo(ProjectRole.VIEWER);
    }
}
