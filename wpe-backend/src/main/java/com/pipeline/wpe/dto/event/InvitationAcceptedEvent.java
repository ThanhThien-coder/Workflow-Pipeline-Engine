package com.pipeline.wpe.dto.event;

import java.io.Serializable;
import java.time.Instant;

/**
 * Sự kiện phát ra khi người dùng chấp thuận Lời mời tham gia dự án (ACCEPTED).
 * Được xử lý để thông báo cho Chủ dự án.
 */
public record InvitationAcceptedEvent(
    Long invitationId,
    Long projectId,
    String projectName,
    Long inviteeId,
    String inviteeName,
    String role,
    Instant acceptedAt
) implements Serializable {
}
