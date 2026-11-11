package com.pipeline.wpe.dto.request.graph;

import jakarta.validation.constraints.NotNull;
import java.util.Map;

public record UpdateNodeMetadataRequest(
    @NotNull(message = "Metadata không được để trống")
    Map<String, Object> metadata
) {}
