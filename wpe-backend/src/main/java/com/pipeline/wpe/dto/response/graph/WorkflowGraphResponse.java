package com.pipeline.wpe.dto.response.graph;

import java.util.List;

public record WorkflowGraphResponse(
    List<PhaseResponse> phases,
    List<List<String>> phaseEdges,
    List<GraphNodeResponse> nodes,
    List<DependencyResponse> dependencies
) {}
