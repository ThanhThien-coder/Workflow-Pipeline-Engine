package com.pipeline.wpe.dto.request.project;

import com.pipeline.wpe.common.enums.ProjectRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateInvitationRequest(
    @NotBlank(message = "Invitee email or username is required")
    String inviteeEmailOrUsername,

    ProjectRole role
) {
    public CreateInvitationRequest {
        if (role == null) {
            role = ProjectRole.COLLABORATOR;
        }
    }

    public CreateInvitationRequest(String inviteeEmailOrUsername) {
        this(inviteeEmailOrUsername, ProjectRole.COLLABORATOR);
    }
}
