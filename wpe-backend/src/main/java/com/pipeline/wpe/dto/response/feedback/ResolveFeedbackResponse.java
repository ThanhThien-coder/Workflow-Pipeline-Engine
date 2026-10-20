package com.pipeline.wpe.dto.response.feedback;

import com.pipeline.wpe.common.enums.FeedbackStatus;
import io.swagger.v3.oas.annotations.media.Schema;

public record ResolveFeedbackResponse(
    @Schema(description = "Thao tác thành công", example = "true")
    boolean success,

    @Schema(description = "ID bản ghi góp ý vừa giải quyết", example = "1")
    Long feedbackId,

    @Schema(description = "Trạng thái mới", example = "RESOLVED")
    FeedbackStatus status
) {}
