package com.pipeline.wpe.dto.response.admin;

import java.util.List;

public record OwnedProjectResponse(
    String projectId,
    String name,
    String status,
    int memberCount,
    List<OwnerCandidateResponse> candidates
) {
}
