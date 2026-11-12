package com.pipeline.wpe.dto.response.project;

import java.time.Instant;

public record ProjectMemberHistoryResponse(
        String userId,
        String username,
        String fullName,
        String role,
        Instant joinedAt,
        Instant removedAt,
        boolean active
) {
}
