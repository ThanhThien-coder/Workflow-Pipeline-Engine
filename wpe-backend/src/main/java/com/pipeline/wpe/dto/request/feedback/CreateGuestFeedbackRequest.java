package com.pipeline.wpe.dto.request.feedback;

import com.pipeline.wpe.common.enums.ReviewerRole;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateGuestFeedbackRequest(
    @Schema(description = "Họ tên người đánh giá", example = "TS. Nguyen Van A")
    @NotBlank(message = "Reviewer name is required.")
    @Size(max = 100, message = "Reviewer name can be at most 100 characters.")
    String reviewerName,

    @Schema(description = "Vai trò người đánh giá (TEACHER hoặc GUEST)", example = "TEACHER")
    @NotNull(message = "Reviewer role is required.")
    ReviewerRole reviewerRole,

    @Schema(description = "Nội dung nhận xét/góp ý 1 chiều", example = "Cần bổ sung thêm sơ đồ Sequence Diagram cho module JWT Rotation.")
    @NotBlank(message = "Feedback is required.")
    String content,

    @Schema(description = "ID nút công việc được tham chiếu (tùy chọn)", example = "2")
    Long nodeId
) {}

