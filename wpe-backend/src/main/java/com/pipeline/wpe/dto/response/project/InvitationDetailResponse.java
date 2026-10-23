package com.pipeline.wpe.dto.response.project;

import com.pipeline.wpe.common.enums.InvitationStatus;
import com.pipeline.wpe.common.enums.ProjectRole;

import java.time.Instant;

public record InvitationDetailResponse(
    Long id,
    Long projectId,
    String projectName,
    String projectDescription,
    String inviterName,
    ProjectRole role,
    InvitationStatus status,
    Instant expiresAt
) {
}
