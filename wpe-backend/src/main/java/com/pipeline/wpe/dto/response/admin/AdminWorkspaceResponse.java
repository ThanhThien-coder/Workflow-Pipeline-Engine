package com.pipeline.wpe.dto.response.admin;

import java.time.Instant;

public record AdminWorkspaceResponse(
    String id,
    String name,
    String ownerId,
    String ownerName,
    String ownerMaskedEmail,
    String status,
    int memberCount,
    int phaseCount,
    int nodeCount,
    int doneNodeCount,
    int progressPercentage,
    Instant createdAt,
    Instant updatedAt
) {
}
