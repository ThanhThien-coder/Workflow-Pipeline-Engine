package com.pipeline.wpe.dto.response.notification;

import com.pipeline.wpe.entity.NotificationEntity;

import java.time.Instant;

/**
 * Thông báo gửi ra ngoài (payload SSE {@code NOTIFICATION_RECEIVED}, sau này là API chuông của C3).
 * Không đưa thẳng {@link NotificationEntity} ra ngoài (GEMINI.md mục 6). {@code id} dạng chuỗi như các id khác FE nhận.
 */
public record NotificationResponse(
    String id,
    String title,
    String message,
    String linkUrl,
    Boolean isRead,
    Instant createdAt
) {

    public static NotificationResponse from(NotificationEntity entity) {
        return new NotificationResponse(
            entity.getId() != null ? String.valueOf(entity.getId()) : null,
            entity.getTitle(),
            entity.getMessage(),
            entity.getLinkUrl(),
            entity.getIsRead(),
            entity.getCreatedAt()
        );
    }
}
