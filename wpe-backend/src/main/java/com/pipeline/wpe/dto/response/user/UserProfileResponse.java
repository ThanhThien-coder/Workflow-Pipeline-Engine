package com.pipeline.wpe.dto.response.user;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;
import java.util.Map;

@Schema(description = "Thông tin hồ sơ chi tiết của người dùng")
public record UserProfileResponse(
    @Schema(description = "ID người dùng", example = "2")
    String userId,

    @Schema(description = "Họ tên hiển thị", example = "Alex Kim")
    String displayName,

    @Schema(description = "Email", example = "alex.kim@pipeline.engine")
    String email,

    @Schema(description = "Chức danh", example = "Principal Architect")
    String title,

    @Schema(description = "Tiểu sử", example = "Designing robust distributed pipelines and state machines.")
    String bio,

    @Schema(description = "Đường dẫn URL ảnh đại diện", example = "/uploads/avatars/avatar-uuid.png")
    String avatarUrl,

    @Schema(description = "Danh sách kỹ năng")
    List<String> skills,

    @Schema(description = "Các liên kết mạng xã hội / portfolio")
    ProfileLinksDto links,

    @Schema(description = "Cài đặt quyền riêng tư")
    ProfilePrivacyDto privacy,

    @Schema(description = "Danh sách các dự án tham gia")
    List<ProfileProjectDto> projects,

    @Schema(description = "Lịch sử hoạt động gần đây")
    List<ProfileActivityDto> recentActivity
) {
    public record ProfileLinksDto(
        String github,
        String linkedin,
        String website
    ) {}

    public record ProfilePrivacyDto(
        String visibility,
        boolean showEmail,
        boolean showStats
    ) {}

    public record ProfileProjectStats(
        int tasksDone,
        int tasksTotal,
        int onTimePct
    ) {}

    public record ProfileProjectDto(
        String projectId,
        String name,
        String phaseLabel,
        String role,
        String contribution,
        boolean isPublic,
        ProfileProjectStats stats
    ) {}

    public record ProfileActivityDto(
        String id,
        String text,
        String ago
    ) {}
}

