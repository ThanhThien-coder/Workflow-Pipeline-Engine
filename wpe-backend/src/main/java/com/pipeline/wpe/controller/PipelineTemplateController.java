package com.pipeline.wpe.controller;

import com.pipeline.wpe.dto.request.template.CreateTemplateRequest;
import com.pipeline.wpe.dto.request.template.SaveProjectAsTemplateRequest;
import com.pipeline.wpe.dto.request.template.ValidateTemplateGraphRequest;
import com.pipeline.wpe.dto.response.template.DagValidationResponse;
import com.pipeline.wpe.dto.response.template.TemplateDetailResponse;
import com.pipeline.wpe.dto.response.template.TemplateSummaryResponse;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.PipelineTemplateService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping({"/api/v1", "/api"})
@RequiredArgsConstructor
@Tag(name = "10.3 Template Studio", description = "Quản trị Quy trình Mẫu Hệ thống và Thẩm định Đồ thị Kahn 2 tầng (Dev B)")
public class PipelineTemplateController {

    private final PipelineTemplateService templateService;
    private final CurrentUserProvider currentUserProvider;

    @GetMapping("/templates")
    @Operation(
        summary = "10.3.1 Lấy danh mục quy trình mẫu",
        description = "Trả về danh sách tóm tắt các template quy trình chuẩn hệ thống hoặc do cộng đồng đóng góp. Hỗ trợ lọc theo category, search và isSystemStandard."
    )
    public ResponseEntity<List<TemplateSummaryResponse>> getTemplates(
        @Parameter(description = "Lọc theo danh mục: Software Engineering, Marketing, DevOps & Infra, General, All")
        @RequestParam(required = false) String category,
        @Parameter(description = "Tìm kiếm theo tên hoặc mô tả")
        @RequestParam(required = false) String search,
        @Parameter(description = "Lọc mẫu chuẩn hệ thống")
        @RequestParam(required = false) Boolean isSystemStandard,
        @RequestParam(required = false) Long currentUserId
    ) {
        Long callerId = (currentUserId != null) ? currentUserId : currentUserProvider.getCurrentUserId().orElse(null);
        List<TemplateSummaryResponse> list = templateService.getTemplates(category, search, isSystemStandard, callerId);
        return ResponseEntity.ok(list);
    }

    @GetMapping("/templates/{id}")
    @Operation(
        summary = "10.3.2 Lấy chi tiết Template",
        description = "Trả về thông tin chi tiết của Template bao gồm toàn bộ cấu trúc đồ thị JSONB 2 tầng (graphData)."
    )
    public ResponseEntity<TemplateDetailResponse> getTemplateById(
        @PathVariable String id,
        @RequestParam(required = false) Long currentUserId
    ) {
        Long callerId = (currentUserId != null) ? currentUserId : currentUserProvider.getCurrentUserId().orElse(null);
        TemplateDetailResponse response = templateService.getTemplateByIdOrSlug(id, callerId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/templates")
    @Operation(
        summary = "10.3.3 Tạo mới Template (Admin)",
        description = "Quản trị viên tạo mẫu quy trình mới. Hệ thống tự động chạy thuật toán Kahn 2 tầng thẩm định cấu trúc graphData không có chu trình trước khi lưu."
    )
    public ResponseEntity<TemplateDetailResponse> createTemplate(
        @Valid @RequestBody CreateTemplateRequest request,
        @RequestParam(required = false) Long currentUserId
    ) {
        Long callerId = (currentUserId != null) ? currentUserId : currentUserProvider.requireCurrentUserId();
        TemplateDetailResponse response = templateService.createTemplate(request, callerId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/templates/{id}")
    @Operation(
        summary = "10.3.3 Cập nhật Template (Admin)",
        description = "Cập nhật thông tin và cấu trúc đồ thị mẫu. Thẩm định Kahn trước khi ghi đè."
    )
    public ResponseEntity<TemplateDetailResponse> updateTemplate(
        @PathVariable String id,
        @Valid @RequestBody CreateTemplateRequest request,
        @RequestParam(required = false) Long currentUserId
    ) {
        Long callerId = (currentUserId != null) ? currentUserId : currentUserProvider.requireCurrentUserId();
        TemplateDetailResponse response = templateService.updateTemplateBySlugOrId(id, request, callerId);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/templates/{id}")
    @Operation(
        summary = "10.3.3 Xóa Template (Admin)",
        description = "Xóa vĩnh viễn template mẫu khỏi Catalog."
    )
    public ResponseEntity<Void> deleteTemplate(
        @PathVariable String id,
        @RequestParam(required = false) Long currentUserId
    ) {
        Long callerId = (currentUserId != null) ? currentUserId : currentUserProvider.requireCurrentUserId();
        templateService.deleteTemplateBySlugOrId(id, callerId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/projects/{id}/save-as-template")
    @Operation(
        summary = "Lưu dự án thành template riêng",
        description = "Chủ dự án lưu cấu trúc đồ thị hiện tại thành template cá nhân (PRIVATE)."
    )
    public ResponseEntity<TemplateDetailResponse> saveProjectAsTemplate(
        @PathVariable Long id,
        @Valid @RequestBody SaveProjectAsTemplateRequest request
    ) {
        Long callerId = currentUserProvider.requireCurrentUserId();
        TemplateDetailResponse response = templateService.saveProjectAsTemplate(id, request, callerId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/templates/validate")
    @Operation(
        summary = "10.3.4 Thẩm định đồ thị mẫu bằng thuật toán Kahn (Dry Run)",
        description = "Kiểm tra cấu trúc graphData 2 tầng (Macro Phase DAG & Micro Node DAG) có tồn tại chu trình lặp hay không trước khi bấm lưu."
    )
    public ResponseEntity<DagValidationResponse> validateGraph(
        @Valid @RequestBody ValidateTemplateGraphRequest request
    ) {
        DagValidationResponse response = templateService.validateGraph(request.graphData());
        return ResponseEntity.ok(response);
    }
}
