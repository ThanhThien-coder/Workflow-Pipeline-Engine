package com.pipeline.wpe.dto.request.template;

import jakarta.validation.constraints.NotNull;

public record SetTemplateHiddenRequest(
    @NotNull(message = "Trạng thái hidden không được để trống")
    Boolean hidden
) {}
