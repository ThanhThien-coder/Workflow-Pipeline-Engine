package com.pipeline.wpe.dto.project;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateProjectRequest(
    @NotBlank(message = "Project name is required.")
    @Size(max = 100, message = "Project name can't exceed 100 characters.")
    String name,

    @Size(max = 1000, message = "Project description can't exceed 1,000 characters.")
    String description
) {
    public UpdateProjectRequest(String name) {
        this(name, null);
    }
}
