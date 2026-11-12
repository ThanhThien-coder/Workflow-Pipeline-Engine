package com.pipeline.wpe.dto.request.template;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SaveProjectAsTemplateRequest(
    @NotBlank(message = "Tên Template không được để trống")
    @Size(max = 150, message = "Tên Template không được vượt quá 150 ký tự")
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
