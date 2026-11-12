package com.pipeline.wpe.dto.response.project;

import java.time.Instant;

public record ProjectMemberResponse(
    String userId,
    String username,
    String fullName,
    String email,
    String role,
    Instant joinedAt,
    int activeNodeCount,
    String initials,
    String avatarUrl
) {}
