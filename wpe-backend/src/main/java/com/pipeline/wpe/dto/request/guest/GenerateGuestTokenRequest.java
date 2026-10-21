package com.pipeline.wpe.dto.request.guest;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record GenerateGuestTokenRequest(
    @Schema(description = "Số ngày có hiệu lực của token chia sẻ (mặc định 30 ngày)", example = "30")
    @Min(value = 1, message = "Số ngày hiệu lực tối thiểu là 1 ngày")
    @Max(value = 365, message = "Số ngày hiệu lực tối đa là 365 ngày")
    Integer expiryDays
) {
    public int getResolvedExpiryDays() {
        return (expiryDays != null && expiryDays > 0) ? expiryDays : 30;
    }
}

