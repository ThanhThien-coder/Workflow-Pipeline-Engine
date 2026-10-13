package com.pipeline.wpe.dto.request.node;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record UpdateNodeStatusRequest(
    @NotBlank(message = "Status is required")
    String status,

    String rejectReason,

    @NotNull(message = "Version is required for optimistic locking")
    Long version
) {}
