package com.pipeline.wpe.dto.response.profile;

import java.util.List;

/**
 * Khớp kiểu ProfileDto của FE (FE/types/profile.types.ts).
 * privacy, projects, recentActivity chưa có trong DB/SSOT: trả giá trị mặc định (xem ProfileService).
 */
public record ProfileResponse(
    String userId,
    String displayName,
    String email,
    String title,
    String bio,
    String avatarUrl,
    List<String> skills,
    Links links,
    Privacy privacy,
    List<Object> projects,
    List<Object> recentActivity
) {
    public record Links(String github, String linkedin, String website) {}

    public record Privacy(String visibility, boolean showEmail, boolean showStats) {}
}
