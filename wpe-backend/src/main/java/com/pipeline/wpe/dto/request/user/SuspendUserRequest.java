package com.pipeline.wpe.dto.request.user;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;

@JsonIgnoreProperties(ignoreUnknown = true)
@Schema(description = "Yêu cầu khóa tài khoản người dùng")
public record SuspendUserRequest(
    @Schema(description = "ID người dùng (nếu truyền qua body)", example = "3")
    String userId,

    @Schema(description = "Lý do khóa: TERMS_VIOLATION, SECURITY_RISK, BILLING_OVERDUE, OTHER", example = "TERMS_VIOLATION")
    String reason,

    @Schema(description = "Thời hạn khóa (ngày), null = vô thời hạn", example = "7")
    Integer durationDays,

    @Schema(description = "Ghi chú bổ sung từ quản trị viên", example = "Vi phạm chính sách bảo mật hệ thống")
    String note
) {
    public SuspendUserRequest {
        if (reason == null || reason.isBlank()) {
            reason = "TERMS_VIOLATION";
        }
    }
}

