package com.pipeline.wpe.dto.response.guest;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;

public record GuestOverviewResponse(
    @Schema(description = "Tên dự án", example = "Core Banking Pipeline")
    String projectName,

    @Schema(description = "Giai đoạn hiện tại", example = "Phase 2: Core Development")
    String phaseLabel,

    @Schema(description = "Thời gian cập nhật mới nhất")
    Instant lastUpdated,

    @Schema(description = "Tổng số nút công việc", example = "15")
    int totalNodes,

    @Schema(description = "Số nút trên đường găng (Critical Path)", example = "4")
    int criticalNodes,

    @Schema(description = "Số nút đã hoàn thành (DONE)", example = "6")
    int completedNodes,

    @Schema(description = "Tỷ lệ hoàn thành phần trăm", example = "40.0")
    double completionPct,

    @Schema(description = "Số tác vụ quá hạn", example = "1")
    int overdueCount,

    @Schema(description = "Số tác vụ đang bị khóa hoặc tắc nghẽn", example = "3")
    int blockingCount,

    @Schema(description = "Tổng số tác vụ", example = "15")
    int totalTasks,

    @Schema(description = "Biểu đồ vận tốc thực hiện")
    List<GuestVelocityPointDto> velocity,

    @Schema(description = "Phân bổ số lượng theo trạng thái tác vụ")
    List<GuestStatusSliceDto> statusBreakdown,

    @Schema(description = "Hoạt động gần đây của dự án")
    List<GuestActivityDto> recentActivity,

    @Schema(description = "Kho tài nguyên và minh chứng công khai cho khách xem")
    List<GuestArtifactDto> publicArtifacts
) {
    public record GuestVelocityPointDto(
        String day,
        int value
    ) {}

    public record GuestStatusSliceDto(
        String key,
        String label,
        int count
    ) {}

    public record GuestActivityDto(
        String id,
        String initials,
        String actor,
        String text,
        String ago
    ) {}

    public record GuestArtifactDto(
        Long id,
        String name,
        String type,
        String url
    ) {}
}

