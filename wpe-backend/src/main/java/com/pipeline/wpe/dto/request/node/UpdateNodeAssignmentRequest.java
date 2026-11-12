package com.pipeline.wpe.dto.request.node;

import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public record UpdateNodeAssignmentRequest(
    Long assignedUserId,
    Instant dueDate,
    @NotNull(message = "Version is required for optimistic locking")
    Long version
) {}
