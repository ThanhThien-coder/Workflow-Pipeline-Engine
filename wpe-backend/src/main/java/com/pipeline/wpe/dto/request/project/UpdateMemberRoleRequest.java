package com.pipeline.wpe.dto.request.project;

import com.pipeline.wpe.common.enums.ProjectRole;
import jakarta.validation.constraints.NotNull;

public record UpdateMemberRoleRequest(
    @NotNull(message = "Member role is required.")
    ProjectRole role
) {}
