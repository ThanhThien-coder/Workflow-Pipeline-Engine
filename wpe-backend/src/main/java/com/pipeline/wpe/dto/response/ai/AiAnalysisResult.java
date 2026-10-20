package com.pipeline.wpe.dto.response.ai;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record AiAnalysisResult(
    @Schema(description = "Thời điểm hoàn thành phân tích chẩn đoán")
    Instant analyzedAt,

    @Schema(description = "Danh sách các điểm nghẽn nghiêm trọng (Bottlenecks)")
    List<BottleneckItem> bottlenecks,

    @Schema(description = "Các bẫy công việc tiềm ẩn (Task Traps)")
    List<TaskTrapItem> taskTraps,

    @Schema(description = "Danh sách mã các tác vụ trên đường găng CPM (Critical Path)")
    List<String> criticalPath,

    @Schema(description = "Các hành động can thiệp kỹ thuật cụ thể đề xuất bởi AI")
    List<ActionableAdviceItem> actionableAdvice,

    @Schema(description = "Các số liệu tính toán độ lệch quỹ đạo (Velocity & Drift)")
    Map<String, Object> metrics
) {
    public record BottleneckItem(
        @Schema(description = "Mã nút công việc", example = "WPE-002")
        String nodeCode,

        @Schema(description = "Tiêu đề nút", example = "Đặc tả API Swagger")
        String title,

        @Schema(description = "Lý do tắc nghẽn", example = "Thời gian IN_PROGRESS vượt 2.5 lần ước tính.")
        String reason,

        @Schema(description = "Mức độ nghiêm trọng (HIGH, MEDIUM, LOW)", example = "HIGH")
        String severity
    ) {}

    public record TaskTrapItem(
        @Schema(description = "Mã nút công việc", example = "WPE-003")
        String nodeCode,

        @Schema(description = "Tiêu đề nút", example = "Cài đặt JWT Auth")
        String title,

        @Schema(description = "Loại bẫy tác vụ", example = "OVER_SCOPED")
        String trapType,

        @Schema(description = "Gợi ý xử lý", example = "Nên chia nhỏ thành tác vụ Access Token và Refresh Token riêng biệt.")
        String suggestion
    ) {}

    public record ActionableAdviceItem(
        @Schema(description = "Phân loại hành động (SPLIT_NODE, REASSIGN, PAIR_PROGRAMMING)", example = "SPLIT_NODE")
        String action,

        @Schema(description = "Mã nút mục tiêu", example = "WPE-002")
        String targetNodeCode,

        @Schema(description = "Chỉ dẫn hành động chi tiết", example = "Tách nút thành 2 phần để giải phóng các node con downstream.")
        String instruction,

        @Schema(description = "Mức độ ưu tiên", example = "HIGH")
        String priority
    ) {}
}
