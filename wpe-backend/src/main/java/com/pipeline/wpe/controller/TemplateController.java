package com.pipeline.wpe.controller;

import com.pipeline.wpe.dto.project.CloneTemplateRequest;
import com.pipeline.wpe.dto.project.ProjectDetailResponse;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.TemplateCloneService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({"/api/v1/templates", "/api/templates"})
@RequiredArgsConstructor
@Tag(name = "Pipeline Templates", description = "Quản lý và nhân bản mẫu quy trình DAG")
public class TemplateController {

    private final TemplateCloneService templateCloneService;
    private final CurrentUserProvider currentUserProvider;

    @PostMapping("/{id}/clone")
    @Operation(
        summary = "Nhân bản quy trình từ Template ID",
        description = "Khởi tạo dự án mới bằng cách sao chép sâu cấu trúc giai đoạn, tác vụ và cạnh DAG từ template"
    )
    public ResponseEntity<ProjectDetailResponse> cloneTemplateById(
        @Parameter(description = "ID của mẫu quy trình hoặc dự án nguồn") @PathVariable Long id,
        @Valid @RequestBody CloneTemplateRequest req
    ) {
        Long currentUserId = currentUserProvider.requireCurrentUserId();
        // Đảm bảo templateId trùng khớp với path variable
        CloneTemplateRequest effectiveReq = (req.templateId() == null || !req.templateId().equals(id))
            ? new CloneTemplateRequest(id, req.projectName(), req.description(), req.visibility())
            : req;

        ProjectDetailResponse cloned = templateCloneService.cloneTemplate(effectiveReq, currentUserId);
        return ResponseEntity.status(HttpStatus.CREATED).body(cloned);
    }
}
