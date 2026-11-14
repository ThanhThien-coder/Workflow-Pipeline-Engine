package com.pipeline.wpe.dto.request.graph;

import com.pipeline.wpe.common.enums.JoinPolicy;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

/**
 * Sửa thông tin node (PUT /nodes/{id}). Không có trường status: trạng thái chỉ đổi qua State Machine.
 * Trường tùy chọn không gửi (null) thì giữ nguyên giá trị cũ.
 * Muốn bỏ người phụ trách / hạn chót thì gửi clearAssignee / clearDueDate = true (null không có nghĩa là xóa).
 */
public record UpdateNodeRequest(
    @NotBlank(message = "Tiêu đề công việc không được để trống")
    String title,
    String description,
    Long phaseId,
    JoinPolicy joinPolicy,
    Long assignedUserId,
    Instant dueDate,
    Integer estimatedHours,

    // Bắt buộc: version client đang giữ. Khác version trên máy chủ thì trả 409.
    @NotNull(message = "Thiếu version của công việc")
    Long version,

    Boolean clearAssignee,
    Boolean clearDueDate
) {
    public UpdateNodeRequest(String title, String description, Long phaseId, JoinPolicy joinPolicy,
                             Long assignedUserId, Instant dueDate, Integer estimatedHours, Long version) {
        this(title, description, phaseId, joinPolicy, assignedUserId, dueDate, estimatedHours, version, null, null);
    }

    public boolean shouldClearAssignee() {
        return Boolean.TRUE.equals(clearAssignee);
    }

    public boolean shouldClearDueDate() {
        return Boolean.TRUE.equals(clearDueDate);
    }
}
