package com.pipeline.wpe.dto.request.admin;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * A6 — Body của {@code POST /api/v1/admin/users/{id}/suspend} (integration map 10.1).
 * <p>
 * {@code durationDays}: CHƯA có cột lưu hạn khóa trong DB, nên backend chỉ ghi log giá trị này.
 * Tài khoản bị khóa cho tới khi Admin gọi unban. Muốn tự mở khóa sau N ngày cần migration + job riêng.
 */
public record SuspendUserRequest(
    @NotBlank(message = "Phải ghi lý do khóa tài khoản")
    @Size(max = 255, message = "Lý do tối đa 255 ký tự")
    String reason,

    @Positive(message = "durationDays phải lớn hơn 0")
    @Max(value = 3650, message = "durationDays tối đa 3650")
    Integer durationDays
) {}
