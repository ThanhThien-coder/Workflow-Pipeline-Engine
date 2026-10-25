package com.pipeline.wpe.dto.artifact;

import com.pipeline.wpe.common.enums.ArtifactType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateArtifactRequest(
    @NotBlank(message = "Tên tài nguyên không được để trống")
    @Size(max = 200, message = "Tên tài nguyên không được vượt quá 200 ký tự")
    String name,

    @NotBlank(message = "Đường dẫn URL không được để trống")
    @Size(max = 500, message = "Đường dẫn URL không được vượt quá 500 ký tự")
    @Pattern(regexp = "^https?://.+", message = "Đường dẫn URL phải có định dạng hợp lệ (bắt đầu bằng http:// hoặc https://)")
    String url,

    ArtifactType type,
    Long nodeId,
    Boolean isInRepository
) {}
