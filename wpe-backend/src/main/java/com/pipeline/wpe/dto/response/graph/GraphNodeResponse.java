package com.pipeline.wpe.dto.response.graph;

import com.pipeline.wpe.entity.NodeEntity;

import java.time.Instant;
import java.util.Map;

public record GraphNodeResponse(
    String id,
    String phaseId,
    String code,
    String title,
    String description,
    String status,
    String joinPolicy,
    String assignedUserId,
    Instant dueDate,
    Integer estimatedHours,
    Long version,
    Map<String, Object> uiMetadata,
    // T6: chủ dự án đã mở khóa sớm (null nếu chưa)
    String forceUnlockedBy,
    Instant forceUnlockedAt,
    // G21: ngày tạo task, hạn chót không được sớm hơn ngày này
    Instant createdAt,
    // TASK_51: thời điểm hoàn thành task (khi sang DONE)
    Instant completedAt,
    // TASK_68: task đã quá hạn (khớp KanbanTaskResponse.isOverdue)
    boolean isOverdue
) {
    public GraphNodeResponse(
        String id, String phaseId, String code, String title, String description, String status, String joinPolicy,
        String assignedUserId, Instant dueDate, Integer estimatedHours, Long version, Map<String, Object> uiMetadata
    ) {
        this(id, phaseId, code, title, description, status, joinPolicy, assignedUserId, dueDate, estimatedHours, version, uiMetadata, null, null, null, null, false);
    }

    public GraphNodeResponse(
        String id, String phaseId, String code, String title, String description, String status, String joinPolicy,
        String assignedUserId, Instant dueDate, Integer estimatedHours, Long version, Map<String, Object> uiMetadata,
        String forceUnlockedBy, Instant forceUnlockedAt, Instant createdAt
    ) {
        this(id, phaseId, code, title, description, status, joinPolicy, assignedUserId, dueDate, estimatedHours, version, uiMetadata, forceUnlockedBy, forceUnlockedAt, createdAt, null, false);
    }

    public static GraphNodeResponse from(NodeEntity n, Map<String, Object> uiMetadata) {
        return new GraphNodeResponse(
            String.valueOf(n.getId()),
            n.getPhaseId() != null ? String.valueOf(n.getPhaseId()) : null,
            n.getCode(),
            n.getTitle(),
            n.getDescription(),
            n.getStatus().name(),
            n.getJoinPolicy().name(),
            n.getAssignedUserId() != null ? String.valueOf(n.getAssignedUserId()) : null,
            n.getDueDate(),
            n.getEstimatedHours(),
            n.getVersion(),
            uiMetadata,
            n.getForceUnlockedBy() != null ? String.valueOf(n.getForceUnlockedBy()) : null,
            n.getForceUnlockedAt(),
            n.getCreatedAt(),
            n.getCompletedAt(),
            Boolean.TRUE.equals(n.getIsOverdue())
        );
    }
}
