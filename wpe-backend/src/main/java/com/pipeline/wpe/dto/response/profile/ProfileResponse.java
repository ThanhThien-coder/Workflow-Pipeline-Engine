package com.pipeline.wpe.dto.response.profile;

import java.util.List;

public record ProfileResponse(
    String userId,
    String displayName,
    String email,
    String title,
    String bio,
    String avatarUrl,
    List<String> skills,
    ProfileLinksResponse links,
    ProfilePrivacyResponse privacy,
    List<ProfileProjectResponse> projects,
    List<ProfileActivityResponse> recentActivity
) {}
