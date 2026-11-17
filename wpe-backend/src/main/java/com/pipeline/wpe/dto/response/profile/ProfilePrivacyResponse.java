package com.pipeline.wpe.dto.response.profile;

public record ProfilePrivacyResponse(
    String visibility,
    boolean showEmail,
    boolean showStats
) {}
