package com.pipeline.wpe.dto.request.template;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.Map;

public record CreateTemplateRequest(
    @NotBlank(message = "Template name is required.")
    String name,

    String description,

    @NotBlank(message = "Template category is required.")
    String category,

    Boolean isSystemStandard,

    @NotNull(message = "Pipeline data (graphData) is required.")
    Map<String, Object> graphData
) {}
