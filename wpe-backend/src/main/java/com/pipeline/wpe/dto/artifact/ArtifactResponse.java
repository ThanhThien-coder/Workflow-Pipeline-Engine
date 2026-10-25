package com.pipeline.wpe.dto.artifact;

import com.pipeline.wpe.common.enums.ArtifactType;
import com.pipeline.wpe.entity.ArtifactEntity;

import java.time.Instant;

public record ArtifactResponse(
    Long id,
    Long projectId,
    Long nodeId,
    Long uploadedBy,
    String name,
    ArtifactType type,
    String url,
    Boolean isInRepository,
    Boolean isPublicForGuest,
    Instant createdAt
) {
    public static ArtifactResponse from(ArtifactEntity entity) {
        if (entity == null) return null;
        return new ArtifactResponse(
            entity.getId(),
            entity.getProjectId(),
            entity.getNodeId(),
            entity.getUploadedBy(),
            entity.getName(),
            entity.getType(),
            entity.getUrl(),
            entity.getIsInRepository(),
            entity.getIsPublicForGuest(),
            entity.getCreatedAt()
        );
    }
}
