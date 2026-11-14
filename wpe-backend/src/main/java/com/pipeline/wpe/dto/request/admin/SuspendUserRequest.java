package com.pipeline.wpe.dto.request.admin;

public record SuspendUserRequest(
    String reason,
    String note
) {
}
