package com.pipeline.wpe.dto.project;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateProjectRequest(
    @NotBlank(message = "Tên dự án không được để trống")
    @Size(max = 100, message = "Tên dự án không được vượt quá 100 ký tự")
    String name,

    String description,

    Long templateId,

    String visibility
) {
    public CreateProjectRequest {
        if (visibility == null || visibility.isBlank()) {
            visibility = "PRIVATE";
        }
    }

    public CreateProjectRequest(String name, String description, Long templateId) {
        this(name, description, templateId, "PRIVATE");
    }
}
