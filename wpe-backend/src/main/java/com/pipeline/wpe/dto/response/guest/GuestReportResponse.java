package com.pipeline.wpe.dto.response.guest;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.pipeline.wpe.dto.response.graph.DependencyResponse;
import com.pipeline.wpe.dto.response.graph.PhaseResponse;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;

@Schema(description = "Dữ liệu thô đầy đủ phục vụ trang báo cáo khách")
public record GuestReportResponse(
    @Schema(description = "Thời điểm hiện tại trên máy chủ")
    Instant serverNow,

    @Schema(description = "Thông tin tóm tắt dự án và hạn liên kết khách")
    GuestProjectDto project,

    @Schema(description = "Đồ thị phase và task")
    GuestGraphDto graph,

    @Schema(description = "Danh sách thành viên và người từng phụ trách task")
    List<GuestMemberDto> members,

    @Schema(description = "Danh sách artifact công khai có URL http/https")
    List<GuestArtifactDto> artifacts,

    @Schema(description = "Số lượng góp ý của khách")
    GuestFeedbackDto feedback
) {
    @Schema(description = "Thông tin dự án cho khách")
    public record GuestProjectDto(
        String name,
        String description,
        String status,
        Instant createdAt,
        Instant linkExpiresAt
    ) {}

    @Schema(description = "Đồ thị phase và task cho khách")
    public record GuestGraphDto(
        List<PhaseResponse> phases,
        List<List<String>> phaseEdges,
        List<GuestNodeDto> nodes,
        List<DependencyResponse> dependencies
    ) {}

    @Schema(description = "Thông tin task gọn cho khách")
    public record GuestNodeDto(
        String id,
        String phaseId,
        String code,
        String title,
        String description,
        String status,
        String joinPolicy,
        String assignedUserId,
        Instant dueDate,
        Integer estimatedHours,
        Instant createdAt,
        Instant completedAt,
        Instant startedAt,
        Instant reopenedAt,
        @JsonProperty("isOverdue") boolean isOverdue
    ) {}

    @Schema(description = "Thành viên hiển thị trên trang khách")
    public record GuestMemberDto(
        String id,
        String name,
        String role
    ) {}

    @Schema(description = "Artifact công khai cho khách")
    public record GuestArtifactDto(
        String id,
        String name,
        String type,
        String url,
        String nodeId,
        Instant createdAt
    ) {}

    @Schema(description = "Thống kê góp ý của khách")
    public record GuestFeedbackDto(
        long total,
        long resolved
    ) {}
}
