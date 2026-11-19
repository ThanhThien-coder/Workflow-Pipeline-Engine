package com.pipeline.wpe.dto.response.guest;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

/** Tóm tắt AI cho khách, dựng từ kết quả phân tích đã lưu (không gọi AI mới). */
public record GuestAiSummaryResponse(
    @Schema(description = "Tóm tắt 1-2 câu về tình trạng dự án")
    String content,

    @Schema(description = "Điểm nổi bật / hành động đề xuất (từ actionableAdvice)")
    List<String> highlights,

    @Schema(description = "Rủi ro (mã task + lý do, không có tên người)")
    List<String> risks,

    @Schema(description = "Thời điểm AI phân tích (ISO-8601), null nếu bản lưu không có")
    String generatedAt
) {}
