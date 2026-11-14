package com.pipeline.wpe.dto.response.admin;

import java.time.Instant;

public record AdminUserResponse(
    String id,
    String name,
    String username,
    String maskedEmail,
    String role,
    String status,
    long ownedProjectCount,
    long joinedProjectCount,
    Instant createdAt
) {
}
