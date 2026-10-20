package com.pipeline.wpe.dto.event;

import java.io.Serializable;
import java.time.Instant;

/**
 * Sự kiện phát ra khi một tác vụ được Chủ dự án duyệt sang trạng thái DONE.
 * Consumer sẽ nhận sự kiện này để kích hoạt Kahn DAG Engine tự động mở khóa các node con kế tiếp (AND/OR join).
 */
public record TaskCompletedEvent(
    Long taskId,
    Long projectId,
    String taskCode,
    Long completedByUserId,
    Instant completedAt
) implements Serializable {
}
