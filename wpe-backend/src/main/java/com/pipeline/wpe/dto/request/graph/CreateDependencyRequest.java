package com.pipeline.wpe.dto.request.graph;

import jakarta.validation.constraints.NotNull;

public record CreateDependencyRequest(
    @NotNull(message = "parentNodeId is required.")
    Long parentNodeId,

    @NotNull(message = "childNodeId is required.")
    Long childNodeId
) {}
