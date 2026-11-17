package com.pipeline.wpe.dto.response.profile;

import java.time.Instant;

public record ProfileActivityResponse(
    String id,
    String text,
    Instant occurredAt
) {}
