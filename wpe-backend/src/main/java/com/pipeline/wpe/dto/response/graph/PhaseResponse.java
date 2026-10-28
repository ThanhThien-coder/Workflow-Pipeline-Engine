package com.pipeline.wpe.dto.response.graph;

import java.util.List;

public record PhaseResponse(
    String id,
    String name,
    String sub,
    String accent,
    int orderIndex,
    List<String> parentPhaseIds,
    String status,       // TODO | LOCKED | IN_PROGRESS | COMPLETED (suy ra từ task)
    int progressPct,     // số task DONE / tổng task (%)
    int totalTasks,
    int doneTasks
) {}
