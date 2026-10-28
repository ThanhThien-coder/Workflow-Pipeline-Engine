package com.pipeline.wpe.dto.response.graph;

import java.time.Instant;
import java.util.Map;

public record GraphNodeResponse(
    String id,
    String phaseId,
    String code,
    String title,
    String description,
    String status,
    String joinPolicy,
    String assignedUserId,
    Instant dueDate,
    Integer estimatedHours,
    Long version,
    Map<String, Object> uiMetadata
) {}
