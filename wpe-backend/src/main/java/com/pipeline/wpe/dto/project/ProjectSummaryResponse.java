package com.pipeline.wpe.dto.project;

import com.pipeline.wpe.entity.ProjectEntity;

import java.time.Instant;

public record ProjectSummaryResponse(
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
    int nodeCount,
    int activeNodes,
    int doneNodes
) {
    public static ProjectSummaryResponse fromEntity(
        ProjectEntity project,
        String ownerName,
        int totalNodes,
        int completedNodes,
        int inProgressNodes,
        double progressPercentage
    ) {
        if (project == null) {
            return null;
        }
        return new ProjectSummaryResponse(
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
            totalNodes,
            inProgressNodes,
            completedNodes
        );
    }

    public static ProjectSummaryResponse fromEntity(
        ProjectEntity project,
        String ownerName,
        int totalNodes,
        int completedNodes,
        int inProgressNodes
    ) {
        if (project == null) {
            return null;
        }
        double progress = totalNodes > 0
            ? Math.round(((double) completedNodes / totalNodes) * 10000.0) / 100.0
            : 0.0;
        return fromEntity(project, ownerName, totalNodes, completedNodes, inProgressNodes, progress);
    }

    public static ProjectSummaryResponse withNodeStats(
        ProjectEntity project,
        String ownerName,
        int nodeCount,
        int activeNodes,
        int doneNodes,
        int inProgressNodes
    ) {
        if (project == null) {
            return null;
        }
        int totalNodes = nodeCount;
        int completedNodes = doneNodes;
        double progress = totalNodes > 0
            ? Math.round(((double) completedNodes / totalNodes) * 10000.0) / 100.0
            : 0.0;
        return new ProjectSummaryResponse(
            project.getId(),
            project.getName(),
            project.getDescription(),
            project.getStatus() != null ? project.getStatus().name() : null,
            project.getOwnerId(),
            ownerName,
            totalNodes,
            completedNodes,
            inProgressNodes,
            progress,
            project.getCreatedAt(),
            project.getUpdatedAt(),
            nodeCount,
            activeNodes,
            doneNodes
        );
    }
}
