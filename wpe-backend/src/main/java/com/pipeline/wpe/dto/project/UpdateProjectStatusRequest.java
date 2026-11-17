package com.pipeline.wpe.dto.project;

import jakarta.validation.constraints.NotBlank;

public record UpdateProjectStatusRequest(
    @NotBlank(message = "Status is required.")
    String status
) {}
