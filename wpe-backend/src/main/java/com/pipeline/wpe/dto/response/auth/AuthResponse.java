package com.pipeline.wpe.dto.response.auth;

public record AuthResponse(
    String token,
    String refreshToken,
    UserSummary user
) {
    public record UserSummary(
        String id,
        String username,
        String email,
        String name,
        String role,
        String avatarUrl
    ) {}
}
