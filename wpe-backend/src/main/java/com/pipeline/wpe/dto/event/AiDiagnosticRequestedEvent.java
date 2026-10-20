package com.pipeline.wpe.dto.event;

import java.io.Serializable;
import java.time.Instant;

/**
 * Sự kiện yêu cầu phân tích sự cố bằng AI (Google Gemini API) trong hàng đợi ngầm.
 */
public record AiDiagnosticRequestedEvent(
    Long projectId,
    Long failedTaskId,
    String failureReason,
    Long requestedByUserId,
    Instant requestedAt
) implements Serializable {
}
