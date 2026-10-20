package com.pipeline.wpe.dto.event;

import java.io.Serializable;
import java.time.Instant;

/**
 * Sự kiện thông báo bất đồng bộ dùng cho chuông thông báo, gửi email hoặc đẩy WebSocket.
 */
public record NotificationEvent(
    Long recipientUserId,
    Long projectId,
    String title,
    String message,
    String type,
    String targetUrl,
    Instant createdAt
) implements Serializable {
}
