package com.pipeline.wpe.dto.project;

import com.pipeline.wpe.entity.WorkPhaseEntity;

public record WorkPhaseSummaryResponse(
    Long id,
    String name,
    String subTitle,
    String accentColor,
    Integer orderIndex,
    int nodeCount
) {
    public static WorkPhaseSummaryResponse fromEntity(WorkPhaseEntity entity, int nodeCount) {
        if (entity == null) {
            return null;
        }
        return new WorkPhaseSummaryResponse(
            entity.getId(),
            entity.getName(),
            entity.getSubTitle(),
            entity.getAccentColor(),
            entity.getOrderIndex(),
            nodeCount
        );
    }
}
