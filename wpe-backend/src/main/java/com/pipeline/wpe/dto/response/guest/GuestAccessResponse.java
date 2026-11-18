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
    Instant expiresAt,

    @Schema(description = "Trạng thái chi tiết: NONE (chưa tạo), ACTIVE, EXPIRED (hết hạn), REVOKED (đã thu hồi)", example = "ACTIVE")
    Status status
) {
    public enum Status { NONE, ACTIVE, EXPIRED, REVOKED }

    /** Giữ constructor 4 tham số cũ: suy status từ enabled. */
    public GuestAccessResponse(boolean enabled, String token, String shareUrl, Instant expiresAt) {
        this(enabled, token, shareUrl, expiresAt, enabled ? Status.ACTIVE : Status.NONE);
    }

    /** Chưa từng tạo link (hoặc không có gì để thu hồi). */
    public static GuestAccessResponse disabled() {
        return new GuestAccessResponse(false, null, null, null, Status.NONE);
    }

    public static GuestAccessResponse revoked() {
        return new GuestAccessResponse(false, null, null, null, Status.REVOKED);
    }

    /** Link chưa thu hồi nhưng đã hết hạn: không lộ token/shareUrl. */
    public static GuestAccessResponse expired(Instant expiresAt) {
        return new GuestAccessResponse(false, null, null, expiresAt, Status.EXPIRED);
    }
}
