package com.pipeline.wpe.dto.response.project;

import com.pipeline.wpe.common.enums.InvitationStatus;
import com.pipeline.wpe.common.enums.ProjectRole;

import java.time.Instant;

public record InvitationResponse(
    Long id,
    Long projectId,
    String projectName,
    Long inviterId,
    String inviterName,
    Long inviteeId,
    String inviteeEmail,
    ProjectRole role,
    InvitationStatus status,
    Instant createdAt,
    Instant expiresAt,
    Long version
) {
}
