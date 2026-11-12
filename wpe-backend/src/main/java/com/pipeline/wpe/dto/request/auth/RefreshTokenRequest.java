package com.pipeline.wpe.dto.request.auth;

/**
 * Body cho POST /auth/refresh và POST /auth/logout.
 * Không đặt @NotBlank: thiếu token thì service trả 401 INVALID_REFRESH_TOKEN (refresh)
 * hoặc bỏ qua (logout), thay vì 400.
 */
public record RefreshTokenRequest(
    String refreshToken
) {}
