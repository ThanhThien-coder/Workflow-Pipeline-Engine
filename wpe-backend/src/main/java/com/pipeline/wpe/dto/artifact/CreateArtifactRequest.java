package com.pipeline.wpe.dto.artifact;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateArtifactRequest(
    @NotBlank(message = "Tên tài nguyên không được để trống")
    @Size(max = 200, message = "Tên tài nguyên không được vượt quá 200 ký tự")
    String name,

    // C4: kiểm bằng URI (scheme http/https + có host + tối đa 500 ký tự), thay cho regex "^https?://.+" lọt link thiếu host
    @NotBlank(message = "Đường dẫn URL không được để trống")
    @ValidArtifactUrl
    String url,

    // C4: chuỗi thay vì enum ArtifactType: giá trị lạ thì service đổi thành OTHER_LINK, không làm request lỗi 500
    String type,
    Long nodeId,
    Boolean isInRepository
) {}
