package com.pipeline.wpe.dto.response.node;

import java.time.Instant;

public record NodeArtifactResponse(
    String id,
    String type,
    String url,
    String note,
    String label,
    Instant uploadedAt
) {}
