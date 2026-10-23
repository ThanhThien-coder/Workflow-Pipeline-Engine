package com.pipeline.wpe.dto.request.node;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record SubmitTaskArtifactRequest(
    String taskId,
    String type,
    String url,
    String note,
    String title,
    ArtifactPayload artifact,
    Long version
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ArtifactPayload(
        String title,
        String name,
        String type,
        String url,
        String note,
        Boolean isPublicForGuest
    ) {}
}
