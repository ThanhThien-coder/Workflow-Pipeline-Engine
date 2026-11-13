package com.pipeline.wpe.dto.response.admin;

import java.util.Map;

public record AdminStatsResponse(
    UserStats users,
    ProjectStats projects,
    TaskStats tasks,
    TemplateStats templates,
    RoleStats roles
) {
    public record UserStats(
        int total,
        int active,
        int suspended,
        int newLast7Days
    ) {}

    public record ProjectStats(
        int total,
        Map<String, Integer> byStatus,
        int newLast7Days
    ) {}

    public record TaskStats(
        int total,
        Map<String, Integer> byStatus,
        int overdue
    ) {}

    public record TemplateStats(
        int publicCount,
        int privateCount,
        int totalClones
    ) {}

    public record RoleStats(
        Map<String, Integer> systemRoles,
        Map<String, Integer> projectRoles
    ) {}
}
