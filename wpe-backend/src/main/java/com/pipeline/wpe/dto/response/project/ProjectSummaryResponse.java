package com.pipeline.wpe.dto.response.project;

import java.time.Instant;

public record ProjectSummaryResponse(
    String id,
    String name,
    String desc,
    String role,
    String status,
    int nodeCount,
    int activeNodes,
    int doneNodes,
    Instant updatedAt
) {}
