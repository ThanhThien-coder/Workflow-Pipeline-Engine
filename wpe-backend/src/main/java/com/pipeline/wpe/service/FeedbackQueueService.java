package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.FeedbackStatus;
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
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.NodeRepository;
import com.pipeline.wpe.repository.ProjectFeedbackRepository;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.event.WorkflowEventPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class FeedbackQueueService {

    static final int MAX_FEEDBACK_PER_HOUR = 10;
    static final int MAX_CONTENT_LENGTH = 2000;

    private final ProjectFeedbackRepository feedbackRepository;
    private final NodeRepository nodeRepository;
    private final GuestGatewayService guestGatewayService;
    private final ProjectAuthorizationService authorizationService;
    private final WorkflowEventPublisher eventPublisher;
    private final CurrentUserProvider currentUserProvider;

    /**
     * Khách hoặc Giáo viên gửi nhận xét 1 chiều vào dự án / task thông qua Guest Token.
     * Quy tắc tiếp thu 1 chiều: Tuyệt đối không có cơ chế trả lời tranh luận ngược lại.
     */
    @Transactional
    public GuestFeedbackResponse submitGuestFeedback(String token, CreateGuestFeedbackRequest request) {
        GuestLinkEntity guestLink = guestGatewayService.validateAndGetActiveGuestLink(token);
        Long projectId = guestLink.getProjectId();

        if (request.content() != null && request.content().trim().length() > MAX_CONTENT_LENGTH) {
            throw new IllegalArgumentException("Nội dung góp ý tối đa 2000 ký tự.");
        }

        Instant since = Instant.now().minus(Duration.ofHours(1));
        long recent = feedbackRepository.countByProjectIdAndCreatedAtAfter(projectId, since);
        if (recent >= MAX_FEEDBACK_PER_HOUR) {
            long retryAfter = feedbackRepository.findFirstByProjectIdAndCreatedAtAfterOrderByCreatedAtAsc(projectId, since)
                .map(oldest -> {
                    if (oldest.getCreatedAt() == null) {
                        return 3600L;
                    }
                    long seconds = Duration.between(Instant.now(), oldest.getCreatedAt().plus(Duration.ofHours(1))).toSeconds();
                    return Math.max(1L, seconds);
                })
                .orElse(3600L);
            throw new CooldownActiveException(retryAfter);
        }

        ProjectEntity project = authorizationService.getProjectOrThrow(projectId);

        Long validNodeId = null;
        if (request.nodeId() != null) {
            NodeEntity node = nodeRepository.findById(request.nodeId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tác vụ với ID: " + request.nodeId()));
            if (!Objects.equals(node.getProjectId(), projectId)) {
                throw new IllegalArgumentException("Tác vụ này không thuộc về dự án được chia sẻ.");
            }
            validNodeId = node.getId();
        }

        ProjectFeedbackEntity feedback = ProjectFeedbackEntity.builder()
            .projectId(projectId)
            .nodeId(validNodeId)
            .reviewerName(request.reviewerName().trim())
            .reviewerRole(request.reviewerRole())
            .content(request.content().trim())
            .status(FeedbackStatus.OPEN)
            .build();

        feedback = feedbackRepository.save(feedback);
        log.info("Saved guest feedback ID: {} for project: {}, by: {} ({})",
            feedback.getId(), projectId, request.reviewerName(), request.reviewerRole());

        // Bắn Notification Event bất đồng bộ cho Project Owner
        try {
            String targetUrl = "/projects/" + projectId + "/overview";
            String title = String.format("Góp ý mới từ %s (%s)", request.reviewerName(), request.reviewerRole());
            eventPublisher.publishNotification(new NotificationEvent(
                project.getOwnerId(),
                projectId,
                title,
                request.content().trim(),
                "FEEDBACK",
                targetUrl,
                Instant.now()
            ));
        } catch (Exception e) {
            log.warn("Failed to publish feedback notification: {}", e.getMessage());
        }

        return new GuestFeedbackResponse(
            feedback.getId(),
            feedback.getProjectId(),
            feedback.getNodeId(),
            feedback.getReviewerName(),
            feedback.getReviewerRole(),
            feedback.getContent(),
            feedback.getStatus(),
            feedback.getCreatedAt() != null ? feedback.getCreatedAt() : Instant.now()
        );
    }

    /**
     * Thành viên dự án xem danh sách các phản hồi nhận được trên Overview Dashboard.
     */
    @Transactional(readOnly = true)
    public List<ProjectFeedbackResponse> getProjectFeedbacks(Long projectId) {
        Long currentUserId = currentUserProvider.requireCurrentUserId();
        authorizationService.verifyProjectMemberOrOwner(projectId, currentUserId);

        List<ProjectFeedbackEntity> feedbacks = feedbackRepository.findByProjectIdOrderByCreatedAtDesc(projectId);
        if (feedbacks.isEmpty()) {
            return List.of();
        }

        // Batch load node info for efficiency
        Set<Long> nodeIds = feedbacks.stream()
            .map(ProjectFeedbackEntity::getNodeId)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());

        Map<Long, NodeEntity> nodeMap = nodeIds.isEmpty() ? Map.of() :
            nodeRepository.findAllById(nodeIds).stream()
                .collect(Collectors.toMap(NodeEntity::getId, n -> n));

        return feedbacks.stream().map(fb -> {
            ProjectFeedbackResponse.FeedbackNodeRef nodeRef = null;
            if (fb.getNodeId() != null && nodeMap.containsKey(fb.getNodeId())) {
                NodeEntity node = nodeMap.get(fb.getNodeId());
                nodeRef = new ProjectFeedbackResponse.FeedbackNodeRef(node.getId(), node.getCode(), node.getTitle());
            }
            return new ProjectFeedbackResponse(
                fb.getId(),
                fb.getReviewerName(),
                fb.getReviewerRole(),
                nodeRef,
                fb.getContent(),
                fb.getStatus(),
                fb.getCreatedAt()
            );
        }).toList();
    }

    /**
     * Thành viên dự án tiếp thu ý kiến và bấm "Đánh dấu Đã xử lý" (OPEN -> RESOLVED).
     * Tuyệt đối không gửi tin nhắn trả lời lại khách.
     */
    @Transactional
    public ResolveFeedbackResponse resolveFeedback(Long projectId, Long feedbackId) {
        Long currentUserId = currentUserProvider.requireCurrentUserId();
        authorizationService.verifyProjectMemberOrOwner(projectId, currentUserId);

        ProjectFeedbackEntity feedback = feedbackRepository.findById(feedbackId)
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bản ghi góp ý với ID: " + feedbackId));

        if (!Objects.equals(feedback.getProjectId(), projectId)) {
            throw new IllegalArgumentException("Bản ghi góp ý không thuộc về dự án này.");
        }

        feedback.setStatus(FeedbackStatus.RESOLVED);
        feedbackRepository.save(feedback);
        log.info("Resolved feedback ID: {} in project: {} by user: {}", feedbackId, projectId, currentUserId);

        return new ResolveFeedbackResponse(true, feedback.getId(), FeedbackStatus.RESOLVED);
    }
}

