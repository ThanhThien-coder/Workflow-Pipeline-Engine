package com.pipeline.wpe.controller;

import com.pipeline.wpe.dto.project.CreateProjectRequest;
import com.pipeline.wpe.dto.project.ProjectDetailResponse;
import com.pipeline.wpe.dto.project.ProjectSummaryResponse;
import com.pipeline.wpe.dto.project.UpdateProjectStatusRequest;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.ProjectService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import com.pipeline.wpe.dto.project.CloneTemplateRequest;
import com.pipeline.wpe.service.TemplateCloneService;

@RestController
@RequestMapping({"/api/v1/projects", "/api/projects"})
@RequiredArgsConstructor
@Tag(name = "Project Management", description = "Quản trị không gian làm việc và dự án quy trình DAG")
public class ProjectController {

    private final ProjectService projectService;
    private final TemplateCloneService templateCloneService;
    private final CurrentUserProvider currentUserProvider;

    @GetMapping
    @Operation(
        summary = "Lấy danh sách dự án của tôi",
        description = "Truy vấn toàn bộ dự án người dùng sở hữu (OWNER) hoặc tham gia làm thành viên (COLLABORATOR, VIEWER)"
    )
    public ResponseEntity<List<ProjectSummaryResponse>> getMyProjects() {
        Long currentUserId = currentUserProvider.requireCurrentUserId();
        List<ProjectSummaryResponse> projects = projectService.getMyProjects(currentUserId);
        return ResponseEntity.ok(projects);
    }

    @GetMapping("/{id}")
    @Operation(
        summary = "Xem chi tiết dự án",
        description = "Truy vấn chi tiết dự án, bao gồm cấu trúc các Phases, tiến độ tổng thể và phân tích AI"
    )
    public ResponseEntity<ProjectDetailResponse> getProjectDetail(
        @Parameter(description = "ID của dự án") @PathVariable Long id
    ) {
        Long currentUserId = currentUserProvider.requireCurrentUserId();
        ProjectDetailResponse detail = projectService.getProjectDetail(id, currentUserId);
        return ResponseEntity.ok(detail);
    }

    @PostMapping
    @Operation(
        summary = "Khởi tạo dự án mới",
        description = "Khởi tạo dự án mới và tự động thiết lập quyền OWNER cho người tạo trong bảng project_member"
    )
    public ResponseEntity<ProjectDetailResponse> createProject(
        @Valid @RequestBody CreateProjectRequest req
    ) {
        Long currentUserId = currentUserProvider.requireCurrentUserId();
        ProjectDetailResponse created = projectService.createProject(req, currentUserId);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PatchMapping("/{id}/status")
    @Operation(
        summary = "Cập nhật trạng thái dự án",
        description = "Chỉ chủ dự án (OWNER) hoặc quản trị viên hệ thống (ADMIN) mới có quyền cập nhật trạng thái dự án"
    )
    public ResponseEntity<ProjectSummaryResponse> updateProjectStatus(
        @Parameter(description = "ID của dự án") @PathVariable Long id,
        @Valid @RequestBody UpdateProjectStatusRequest req
    ) {
        Long currentUserId = currentUserProvider.requireCurrentUserId();
        ProjectSummaryResponse updated = projectService.updateProjectStatus(id, req, currentUserId);
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/clone-template")
    @Operation(
        summary = "Nhân bản dự án từ mẫu quy trình (Clone Template DAG)",
        description = "Sao chép sâu toàn bộ giai đoạn (phases), tác vụ (nodes), và cạnh phụ thuộc DAG từ mẫu quy trình"
    )
    public ResponseEntity<ProjectDetailResponse> cloneTemplate(
        @Valid @RequestBody CloneTemplateRequest req
    ) {
        Long currentUserId = currentUserProvider.requireCurrentUserId();
        ProjectDetailResponse cloned = templateCloneService.cloneTemplate(req, currentUserId);
        return ResponseEntity.status(HttpStatus.CREATED).body(cloned);
    }
}
