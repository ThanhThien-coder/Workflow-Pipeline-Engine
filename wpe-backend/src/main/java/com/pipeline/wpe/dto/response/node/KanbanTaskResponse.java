package com.pipeline.wpe.dto.response.node;

import java.time.Instant;
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
    Map<String, Object> uiMetadata
) {}
