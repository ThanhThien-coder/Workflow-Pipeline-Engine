package com.pipeline.wpe.dto.request.demo;

import com.pipeline.wpe.common.enums.NodeStatus;
import jakarta.validation.constraints.NotNull;

/** Cong cu demo: ep trang thai task, bo qua may trang thai. */
public record ForceStatusRequest(
    @NotNull(message = "Status is required.")
    NodeStatus status
) {}
