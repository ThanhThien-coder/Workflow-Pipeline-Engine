package com.pipeline.wpe.dto.response.graph;

import java.time.Instant;

public record PublishPipelineResponse(
    boolean success,
    String status,
    Instant publishedAt,
    int unlockedTaskCount
) {}
