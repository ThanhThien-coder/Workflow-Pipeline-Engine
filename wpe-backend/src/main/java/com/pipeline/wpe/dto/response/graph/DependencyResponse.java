package com.pipeline.wpe.dto.response.graph;

public record DependencyResponse(
    String parentNodeId,
    String childNodeId
) {}
