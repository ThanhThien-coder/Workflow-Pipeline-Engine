package com.pipeline.wpe.dto.response.template;

import java.time.Instant;

public record TemplateSummaryResponse(
    String id,
    String name,
    String description,
    String category,
    boolean isSystemStandard,
    int phaseCount,
    int nodeCount,
    int cloneCount,
    String createdBy,
    Instant createdAt,
    Instant updatedAt
) {}
