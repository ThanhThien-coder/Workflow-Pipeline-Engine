package com.pipeline.wpe.dto.request.profile;

import com.fasterxml.jackson.annotation.JsonProperty;

public record SetProjectPublicRequest(
    @JsonProperty("isPublic")
    Boolean isPublic
) {}
