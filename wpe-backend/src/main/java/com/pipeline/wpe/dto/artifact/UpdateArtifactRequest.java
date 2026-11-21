package com.pipeline.wpe.dto.artifact;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Sửa tên và link của artifact. Loại (type) không gửi lên: backend nhận lại theo link mới. */
public record UpdateArtifactRequest(
    @NotBlank(message = "Artifact name is required.")
    @Size(max = 200, message = "Artifact name can't exceed 200 characters.")
    String name,

    @NotBlank(message = "URL is required.")
    @ValidArtifactUrl
    String url
) {}
