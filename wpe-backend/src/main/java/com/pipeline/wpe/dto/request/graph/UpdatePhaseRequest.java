package com.pipeline.wpe.dto.request.graph;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;

public record UpdatePhaseRequest(
    @NotBlank(message = "Tên Phase không được để trống")
    String name,

    @JsonAlias({"sub", "subTitle"})
    String sub,

    @JsonAlias({"accent", "accentColor"})
    String accent,

    Long parentPhaseId,
    Integer orderIndex
) {}
