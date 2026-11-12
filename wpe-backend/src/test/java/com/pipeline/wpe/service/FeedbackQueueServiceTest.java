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
        assertThat(response.reviewerName()).isEqualTo("TS. Nguyen Van A");
        assertThat(response.reviewerRole()).isEqualTo(ReviewerRole.TEACHER);
        assertThat(response.status()).isEqualTo(FeedbackStatus.OPEN);

        verify(eventPublisher).publishNotification(any(NotificationEvent.class));
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
            .hasMessageContaining("tối đa 2000 ký tự");

        verify(feedbackRepository, never()).save(any());
    }

    @Test
    @DisplayName("8.2 Get Project Feedbacks - Không phải thành viên ném ACCESS_DENIED, không đọc repository")
    void testGetProjectFeedbacks_AccessDenied() {
        Long strangerId = 999L;
        when(currentUserProvider.requireCurrentUserId()).thenReturn(strangerId);
        when(authorizationService.verifyProjectMemberOrOwner(projectId, strangerId))
            .thenThrow(new ForbiddenException("ACCESS_DENIED", "Bạn không phải là thành viên của dự án này."));

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
            .thenThrow(new ForbiddenException("ACCESS_DENIED", "Chỉ Chủ dự án hoặc Quản lý mới được thực hiện hành động này."));

        assertThatThrownBy(() -> feedbackQueueService.resolveFeedback(projectId, 5L))
            .isInstanceOf(ForbiddenException.class)
            .satisfies(ex -> assertThat(((ForbiddenException) ex).getErrorCode()).isEqualTo("ACCESS_DENIED"));

        verify(feedbackRepository, never()).findById(any());
        verify(feedbackRepository, never()).save(any());
    }
}

