package com.pipeline.wpe.dto.response.admin;

import java.time.Instant;

/**
 * A6 — WorkspaceOverviewDto của integration map 10.2.
 * <p>
 * CHỈ metadata cấp dự án (system-overview Phân hệ 5 mục 4): tên, owner, trạng thái, số thành viên,
 * số node, thời điểm cập nhật. Không có tiêu đề, mô tả hay nội dung task, không có mô tả dự án.
 * Thêm field vào record này phải xem lại nguyên tắc trên (có test khóa danh sách field).
 */
public record WorkspaceOverviewResponse(
    String id,
    String name,
    String ownerId,
    String ownerName,
    String status,
    long memberCount,
    long nodeCount,
    Instant updatedAt
) {}
