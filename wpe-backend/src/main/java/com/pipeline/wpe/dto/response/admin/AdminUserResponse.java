package com.pipeline.wpe.dto.response.admin;

import java.time.Instant;

/**
 * A6 — AdminUserDto của integration map 10.1. Email đã che ở backend ({@code a***@pipeline.engine}).
 * <ul>
 *   <li>{@code role}: {@code users.system_role} (ADMIN | USER).</li>
 *   <li>{@code status}: ACTIVE | SUSPENDED (từ {@code users.is_locked}).</li>
 *   <li>{@code lastLoginAt}, {@code maskedIp}: DB chưa lưu, luôn null.</li>
 * </ul>
 */
public record AdminUserResponse(
    String id,
    String username,
    String name,
    String maskedEmail,
    String role,
    long workspaceCount,
    Instant lastLoginAt,
    String maskedIp,
    String status
) {}
