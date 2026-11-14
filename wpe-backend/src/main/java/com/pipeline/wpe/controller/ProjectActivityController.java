package com.pipeline.wpe.controller;

import com.pipeline.wpe.dto.response.activity.ProjectActivityItemResponse;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.ProjectActivityService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@Tag(name = "Project Activity", description = "Nhật ký hoạt động của dự án được tổng hợp từ dữ liệu thực tế")
public class ProjectActivityController {

    private final ProjectActivityService projectActivityService;
    private final CurrentUserProvider currentUserProvider;

    @Operation(summary = "Lấy nhật ký hoạt động của dự án (sắp xếp mới nhất trước)")
    @GetMapping({"/api/v1/projects/{id}/activity", "/api/projects/{id}/activity"})
    public ResponseEntity<List<ProjectActivityItemResponse>> getProjectActivity(
            @PathVariable("id") Long projectId,
            @RequestParam(name = "limit", defaultValue = "50") int limit
    ) {
        Long currentUserId = currentUserProvider.requireCurrentUserId();
        List<ProjectActivityItemResponse> activities = projectActivityService.getProjectActivity(projectId, currentUserId, limit);
        return ResponseEntity.ok(activities);
    }
}
