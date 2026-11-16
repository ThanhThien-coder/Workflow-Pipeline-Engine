package com.pipeline.wpe.dto.response.node;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record KanbanTaskResponse(
    String id,
    String phaseId,
    String code,
    String title,
    String description,
    String status,
    String assignedUserId,
    String joinPolicy,
    String rejectReason,
    Instant dueDate,
    boolean isOverdue,
    Long version,
    Map<String, Object> uiMetadata,
    List<NodeArtifactResponse> artifacts,
    // T6: chủ dự án đã mở khóa sớm (null nếu chưa)
    String forceUnlockedBy,
    Instant forceUnlockedAt,
    // G21: ngày tạo task, hạn chót không được sớm hơn ngày này
    Instant createdAt
) {
    public KanbanTaskResponse(
        String id, String phaseId, String code, String title, String description,
        String status, String assignedUserId, String joinPolicy, String rejectReason,
        Instant dueDate, boolean isOverdue, Long version, Map<String, Object> uiMetadata,
        List<NodeArtifactResponse> artifacts, String forceUnlockedBy, Instant forceUnlockedAt
    ) {
        this(id, phaseId, code, title, description, status, assignedUserId, joinPolicy, rejectReason, dueDate, isOverdue, version, uiMetadata, artifacts, forceUnlockedBy, forceUnlockedAt, null);
    }

    public KanbanTaskResponse(
        String id, String phaseId, String code, String title, String description,
        String status, String assignedUserId, String joinPolicy, String rejectReason,
        Instant dueDate, boolean isOverdue, Long version, Map<String, Object> uiMetadata,
        List<NodeArtifactResponse> artifacts
    ) {
        this(id, phaseId, code, title, description, status, assignedUserId, joinPolicy, rejectReason, dueDate, isOverdue, version, uiMetadata, artifacts, null, null);
    }

    public KanbanTaskResponse(
        String id, String phaseId, String code, String title, String description,
        String status, String assignedUserId, String joinPolicy, String rejectReason,
        Instant dueDate, boolean isOverdue, Long version, Map<String, Object> uiMetadata
    ) {
        this(id, phaseId, code, title, description, status, assignedUserId, joinPolicy, rejectReason, dueDate, isOverdue, version, uiMetadata, List.of());
    }

    /** Bản sao kèm danh sách artifact của task. */
    public KanbanTaskResponse withArtifacts(List<NodeArtifactResponse> list) {
        return new KanbanTaskResponse(id, phaseId, code, title, description, status, assignedUserId, joinPolicy, rejectReason,
            dueDate, isOverdue, version, uiMetadata, list, forceUnlockedBy, forceUnlockedAt, createdAt);
    }
}
