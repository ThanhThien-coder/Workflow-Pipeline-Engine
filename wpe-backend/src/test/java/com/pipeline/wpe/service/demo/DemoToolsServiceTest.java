package com.pipeline.wpe.service.demo;

import com.pipeline.wpe.common.enums.InvitationStatus;
import com.pipeline.wpe.common.enums.JoinPolicy;
import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.common.enums.SystemRole;
import com.pipeline.wpe.dto.response.demo.CompleteAllResponse;
import com.pipeline.wpe.dto.response.graph.GraphNodeResponse;
import com.pipeline.wpe.entity.NodeDependencyEntity;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.ProjectInvitationEntity;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.GuestLinkRepository;
import com.pipeline.wpe.repository.NodeDependencyRepository;
import com.pipeline.wpe.repository.NodeRepository;
import com.pipeline.wpe.repository.ProjectInvitationRepository;
import com.pipeline.wpe.repository.ProjectRepository;
import com.pipeline.wpe.repository.UserRepository;
import com.pipeline.wpe.service.InvitationExpiryJob;
import com.pipeline.wpe.service.ProjectAuthorizationService;
import com.pipeline.wpe.service.admin.AdminAuditAction;
import com.pipeline.wpe.service.admin.AdminAuditService;
import com.pipeline.wpe.service.engine.StateMachineService;
import com.pipeline.wpe.service.engine.TaskOverdueScanner;
import com.pipeline.wpe.service.event.ProjectRealtimeNotifier;
import com.pipeline.wpe.service.event.WorkflowEventPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DemoToolsServiceTest {

    @Mock private ProjectAuthorizationService authorizationService;
    @Mock private UserRepository userRepository;
    @Mock private NodeRepository nodeRepository;
    @Mock private NodeDependencyRepository nodeDependencyRepository;
    @Mock private ProjectRepository projectRepository;
    @Mock private GuestLinkRepository guestLinkRepository;
    @Mock private ProjectInvitationRepository projectInvitationRepository;
    @Mock private TaskOverdueScanner taskOverdueScanner;
    @Mock private StateMachineService stateMachineService;
    @Mock private InvitationExpiryJob invitationExpiryJob;
    @Mock private ProjectRealtimeNotifier projectRealtimeNotifier;
    @Mock private WorkflowEventPublisher eventPublisher;
    @Mock private AdminAuditService adminAuditService;

    private ProjectEntity project;

    @BeforeEach
    void setUp() {
        project = ProjectEntity.builder().id(1L).ownerId(2L).name("P").aiRequestedAt(Instant.now()).build();
        lenient().when(authorizationService.verifyProjectOwner(1L, 2L)).thenReturn(project);
        lenient().when(authorizationService.verifyProjectOwner(1L, 3L))
            .thenThrow(new ForbiddenException("ACCESS_DENIED", "Only the project owner can do this."));
        lenient().when(authorizationService.getProjectOrThrow(1L)).thenReturn(project);
        lenient().when(userRepository.findById(2L))
            .thenReturn(Optional.of(UserEntity.builder().id(2L).systemRole(SystemRole.USER).build()));
        lenient().when(userRepository.findById(3L))
            .thenReturn(Optional.of(UserEntity.builder().id(3L).systemRole(SystemRole.USER).build()));
        lenient().when(userRepository.findById(9L))
            .thenReturn(Optional.of(UserEntity.builder().id(9L).systemRole(SystemRole.ADMIN).build()));
        lenient().when(nodeRepository.saveAndFlush(any(NodeEntity.class))).thenAnswer(i -> i.getArgument(0));
    }

    private DemoToolsService service(boolean enabled) {
        return new DemoToolsService(enabled, authorizationService, userRepository, nodeRepository,
            nodeDependencyRepository, projectRepository, guestLinkRepository, projectInvitationRepository,
            taskOverdueScanner, stateMachineService, invitationExpiryJob, projectRealtimeNotifier,
            eventPublisher, adminAuditService);
    }

    private NodeEntity node(long id, NodeStatus status) {
        return NodeEntity.builder().id(id).projectId(1L).phaseId(10L).code("N" + id)
            .status(status).joinPolicy(JoinPolicy.ALL_COMPLETED).isOverdue(false).build();
    }

    @Test
    @DisplayName("Công cụ demo tắt: mọi thao tác ném 404 và không chạm dữ liệu")
    void disabledThrowsNotFound() {
        DemoToolsService s = service(false);
        assertThat(s.isEnabled()).isFalse();
        assertThatThrownBy(() -> s.resetAiCooldown(1L, 2L))
            .isInstanceOf(ResourceNotFoundException.class).hasMessage("Demo tools are disabled.");
        assertThatThrownBy(() -> s.makeOverdue(1L, 5L, 2L)).isInstanceOf(ResourceNotFoundException.class);
        verifyNoInteractions(taskOverdueScanner, nodeRepository, projectRepository);
    }

    @Test
    @DisplayName("Bật nhưng người gọi không phải chủ dự án: 403")
    void nonOwnerForbidden() {
        DemoToolsService s = service(true);
        assertThatThrownBy(() -> s.resetAiCooldown(1L, 3L)).isInstanceOf(ForbiddenException.class);
        verify(projectRepository, never()).save(any());
    }

    @Test
    @DisplayName("ADMIN hệ thống dùng được dù không phải chủ dự án, và có ghi nhật ký")
    void adminAllowedAndAudited() {
        service(true).resetAiCooldown(1L, 9L);
        assertThat(project.getAiRequestedAt()).isNull();
        verify(adminAuditService).record(eq(9L), any(), eq(AdminAuditAction.DEMO_TOOL_USED), eq("PROJECT"), eq("1"), any());
    }

    @Test
    @DisplayName("make-overdue: hạn chót về quá khứ rồi quét; node chưa DONE thành isOverdue = true")
    void makeOverdueMarksNode() {
        NodeEntity n = node(5L, NodeStatus.TODO);
        when(nodeRepository.findById(5L)).thenReturn(Optional.of(n));
        doAnswer(i -> { n.setIsOverdue(true); return null; }).when(taskOverdueScanner).scanOverdueTasks();

        GraphNodeResponse res = service(true).makeOverdue(1L, 5L, 2L);

        assertThat(n.getDueDate()).isBefore(Instant.now());
        assertThat(res.isOverdue()).isTrue();
        verify(taskOverdueScanner).scanOverdueTasks();
    }

    @Test
    @DisplayName("make-overdue: node thuộc dự án khác -> IllegalArgumentException (400)")
    void makeOverdueWrongProject() {
        NodeEntity n = node(5L, NodeStatus.TODO);
        n.setProjectId(77L);
        when(nodeRepository.findById(5L)).thenReturn(Optional.of(n));
        assertThatThrownBy(() -> service(true).makeOverdue(1L, 5L, 2L)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("force-status DONE: đặt completedAt và mở khóa task sau; trạng thái khác: completedAt = null, không mở khóa")
    void forceStatus() {
        NodeEntity n = node(5L, NodeStatus.TODO);
        when(nodeRepository.findById(5L)).thenReturn(Optional.of(n));

        service(true).forceStatus(1L, 5L, NodeStatus.DONE, 2L);
        assertThat(n.getStatus()).isEqualTo(NodeStatus.DONE);
        assertThat(n.getCompletedAt()).isNotNull();
        verify(stateMachineService).unlockDownstreamTasks(5L);
        verify(projectRealtimeNotifier).notifyTasksChanged(1L, 10L, 5L, "DEMO_FORCE_STATUS");

        service(true).forceStatus(1L, 5L, NodeStatus.IN_PROGRESS, 2L);
        assertThat(n.getStatus()).isEqualTo(NodeStatus.IN_PROGRESS);
        assertThat(n.getCompletedAt()).isNull();
        verify(stateMachineService, times(1)).unlockDownstreamTasks(any());
    }

    @Test
    @DisplayName("complete-all: hoàn thành task cha trước con và mở khóa sau mỗi task")
    void completeAllParentFirst() {
        NodeEntity parent = node(1L, NodeStatus.TODO);
        NodeEntity child = node(2L, NodeStatus.LOCKED);
        NodeEntity done = node(3L, NodeStatus.DONE);
        // Cố ý đặt con đứng trước cha trong danh sách
        when(nodeRepository.findByPhaseId(10L)).thenReturn(List.of(child, done, parent));
        when(nodeDependencyRepository.findByProjectId(1L)).thenReturn(List.of(
            NodeDependencyEntity.builder().id(1L).projectId(1L).parentNodeId(1L).childNodeId(2L).build()));

        CompleteAllResponse res = service(true).completePhase(1L, 10L, 2L);

        assertThat(res.completedCount()).isEqualTo(2);
        assertThat(parent.getStatus()).isEqualTo(NodeStatus.DONE);
        assertThat(child.getStatus()).isEqualTo(NodeStatus.DONE);
        InOrder order = inOrder(stateMachineService);
        order.verify(stateMachineService).unlockDownstreamTasks(1L);
        order.verify(stateMachineService).unlockDownstreamTasks(2L);
        verify(projectRealtimeNotifier).notifyTasksChanged(1L, 10L, null, "DEMO_COMPLETE_PHASE");
    }

    @Test
    @DisplayName("ai-cooldown/reset: xóa aiRequestedAt")
    void resetAiCooldownClears() {
        service(true).resetAiCooldown(1L, 2L);
        assertThat(project.getAiRequestedAt()).isNull();
        verify(projectRepository).save(project);
    }

    @Test
    @DisplayName("invitations/expire: lời mời PENDING bị đặt hết hạn rồi chạy job")
    void expireInvitations() {
        ProjectInvitationEntity inv = ProjectInvitationEntity.builder().id(1L).projectId(1L)
            .status(InvitationStatus.PENDING).expiresAt(Instant.now().plusSeconds(3600)).build();
        when(projectInvitationRepository.findByProjectIdAndStatus(1L, InvitationStatus.PENDING)).thenReturn(List.of(inv));

        var res = service(true).expireInvitations(1L, 2L);

        assertThat(res.expiredCount()).isEqualTo(1);
        assertThat(inv.getExpiresAt()).isBefore(Instant.now());
        verify(invitationExpiryJob).expireOverdueInvitations();
    }

    @Test
    @DisplayName("notifications/test: gửi SYSTEM cho chính người gọi")
    void testNotification() {
        service(true).sendTestNotification(1L, 2L);
        verify(eventPublisher).publishNotification(argThat(e ->
            e.recipientUserId().equals(2L) && e.type().equals("SYSTEM") && e.title().equals("Test notification")
                && e.targetUrl().equals("/project/1/workflow")));
    }
}
