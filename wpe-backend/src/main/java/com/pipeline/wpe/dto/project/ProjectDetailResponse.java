package com.pipeline.wpe.dto.project;

import com.pipeline.wpe.entity.ProjectEntity;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record ProjectDetailResponse(
    Long id,
    String name,
    String description,
    String status,
    Long ownerId,
    String ownerName,
    int totalNodes,
    int completedNodes,
    int inProgressNodes,
    double progressPercentage,
    Instant createdAt,
    Instant updatedAt,
    Map<String, Object> latestAiAnalysis,
    List<WorkPhaseSummaryResponse> phases
) {
    public ProjectDetailResponse {
        if (phases == null) {
            phases = List.of();
        }
    }

    public static ProjectDetailResponse fromEntity(
        ProjectEntity project,
        String ownerName,
        int totalNodes,
        int completedNodes,
        int inProgressNodes,
        List<WorkPhaseSummaryResponse> phases
    ) {
        if (project == null) {
            return null;
        }
        double progressPercentage = totalNodes > 0
            ? Math.round(((double) completedNodes / totalNodes) * 10000.0) / 100.0
            : 0.0;

        return new ProjectDetailResponse(
            project.getId(),
            project.getName(),
            project.getDescription(),
            project.getStatus() != null ? project.getStatus().name() : null,
            project.getOwnerId(),
            ownerName,
            totalNodes,
            completedNodes,
            inProgressNodes,
            progressPercentage,
            project.getCreatedAt(),
            project.getUpdatedAt(),
            project.getLatestAiAnalysis(),
            phases != null ? phases : List.of()
        );
    }

    public static ProjectDetailResponse fromEntity(
        ProjectEntity project,
        String ownerName,
        int totalNodes,
        int completedNodes,
        int inProgressNodes
    ) {
        return fromEntity(project, ownerName, totalNodes, completedNodes, inProgressNodes, List.of());
    }

    public static ProjectDetailResponse fromSummary(
        ProjectSummaryResponse summary,
        Map<String, Object> latestAiAnalysis,
        List<WorkPhaseSummaryResponse> phases
    ) {
        if (summary == null) {
            return null;
        }
        return new ProjectDetailResponse(
            summary.id(),
            summary.name(),
            summary.description(),
            summary.status(),
            summary.ownerId(),
            summary.ownerName(),
            summary.totalNodes(),
            summary.completedNodes(),
            summary.inProgressNodes(),
            summary.progressPercentage(),
            summary.createdAt(),
            summary.updatedAt(),
            latestAiAnalysis,
            phases != null ? phases : List.of()
        );
    }
}
