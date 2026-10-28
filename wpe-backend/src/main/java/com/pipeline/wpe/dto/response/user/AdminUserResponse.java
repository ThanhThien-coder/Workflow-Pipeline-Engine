package com.pipeline.wpe.dto.response.user;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Thông tin người dùng dành cho trang Quản trị viên (đã che dữ liệu nhạy cảm)")
public record AdminUserResponse(
    @Schema(description = "ID người dùng", example = "2")
    String id,

    @Schema(description = "Họ và tên", example = "Alex Kim")
    String name,

    @Schema(description = "Email đã được che danh tính (Data Masking)", example = "al***im@pipeline.engine")
    String maskedEmail,

    @Schema(description = "Vai trò quản trị: SUPER_ADMIN, ADMIN, STANDARD_USER", example = "STANDARD_USER")
    String role,

    @Schema(description = "Số lượng workspace tham gia", example = "3")
    int workspaceCount,

    @Schema(description = "Thời điểm đăng nhập gần nhất (ISO 8601)", example = "2026-10-27T12:00:00Z")
    String lastLoginAt,

    @Schema(description = "Địa chỉ IP đã được che (Data Masking)", example = "172.16.0.***")
    String maskedIp,

    @Schema(description = "Trạng thái tài khoản: ACTIVE hoặc SUSPENDED", example = "ACTIVE")
    String status
) {}

