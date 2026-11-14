package com.pipeline.wpe.dto.response.activity;

import java.time.Instant;

/**
 * DTO phản hồi một dòng nhật ký hoạt động của dự án (FC5).
 * Lưu ý: Với các node/task, hệ thống chỉ phản ánh trạng thái hiện tại và lần cập nhật gần nhất
 * (DB không lưu lịch sử từng lần chuyển trạng thái).
 */
public record ProjectActivityItemResponse(
        String id,
        String type,
        String actorName,
        String message,
        String targetCode,
        Instant createdAt
) {
}
