package com.pipeline.wpe.dto.request.template;

import jakarta.validation.constraints.NotNull;

public record SetTemplateHiddenRequest(
    @NotNull(message = "The hidden flag is required.")
    Boolean hidden
) {}
