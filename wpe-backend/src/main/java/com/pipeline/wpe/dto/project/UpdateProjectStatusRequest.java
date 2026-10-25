package com.pipeline.wpe.dto.project;

import jakarta.validation.constraints.NotBlank;

public record UpdateProjectStatusRequest(
    @NotBlank(message = "Trạng thái không được để trống")
    String status
) {}
