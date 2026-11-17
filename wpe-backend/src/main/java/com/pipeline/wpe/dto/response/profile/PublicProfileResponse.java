package com.pipeline.wpe.dto.response.profile;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Hồ sơ người dùng khác nhìn thấy. {@code email} và {@code stats} là null khi chủ hồ sơ không cho hiện
 * (trừ khi người xem là chính chủ).
 */
public record PublicProfileResponse(
    String userId,
    String displayName,
    String title,
    String bio,
    String avatarUrl,
    List<String> skills,
    ProfileLinksResponse links,
    String email,
    ProfileProjectResponse.Stats stats,
    List<ProfileProjectResponse> projects,
    @JsonProperty("isSelf")
    boolean isSelf
) {}
