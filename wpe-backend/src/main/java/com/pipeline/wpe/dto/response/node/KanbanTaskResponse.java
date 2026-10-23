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
    List<NodeArtifactResponse> artifacts
) {
    public KanbanTaskResponse(
        String id, String phaseId, String code, String title, String description,
        String status, String assignedUserId, String joinPolicy, String rejectReason,
        Instant dueDate, boolean isOverdue, Long version, Map<String, Object> uiMetadata
    ) {
        this(id, phaseId, code, title, description, status, assignedUserId, joinPolicy, rejectReason, dueDate, isOverdue, version, uiMetadata, List.of());
    }
}
