package com.pipeline.wpe.dto.response.admin;

import java.util.List;

public record AdminAuditLogPageResponse(
    List<AdminAuditLogResponse> items,
    int page,
    int size,
    long totalElements
) {
}
