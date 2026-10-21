package com.pipeline.wpe.dto.response.feedback;

import com.pipeline.wpe.common.enums.FeedbackStatus;
import com.pipeline.wpe.common.enums.ReviewerRole;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

public record GuestFeedbackResponse(
    @Schema(description = "ID bản ghi góp ý", example = "1")
    Long id,

    @Schema(description = "ID dự án", example = "1")
    Long projectId,

    @Schema(description = "ID nút công việc tham chiếu (nếu có)", example = "2")
    Long nodeId,

    @Schema(description = "Họ tên người đánh giá", example = "TS. Nguyen Van A")
    String reviewerName,

    @Schema(description = "Vai trò người đánh giá", example = "TEACHER")
    ReviewerRole reviewerRole,

    @Schema(description = "Nội dung nhận xét", example = "Cần bổ sung thêm sơ đồ Sequence Diagram...")
    String content,

    @Schema(description = "Trạng thái góp ý (OPEN / RESOLVED)", example = "OPEN")
    FeedbackStatus status,

    @Schema(description = "Thời gian gửi")
    Instant createdAt
) {}

