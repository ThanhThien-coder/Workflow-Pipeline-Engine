package com.pipeline.wpe.dto.request.template;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.Map;

public record CreateTemplateRequest(
    @NotBlank(message = "Tên Template không được để trống")
    String name,

    String description,

    @NotBlank(message = "Danh mục Template không được để trống")
    String category,

    Boolean isSystemStandard,

    @NotNull(message = "Dữ liệu đồ thị (graphData) không được để trống")
    Map<String, Object> graphData
) {}
