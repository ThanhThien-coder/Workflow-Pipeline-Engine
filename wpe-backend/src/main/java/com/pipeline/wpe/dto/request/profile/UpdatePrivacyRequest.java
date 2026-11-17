package com.pipeline.wpe.dto.request.profile;

public record UpdatePrivacyRequest(
    String visibility,
    Boolean showEmail,
    Boolean showStats
) {}
