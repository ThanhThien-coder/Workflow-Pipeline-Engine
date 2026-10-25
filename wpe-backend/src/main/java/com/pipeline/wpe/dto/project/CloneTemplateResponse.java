package com.pipeline.wpe.dto.project;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Schema(description = "Phản hồi kết quả nhân bản quy trình mẫu kèm số liệu thống kê")
public record CloneTemplateResponse(
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
    int clonedPhasesCount,
    int clonedNodesCount,
    int clonedDependenciesCount,
    Instant createdAt,
    Instant updatedAt,
    Map<String, Object> latestAiAnalysis,
    List<WorkPhaseSummaryResponse> phases
) {
    public static CloneTemplateResponse fromProjectDetail(
        ProjectDetailResponse detail,
        int clonedPhasesCount,
        int clonedNodesCount,
        int clonedDependenciesCount
    ) {
        if (detail == null) {
            return null;
        }
        return new CloneTemplateResponse(
            detail.id(),
            detail.name(),
            detail.description(),
            detail.status(),
            detail.ownerId(),
            detail.ownerName(),
            detail.totalNodes(),
            detail.completedNodes(),
            detail.inProgressNodes(),
            detail.progressPercentage(),
            clonedPhasesCount,
            clonedNodesCount,
            clonedDependenciesCount,
            detail.createdAt(),
            detail.updatedAt(),
            detail.latestAiAnalysis(),
            detail.phases()
        );
    }
}
