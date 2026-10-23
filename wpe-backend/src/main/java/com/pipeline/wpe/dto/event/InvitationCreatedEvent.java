package com.pipeline.wpe.dto.event;

import java.io.Serializable;
import java.time.Instant;

/**
 * Sự kiện phát ra khi một Lời mời tham gia dự án được tạo (PENDING).
 * Được xử lý bởi RabbitMQ Worker để tạo thông báo và stream real-time qua SSE.
 */
public record InvitationCreatedEvent(
    Long invitationId,
    Long projectId,
    String projectName,
    Long inviterId,
    String inviterName,
    Long inviteeId,
    String inviteeEmail,
    String role,
    String linkUrl,
    Instant createdAt
) implements Serializable {
}
