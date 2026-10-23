package com.pipeline.wpe.dto.response.node;

public record SubmitTaskArtifactResponse(
    KanbanTaskResponse task,
    NodeArtifactResponse artifact
) {}
