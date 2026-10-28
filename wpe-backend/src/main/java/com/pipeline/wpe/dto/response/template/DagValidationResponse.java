package com.pipeline.wpe.dto.response.template;

import java.util.List;

public record DagValidationResponse(
    boolean valid,
    int visitedCount,
    int totalCount,
    List<DagViolationItem> violations
) {
    public record DagViolationItem(
        String scope,
        String phaseId,
        List<String> nodeIds
    ) {}
}
