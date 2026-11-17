package com.pipeline.wpe.dto.request.auth;

public record ResetPasswordRequest(
    String token,
    String newPassword
) {}
