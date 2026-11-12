package com.pipeline.wpe.dto.request.project;

import com.pipeline.wpe.common.enums.ProjectRole;
import jakarta.validation.constraints.NotNull;

public record UpdateMemberRoleRequest(
    @NotNull(message = "Vai trò thành viên không được để trống")
    ProjectRole role
) {}
