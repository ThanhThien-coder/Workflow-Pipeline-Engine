package com.pipeline.wpe.dto.request.graph;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;

import java.util.Map;

public record CreatePhaseRequest(
    @NotBlank(message = "Tên Phase không được để trống")
    String name,

    @JsonAlias({"sub", "subTitle"})
    String sub,

    @JsonAlias({"accent", "accentColor"})
    String accent,

    Long parentPhaseId,
    Integer orderIndex,

    // Tùy chọn. Vị trí thẻ Phase trên canvas: { "x": 280, "y": 140, "w": 250, "h": 220 }
    Map<String, Object> uiMetadata
) {}
