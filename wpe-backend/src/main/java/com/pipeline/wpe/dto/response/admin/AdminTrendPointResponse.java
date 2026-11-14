package com.pipeline.wpe.dto.response.admin;

public record AdminTrendPointResponse(
    String date,
    int newUsers,
    int newProjects,
    int tasksDone
) {
}
