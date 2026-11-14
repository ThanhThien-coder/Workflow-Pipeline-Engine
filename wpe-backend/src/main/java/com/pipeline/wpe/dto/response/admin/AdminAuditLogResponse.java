package com.pipeline.wpe.dto.response.admin;

import java.time.Instant;

public record AdminAuditLogResponse(
    String id,
    Instant createdAt,
    String actorUsername,
    String action,
    String targetType,
    String targetId,
    String detail,
    String maskedIp
) {
}
