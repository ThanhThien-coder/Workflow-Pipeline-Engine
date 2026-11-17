package com.pipeline.wpe.dto.artifact;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateArtifactRequest(
    @NotBlank(message = "Artifact name is required.")
    @Size(max = 200, message = "Artifact name can't exceed 200 characters.")
    String name,

    // C4: kiểm bằng URI (scheme http/https + có host + tối đa 500 ký tự), thay cho regex "^https?://.+" lọt link thiếu host
    @NotBlank(message = "URL is required.")
    @ValidArtifactUrl
    String url,

    // C4: chuỗi thay vì enum ArtifactType: giá trị lạ thì service đổi thành OTHER_LINK, không làm request lỗi 500
    String type,
    Long nodeId,
    Boolean isInRepository
) {}
