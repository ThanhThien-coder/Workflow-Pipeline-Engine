package com.pipeline.wpe.dto.response.admin;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record AdminWorkspaceDetailResponse(
    String id,
    String name,
    String description,
    String status,
    Instant createdAt,
    Instant updatedAt,
    AdminWorkspaceOwnerResponse owner,
    Map<String, Integer> membersByRole,
    int pendingInvitationCount,
    int phaseCount,
    int nodeCount,
    Map<String, Integer> nodesByStatus,
    int progressPercentage,
    int overdueCount,
    boolean guestLinkActive,
    Instant guestLinkExpiresAt,
    Instant lastActivityAt,
    List<OwnerCandidateResponse> ownerCandidates
) {
}
