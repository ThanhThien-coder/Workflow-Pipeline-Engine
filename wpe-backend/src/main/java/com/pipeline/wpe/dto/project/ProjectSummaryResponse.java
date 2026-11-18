package com.pipeline.wpe.dto.project;

import com.pipeline.wpe.entity.ProjectEntity;

import java.time.Instant;
import java.util.List;

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
    int doneNodes,
    List<ProjectMemberBrief> members,
    /** Số node trên chuỗi phụ thuộc dài nhất (định nghĩa chung: CriticalPathCalculator). */
    int criticalPathLength
) {
    /** Constructor cũ (chưa có độ dài đường găng, mặc định 0). */
    public ProjectSummaryResponse(
        Long id, String name, String description, String status, Long ownerId, String ownerName,
        int totalNodes, int completedNodes, int inProgressNodes, double progressPercentage,
        Instant createdAt, Instant updatedAt, int nodeCount, int activeNodes, int doneNodes,
        List<ProjectMemberBrief> members
    ) {
        this(id, name, description, status, ownerId, ownerName, totalNodes, completedNodes, inProgressNodes,
            progressPercentage, createdAt, updatedAt, nodeCount, activeNodes, doneNodes, members, 0);
    }

    /** Constructor cũ (chưa có danh sách thành viên). */
    public ProjectSummaryResponse(
        Long id, String name, String description, String status, Long ownerId, String ownerName,
        int totalNodes, int completedNodes, int inProgressNodes, double progressPercentage,
        Instant createdAt, Instant updatedAt, int nodeCount, int activeNodes, int doneNodes
    ) {
        this(id, name, description, status, ownerId, ownerName, totalNodes, completedNodes, inProgressNodes,
            progressPercentage, createdAt, updatedAt, nodeCount, activeNodes, doneNodes, List.of(), 0);
    }

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
            completedNodes,
            List.of()
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
        return withNodeStats(project, ownerName, nodeCount, activeNodes, doneNodes, inProgressNodes, List.of());
    }

    public static ProjectSummaryResponse withNodeStats(
        ProjectEntity project,
        String ownerName,
        int nodeCount,
        int activeNodes,
        int doneNodes,
        int inProgressNodes,
        List<ProjectMemberBrief> members
    ) {
        return withNodeStats(project, ownerName, nodeCount, activeNodes, doneNodes, inProgressNodes, members, 0);
    }

    public static ProjectSummaryResponse withNodeStats(
        ProjectEntity project,
        String ownerName,
        int nodeCount,
        int activeNodes,
        int doneNodes,
        int inProgressNodes,
        List<ProjectMemberBrief> members,
        int criticalPathLength
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
            doneNodes,
            members != null ? members : List.of(),
            criticalPathLength
        );
    }
}
