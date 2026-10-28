package com.pipeline.wpe.dto.request.user;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Yêu cầu thay đổi mật khẩu")
public record ChangePasswordRequest(
    @NotBlank(message = "Mật khẩu hiện tại không được để trống")
    @Schema(description = "Mật khẩu cũ", example = "OldPassword123!")
    String currentPassword,

    @NotBlank(message = "Mật khẩu mới không được để trống")
    @Size(min = 6, message = "Mật khẩu mới phải có tối thiểu 6 ký tự")
    @Schema(description = "Mật khẩu mới", example = "NewStrongPassword2026!")
    String newPassword
) {}

