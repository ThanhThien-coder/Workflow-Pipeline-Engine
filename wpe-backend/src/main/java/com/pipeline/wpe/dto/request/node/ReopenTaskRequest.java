package com.pipeline.wpe.dto.request.node;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** S04: mở lại task đã Done. Bắt buộc có lý do và version (khóa lạc quan). */
public record ReopenTaskRequest(
    @NotBlank(message = "A reason is required to reopen a task")
    String reason,

    @NotNull(message = "Version is required for optimistic locking")
    Long version
) {}
