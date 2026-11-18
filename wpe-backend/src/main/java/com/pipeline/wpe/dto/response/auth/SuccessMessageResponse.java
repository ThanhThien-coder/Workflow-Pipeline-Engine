package com.pipeline.wpe.dto.response.auth;

public record SuccessMessageResponse(
    boolean success,
    String message
) {}
