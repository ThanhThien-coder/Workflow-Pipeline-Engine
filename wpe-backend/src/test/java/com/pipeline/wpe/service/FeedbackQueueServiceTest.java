package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.FeedbackStatus;
import com.pipeline.wpe.common.enums.ReviewerRole;
import com.pipeline.wpe.dto.event.NotificationEvent;
import com.pipeline.wpe.dto.request.feedback.CreateGuestFeedbackRequest;
import com.pipeline.wpe.dto.response.feedback.GuestFeedbackResponse;
import com.pipeline.wpe.dto.response.feedback.ProjectFeedbackResponse;
import com.pipeline.wpe.dto.response.feedback.ResolveFeedbackResponse;
import com.pipeline.wpe.entity.GuestLinkEntity;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.ProjectFeedbackEntity;
import com.pipeline.wpe.exception.CooldownActiveException;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.repository.NodeRepository;
import com.pipeline.wpe.repository.ProjectFeedbackRepository;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.event.WorkflowEventPublisher;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FeedbackQueueServiceTest {

    @Mock
    private ProjectFeedbackRepository feedbackRepository;

    @Mock
    private NodeRepository nodeRepository;

    @Mock
    private GuestGatewayService guestGatewayService;

    @Mock
    private ProjectAuthorizationService authorizationService;

    @Mock
    private WorkflowEventPublisher eventPublisher;

    @Mock
    private CurrentUserProvider currentUserProvider;

    @Mock private com.pipeline.wpe.service.event.ProjectRealtimeNotifier projectRealtimeNotifier;

    @Mock private com.pipeline.wpe.repository.ProjectMemberRepository projectMemberRepository;

    @InjectMocks
    private FeedbackQueueService feedbackQueueService;

    private final Long projectId = 1L;
    private final Long ownerId = 2L;

    @Test
    @DisplayName("8.1 Submit Guest Feedback - Khách gửi nhận xét 1 chiều thành công")
    void testSubmitGuestFeedback_Success() {
        String token = "guest-token-123";
        CreateGuestFeedbackRequest request = new CreateGuestFeedbackRequest(
            "TS. Nguyen Van A",
            ReviewerRole.TEACHER,
            "Cần bổ sung thêm sơ đồ Sequence Diagram.",
            null
        );

        GuestLinkEntity link = GuestLinkEntity.builder().projectId(projectId).token(token).build();
        ProjectEntity project = ProjectEntity.builder().id(projectId).ownerId(ownerId).name("Core Banking").build();

        when(guestGatewayService.validateAndGetActiveGuestLink(token)).thenReturn(link);
        when(feedbackRepository.countByProjectIdAndCreatedAtAfter(eq(projectId), any(Instant.class))).thenReturn(0L);
        when(authorizationService.getProjectOrThrow(projectId)).thenReturn(project);
        when(feedbackRepository.save(any(ProjectFeedbackEntity.class))).thenAnswer(inv -> {
            ProjectFeedbackEntity fb = inv.getArgument(0);
            fb.setId(101L);
            return fb;
        });

        GuestFeedbackResponse response = feedbackQueueService.submitGuestFeedback(token, request);

        assertThat(response.id()).isEqualTo(101L);
        verify(projectRealtimeNotifier).notifyProjectChanged(any(), eq("FEEDBACK"), eq("FEEDBACK_CREATED"), isNull(), isNull(), any());
        assertThat(response.reviewerName()).isEqualTo("TS. Nguyen Van A");
        assertThat(response.reviewerRole()).isEqualTo(ReviewerRole.TEACHER);
        assertThat(response.status()).isEqualTo(FeedbackStatus.OPEN);

        org.mockito.ArgumentCaptor<NotificationEvent> event = org.mockito.ArgumentCaptor.forClass(NotificationEvent.class);
        verify(eventPublisher).publishNotification(event.capture());
        assertThat(event.getValue().title()).isEqualTo("New feedback from TS. Nguyen Van A on the project");
    }

    @Test
    @DisplayName("Thông báo góp ý gửi cho owner và manager còn trong dự án, tiêu đề ghi mã task")
    void testSubmitGuestFeedback_NotifiesOwnerAndManagers() {
        String token = "guest-token-123";
        Long nodeId = 50L;
        CreateGuestFeedbackRequest request = new CreateGuestFeedbackRequest("Dr. Tran", ReviewerRole.GUEST, "Looks good", nodeId);
        GuestLinkEntity link = GuestLinkEntity.builder().projectId(projectId).token(token).build();
        ProjectEntity project = ProjectEntity.builder().id(projectId).ownerId(ownerId).name("Core Banking").build();
        NodeEntity node = NodeEntity.builder().id(nodeId).projectId(projectId).code("WPE-005").build();

        when(guestGatewayService.validateAndGetActiveGuestLink(token)).thenReturn(link);
        when(feedbackRepository.countByProjectIdAndCreatedAtAfter(eq(projectId), any(Instant.class))).thenReturn(0L);
        when(authorizationService.getProjectOrThrow(projectId)).thenReturn(project);
        when(nodeRepository.findById(nodeId)).thenReturn(Optional.of(node));
        when(feedbackRepository.save(any(ProjectFeedbackEntity.class))).thenAnswer(inv -> inv.getArgument(0));
        when(projectMemberRepository.findByProjectIdAndRemovedAtIsNull(projectId)).thenReturn(List.of(
            com.pipeline.wpe.entity.ProjectMemberEntity.builder().projectId(projectId).userId(ownerId).role(com.pipeline.wpe.common.enums.ProjectRole.OWNER).build(),
            com.pipeline.wpe.entity.ProjectMemberEntity.builder().projectId(projectId).userId(7L).role(com.pipeline.wpe.common.enums.ProjectRole.MANAGER).build(),
            com.pipeline.wpe.entity.ProjectMemberEntity.builder().projectId(projectId).userId(8L).role(com.pipeline.wpe.common.enums.ProjectRole.COLLABORATOR).build()));

        feedbackQueueService.submitGuestFeedback(token, request);

        org.mockito.ArgumentCaptor<NotificationEvent> event = org.mockito.ArgumentCaptor.forClass(NotificationEvent.class);
        verify(eventPublisher, times(2)).publishNotification(event.capture());
        assertThat(event.getAllValues()).extracting(NotificationEvent::recipientUserId).containsExactly(ownerId, 7L);
        assertThat(event.getValue().title()).isEqualTo("New feedback from Dr. Tran on WPE-005");
    }

    @Test
    @DisplayName("Tiêu đề thông báo: góp ý cho phase lấy phạm vi từ tiền tố [Phase N · tên]")
    void testFeedbackTitle_PhaseScope() {
        assertThat(FeedbackQueueService.feedbackTitle("An", null, "[Phase 2 · Design] Missing ERD"))
            .isEqualTo("New feedback from An on Phase 2 · Design");
        assertThat(FeedbackQueueService.feedbackTitle("Anonymous", null, "General comment"))
            .isEqualTo("New feedback from Anonymous on the project");
    }

    @Test
    @DisplayName("8.2 Get Project Feedbacks - Trả về danh sách góp ý của dự án")
    void testGetProjectFeedbacks_Success() {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(ownerId);
        when(authorizationService.verifyProjectMemberOrOwner(projectId, ownerId)).thenReturn(new ProjectEntity());

        ProjectFeedbackEntity fb = ProjectFeedbackEntity.builder()
            .id(1L)
            .projectId(projectId)
            .nodeId(2L)
            .reviewerName("Giáo viên B")
            .reviewerRole(ReviewerRole.TEACHER)
            .content("Góp ý 1")
            .status(FeedbackStatus.OPEN)
            .createdAt(Instant.now())
            .build();

        NodeEntity node = NodeEntity.builder().id(2L).code("WPE-002").title("Đặc tả Swagger").build();

        when(feedbackRepository.findByProjectIdOrderByCreatedAtDesc(projectId)).thenReturn(List.of(fb));
        when(nodeRepository.findAllById(any())).thenReturn(List.of(node));

        List<ProjectFeedbackResponse> result = feedbackQueueService.getProjectFeedbacks(projectId);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).reviewerName()).isEqualTo("Giáo viên B");
        assertThat(result.get(0).nodeRef()).isNotNull();
        assertThat(result.get(0).nodeRef().code()).isEqualTo("WPE-002");
    }

    @Test
    @DisplayName("8.3 Resolve Feedback - Đổi trạng thái sang RESOLVED 1 chiều")
    void testResolveFeedback_Success() {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(ownerId);
        when(authorizationService.verifyProjectOwnerOrManager(projectId, ownerId)).thenReturn(new ProjectEntity());

        ProjectFeedbackEntity fb = ProjectFeedbackEntity.builder()
            .id(5L)
            .projectId(projectId)
            .reviewerName("Khách C")
            .reviewerRole(ReviewerRole.GUEST)
            .content("Nội dung")
            .status(FeedbackStatus.OPEN)
            .build();

        when(feedbackRepository.findById(5L)).thenReturn(Optional.of(fb));

        ResolveFeedbackResponse response = feedbackQueueService.resolveFeedback(projectId, 5L);

        assertThat(response.success()).isTrue();
        assertThat(response.feedbackId()).isEqualTo(5L);
        assertThat(response.status()).isEqualTo(FeedbackStatus.RESOLVED);
        assertThat(fb.getStatus()).isEqualTo(FeedbackStatus.RESOLVED);
        verify(feedbackRepository).save(fb);
        verify(projectRealtimeNotifier).notifyProjectChanged(eq(projectId), eq("FEEDBACK"), eq("FEEDBACK_RESOLVED"), any(), isNull(), any());
    }

    @Test
    @DisplayName("8.1 Submit Guest Feedback - Vượt quá 10 góp ý/giờ ném CooldownActiveException (HTTP 429)")
    void testSubmitGuestFeedback_RateLimitExceeded() {
        String token = "guest-token-123";
        CreateGuestFeedbackRequest request = new CreateGuestFeedbackRequest(
            "Khách",
            ReviewerRole.GUEST,
            "Nội dung nhận xét",
            null
        );

        GuestLinkEntity link = GuestLinkEntity.builder().projectId(projectId).token(token).build();
        Instant twentyMinutesAgo = Instant.now().minus(Duration.ofMinutes(20));
        ProjectFeedbackEntity oldest = ProjectFeedbackEntity.builder()
            .id(99L)
            .projectId(projectId)
            .createdAt(twentyMinutesAgo)
            .build();

        when(guestGatewayService.validateAndGetActiveGuestLink(token)).thenReturn(link);
        when(feedbackRepository.countByProjectIdAndCreatedAtAfter(eq(projectId), any(Instant.class))).thenReturn(10L);
        when(feedbackRepository.findFirstByProjectIdAndCreatedAtAfterOrderByCreatedAtAsc(eq(projectId), any(Instant.class)))
            .thenReturn(Optional.of(oldest));

        assertThatThrownBy(() -> feedbackQueueService.submitGuestFeedback(token, request))
            .isInstanceOf(CooldownActiveException.class)
            .satisfies(ex -> {
                CooldownActiveException cae = (CooldownActiveException) ex;
                assertThat(cae.getRemainingSeconds()).isBetween(2390L, 2400L);
            });

        verify(feedbackRepository, never()).save(any());
    }

    @Test
    @DisplayName("8.1 Submit Guest Feedback - 9 góp ý trong giờ (góp ý thứ 10) vẫn lưu bình thường")
    void testSubmitGuestFeedback_TenthFeedbackSuccess() {
        String token = "guest-token-123";
        CreateGuestFeedbackRequest request = new CreateGuestFeedbackRequest(
            "Khách 10",
            ReviewerRole.GUEST,
            "Nội dung thứ 10",
            null
        );

        GuestLinkEntity link = GuestLinkEntity.builder().projectId(projectId).token(token).build();
        ProjectEntity project = ProjectEntity.builder().id(projectId).ownerId(ownerId).name("Core Banking").build();

        when(guestGatewayService.validateAndGetActiveGuestLink(token)).thenReturn(link);
        when(feedbackRepository.countByProjectIdAndCreatedAtAfter(eq(projectId), any(Instant.class))).thenReturn(9L);
        when(authorizationService.getProjectOrThrow(projectId)).thenReturn(project);
        when(feedbackRepository.save(any(ProjectFeedbackEntity.class))).thenAnswer(inv -> {
            ProjectFeedbackEntity fb = inv.getArgument(0);
            fb.setId(102L);
            return fb;
        });

        GuestFeedbackResponse response = feedbackQueueService.submitGuestFeedback(token, request);

        assertThat(response).isNotNull();
        assertThat(response.id()).isEqualTo(102L);
        assertThat(response.reviewerName()).isEqualTo("Khách 10");
        verify(feedbackRepository).save(any(ProjectFeedbackEntity.class));
    }

    @Test
    @DisplayName("8.1 Submit Guest Feedback - Nội dung dài hơn 2000 ký tự ném IllegalArgumentException")
    void testSubmitGuestFeedback_ContentTooLong() {
        String token = "guest-token-123";
        String longContent = "a".repeat(2001);
        CreateGuestFeedbackRequest request = new CreateGuestFeedbackRequest(
            "Khách",
            ReviewerRole.GUEST,
            longContent,
            null
        );

        GuestLinkEntity link = GuestLinkEntity.builder().projectId(projectId).token(token).build();
        when(guestGatewayService.validateAndGetActiveGuestLink(token)).thenReturn(link);

        assertThatThrownBy(() -> feedbackQueueService.submitGuestFeedback(token, request))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("at most 2,000 characters");

        verify(feedbackRepository, never()).save(any());
    }

    @Test
    @DisplayName("8.2 Get Project Feedbacks - Không phải thành viên ném ACCESS_DENIED, không đọc repository")
    void testGetProjectFeedbacks_AccessDenied() {
        Long strangerId = 999L;
        when(currentUserProvider.requireCurrentUserId()).thenReturn(strangerId);
        when(authorizationService.verifyProjectMemberOrOwner(projectId, strangerId))
            .thenThrow(new ForbiddenException("ACCESS_DENIED", "You are not a member of this project."));

        assertThatThrownBy(() -> feedbackQueueService.getProjectFeedbacks(projectId))
            .isInstanceOf(ForbiddenException.class)
            .satisfies(ex -> assertThat(((ForbiddenException) ex).getErrorCode()).isEqualTo("ACCESS_DENIED"));

        verify(feedbackRepository, never()).findByProjectIdOrderByCreatedAtDesc(any());
    }

    @Test
    @DisplayName("8.3 Resolve Feedback - Không có quyền ném ACCESS_DENIED từ verifyProjectOwnerOrManager, không ghi repository")
    void testResolveFeedback_AccessDenied() {
        Long strangerId = 999L;
        when(currentUserProvider.requireCurrentUserId()).thenReturn(strangerId);
        when(authorizationService.verifyProjectOwnerOrManager(projectId, strangerId))
            .thenThrow(new ForbiddenException("ACCESS_DENIED", "Only the project owner or a manager can do this."));

        assertThatThrownBy(() -> feedbackQueueService.resolveFeedback(projectId, 5L))
            .isInstanceOf(ForbiddenException.class)
            .satisfies(ex -> assertThat(((ForbiddenException) ex).getErrorCode()).isEqualTo("ACCESS_DENIED"));

        verify(feedbackRepository, never()).findById(any());
        verify(feedbackRepository, never()).save(any());
    }

    @Test
    @DisplayName("G2 Submit Guest Feedback - nodeId không tồn tại và nodeId dự án khác cho cùng lỗi INVALID_NODE")
    void testSubmitGuestFeedback_InvalidNodeIdsReturnSameError() {
        String token = "guest-token-123";
        GuestLinkEntity link = GuestLinkEntity.builder().projectId(projectId).token(token).build();
        ProjectEntity project = ProjectEntity.builder().id(projectId).ownerId(ownerId).name("Core Banking").build();
        when(guestGatewayService.validateAndGetActiveGuestLink(token)).thenReturn(link);
        when(feedbackRepository.countByProjectIdAndCreatedAtAfter(eq(projectId), any(Instant.class))).thenReturn(0L);
        when(authorizationService.getProjectOrThrow(projectId)).thenReturn(project);

        when(nodeRepository.findById(404L)).thenReturn(Optional.empty());
        when(nodeRepository.findById(999L)).thenReturn(Optional.of(
            NodeEntity.builder().id(999L).projectId(99L).code("OTH-1").build()
        ));

        CreateGuestFeedbackRequest missingNodeReq = new CreateGuestFeedbackRequest(
            "Khách", ReviewerRole.GUEST, "Góp ý", 404L);
        CreateGuestFeedbackRequest foreignNodeReq = new CreateGuestFeedbackRequest(
            "Khách", ReviewerRole.GUEST, "Góp ý", 999L);

        assertThatThrownBy(() -> feedbackQueueService.submitGuestFeedback(token, missingNodeReq))
            .isExactlyInstanceOf(IllegalArgumentException.class)
            .hasMessage("INVALID_NODE: The selected task is not part of this project.");

        assertThatThrownBy(() -> feedbackQueueService.submitGuestFeedback(token, foreignNodeReq))
            .isExactlyInstanceOf(IllegalArgumentException.class)
            .hasMessage("INVALID_NODE: The selected task is not part of this project.");

        verify(feedbackRepository, never()).save(any());
    }
}

