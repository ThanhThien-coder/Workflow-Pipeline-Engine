package com.pipeline.wpe.dto.response.guest;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

public record GuestAccessResponse(
    @Schema(description = "Trạng thái kích hoạt của liên kết khách", example = "true")
    boolean enabled,

    @Schema(description = "Token 64 ký tự bảo mật", example = "a1b2c3d4e5f6...")
    String token,

    @Schema(description = "Đường dẫn chia sẻ công khai cho khách", example = "http://localhost:5173/guest/a1b2c3d4...")
    String shareUrl,

    @Schema(description = "Thời điểm hết hạn của liên kết")
    Instant expiresAt
) {
    public static GuestAccessResponse disabled() {
        return new GuestAccessResponse(false, null, null, null);
    }
}
