package com.pipeline.wpe.dto.request.profile;

import java.util.List;

public record UpdateProfileRequest(
    String displayName,
    String email,
    String title,
    String bio,
    List<String> skills,
    ProfileLinksRequest links
) {}
