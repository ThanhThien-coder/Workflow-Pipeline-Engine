package com.pipeline.wpe.dto.project;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateProjectRequest(
    @NotBlank(message = "Tên dự án không được để trống")
    @Size(max = 100, message = "Tên dự án không được vượt quá 100 ký tự")
    String name,

    String description,

    Object templateId,

    String visibility
) {
    public CreateProjectRequest {
        if (visibility == null || visibility.isBlank()) {
            visibility = "PRIVATE";
        }
    }

    public CreateProjectRequest(String name, String description, Object templateId) {
        this(name, description, templateId, "PRIVATE");
    }

    public CreateProjectRequest(String name, String description) {
        this(name, description, null, "PRIVATE");
    }

    public Long getNumericTemplateId() {
        if (templateId == null) return null;
        if (templateId instanceof Number n) return n.longValue();
        try {
            return Long.parseLong(templateId.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public String getTemplateIdentifier() {
        return templateId != null ? templateId.toString() : null;
    }
}
