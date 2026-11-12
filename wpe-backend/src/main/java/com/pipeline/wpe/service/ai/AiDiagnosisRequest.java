package com.pipeline.wpe.service.ai;

import com.pipeline.wpe.entity.NodeDependencyEntity;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.ProjectFeedbackEntity;

import java.time.Instant;
import java.util.List;

public record AiDiagnosisRequest(
        Long projectId,
        String projectName,
        String projectStatus,
        String requestedAt,
        List<NodeDto> nodes,
        List<DependencyDto> dependencies,
        List<FeedbackDto> openFeedbacks
) {
    public record NodeDto(
            Long id,
            String code,
            String title,
            String status,
            Long phaseId,
            Integer estimatedHours,
            String startedAt,
            String dueDate,
            Boolean isOverdue,
            Long assignedUserId,
            String joinPolicy
    ) {}

    public record DependencyDto(
            Long parentNodeId,
            Long childNodeId
    ) {}

    public record FeedbackDto(
            Long id,
            Long nodeId,
            String reviewerRole,
            String content,
            String createdAt
    ) {}

    public static AiDiagnosisRequest from(
            ProjectEntity project,
            List<NodeEntity> nodes,
            List<NodeDependencyEntity> deps,
            List<ProjectFeedbackEntity> feedbacks,
            Instant now
    ) {
        Long projectId = project != null ? project.getId() : null;
        String projectName = project != null ? project.getName() : null;
        String projectStatus = (project != null && project.getStatus() != null)
                ? project.getStatus().name()
                : null;
        String requestedAt = now != null ? now.toString() : null;

        List<NodeDto> nodeDtos = (nodes != null)
                ? nodes.stream().map(node -> new NodeDto(
                        node.getId(),
                        node.getCode(),
                        node.getTitle(),
                        node.getStatus() != null ? node.getStatus().name() : null,
                        node.getPhaseId(),
                        node.getEstimatedHours(),
                        node.getStartedAt() != null ? node.getStartedAt().toString() : null,
                        node.getDueDate() != null ? node.getDueDate().toString() : null,
                        node.getIsOverdue(),
                        node.getAssignedUserId(),
                        node.getJoinPolicy() != null ? node.getJoinPolicy().name() : null
                )).toList()
                : List.of();

        List<DependencyDto> depDtos = (deps != null)
                ? deps.stream().map(dep -> new DependencyDto(
                        dep.getParentNodeId(),
                        dep.getChildNodeId()
                )).toList()
                : List.of();

        List<FeedbackDto> feedbackDtos = (feedbacks != null)
                ? feedbacks.stream().map(fb -> new FeedbackDto(
                        fb.getId(),
                        fb.getNodeId(),
                        fb.getReviewerRole() != null ? fb.getReviewerRole().name() : null,
                        fb.getContent(),
                        fb.getCreatedAt() != null ? fb.getCreatedAt().toString() : null
                )).toList()
                : List.of();

        return new AiDiagnosisRequest(projectId, projectName, projectStatus, requestedAt, nodeDtos, depDtos, feedbackDtos);
    }
}
