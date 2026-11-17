package com.pipeline.wpe.dto.request.profile;

public record ChangePasswordRequest(
    String currentPassword,
    String newPassword
) {}
