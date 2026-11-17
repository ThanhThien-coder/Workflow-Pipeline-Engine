package com.pipeline.wpe.dto.request.template;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SaveProjectAsTemplateRequest(
    @NotBlank(message = "Template name is required.")
    @Size(max = 150, message = "Template name can't exceed 150 characters.")
    String name,

    String description,

    String category
) {
    public SaveProjectAsTemplateRequest {
        if (category == null || category.isBlank()) {
            category = "General";
        }
    }
}
