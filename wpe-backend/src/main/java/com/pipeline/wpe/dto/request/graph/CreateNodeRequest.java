package com.pipeline.wpe.dto.request.graph;

import com.pipeline.wpe.common.enums.JoinPolicy;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;
import java.util.Map;

public record CreateNodeRequest(
    Long phaseId,
    String code,
    @NotBlank(message = "Tiêu đề công việc không được để trống")
    String title,
    String description,
    JoinPolicy joinPolicy,
    Long assignedUserId,
    Instant dueDate,
    Integer estimatedHours,
    Map<String, Object> uiMetadata
) {}
