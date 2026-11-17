package com.pipeline.wpe.dto.response.profile;

import com.fasterxml.jackson.annotation.JsonProperty;

public record ProfileProjectResponse(
    String projectId,
    String name,
    String phaseLabel,
    String role,
    String contribution,
    @JsonProperty("isPublic")
    boolean isPublic,
    Stats stats
) {
    public record Stats(
        int tasksDone,
        int tasksTotal,
        int onTimePct
    ) {}
}
