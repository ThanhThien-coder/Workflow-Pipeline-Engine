package com.pipeline.wpe.dto.project;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateProjectRequest(
    @NotBlank(message = "Tên dự án không được để trống")
    @Size(max = 100, message = "Tên dự án không được vượt quá 100 ký tự")
    String name,

    @Size(max = 1000, message = "Mô tả dự án không được vượt quá 1000 ký tự")
    String description
) {
    public UpdateProjectRequest(String name) {
        this(name, null);
    }
}
