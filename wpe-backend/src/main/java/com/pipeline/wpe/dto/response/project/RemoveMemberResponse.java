package com.pipeline.wpe.dto.response.project;

public record RemoveMemberResponse(
    Long userId,
    int unassignedTaskCount
) {}
