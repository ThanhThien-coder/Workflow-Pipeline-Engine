package com.pipeline.wpe.dto.request.graph;

import jakarta.validation.constraints.NotNull;

public record CreateDependencyRequest(
    @NotNull(message = "parentNodeId không được để trống")
    Long parentNodeId,

    @NotNull(message = "childNodeId không được để trống")
    Long childNodeId
) {}
