package com.pipeline.wpe.dto.event;

import java.io.Serializable;
import java.time.Instant;

/**
 * Sự kiện yêu cầu chẩn đoán AI chạy nền qua hàng đợi wpe.ai.diagnostics.queue.
 * CHƯA DÙNG: chẩn đoán AI hiện chạy đồng bộ qua HTTP (HttpAiServiceClient). Giữ lại cho hướng chạy AI nền sau này.
 */
public record AiDiagnosticRequestedEvent(
    Long projectId,
    Long failedTaskId,
    String failureReason,
    Long requestedByUserId,
    Instant requestedAt
) implements Serializable {
}
