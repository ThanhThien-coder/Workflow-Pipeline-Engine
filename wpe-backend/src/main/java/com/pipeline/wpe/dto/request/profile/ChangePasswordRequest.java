package com.pipeline.wpe.dto.request.profile;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Body của POST /api/v1/users/me/password. Mật khẩu mới dưới 8 ký tự -> 400 VALIDATION_FAILED. */
public record ChangePasswordRequest(
    @NotBlank(message = "Current password is required")
    String currentPassword,

    @NotBlank(message = "New password is required")
    @Size(min = 8, max = 100, message = "New password must be between 8 and 100 characters")
    String newPassword
) {}
