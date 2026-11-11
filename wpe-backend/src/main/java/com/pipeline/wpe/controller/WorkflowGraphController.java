package com.pipeline.wpe.controller;

import com.pipeline.wpe.dto.request.graph.*;
import com.pipeline.wpe.dto.response.graph.*;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.WorkflowGraphService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({"/api/v1", "/api"})
@RequiredArgsConstructor
@Tag(name = "04. DAG Canvas & Workflow Graph", description = "Quản lý Đồ thị 2 tầng, Phân kỳ Macro, Nút công việc và Thuật toán Kahn (Dev B)")
public class WorkflowGraphController {

    private final WorkflowGraphService workflowGraphService;
    private final CurrentUserProvider currentUserProvider;

    @GetMapping("/projects/{id}/graph")
    @Operation(
        summary = "4.1 Lấy toàn bộ đồ thị 2 tầng của dự án",
        description = "Trả về Macro Phases, Phase Edges, Nodes (thuộc phase và standalone) và các cạnh phụ thuộc Dependencies."
    )
    public ResponseEntity<WorkflowGraphResponse> getGraph(
        @PathVariable Long id,
        @Parameter(description = "ID người gọi (Tùy chọn khi test, mặc định đọc từ Security Context hoặc debug)")
        @RequestParam(required = false) Long currentUserId
    ) {
        Long callerId = (currentUserId != null) ? currentUserId : currentUserProvider.getCurrentUserId().orElse(2L);
        WorkflowGraphResponse response = workflowGraphService.getGraph(id, callerId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/projects/{id}/phases")
    @Operation(
        summary = "4.2 Tạo mới Macro Phase",
        description = "Chủ dự án tạo mới một phân kỳ lớn, thiết lập màu sắc, tên, tiêu đề phụ và phase cha (nếu có)."
    )
    public ResponseEntity<PhaseResponse> createPhase(
        @PathVariable Long id,
        @Valid @RequestBody CreatePhaseRequest request,
        @RequestParam(required = false) Long currentUserId
    ) {
        Long callerId = (currentUserId != null) ? currentUserId : currentUserProvider.getCurrentUserId().orElse(2L);
        PhaseResponse response = workflowGraphService.createPhase(id, request, callerId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/projects/{id}/phases/{phaseId}")
    @Operation(
        summary = "4.2 Cập nhật Macro Phase",
        description = "Chủ dự án cập nhật thông tin tên, tiêu đề phụ, màu sắc và thứ tự hiển thị orderIndex."
    )
    public ResponseEntity<PhaseResponse> updatePhase(
        @PathVariable Long id,
        @PathVariable Long phaseId,
        @Valid @RequestBody UpdatePhaseRequest request,
        @RequestParam(required = false) Long currentUserId
    ) {
        Long callerId = (currentUserId != null) ? currentUserId : currentUserProvider.getCurrentUserId().orElse(2L);
        PhaseResponse response = workflowGraphService.updatePhase(id, phaseId, request, callerId);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/projects/{id}/phases/{phaseId}")
    @Operation(
        summary = "4.2 Xóa Macro Phase",
        description = "Xóa Phase an toàn: tự động chuyển các nút con sang trạng thái standalone để không mất việc của thành viên."
    )
    public ResponseEntity<Void> deletePhase(
        @PathVariable Long id,
        @PathVariable Long phaseId,
        @RequestParam(required = false) Long currentUserId
    ) {
        Long callerId = (currentUserId != null) ? currentUserId : currentUserProvider.getCurrentUserId().orElse(2L);
        workflowGraphService.deletePhase(id, phaseId, callerId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/projects/{id}/phases/connect")
    @Operation(
        summary = "4.2 Nối quan hệ phụ thuộc giữa 2 Phase",
        description = "Chủ dự án thiết lập quan hệ tiền đề: sourcePhaseId -> targetPhaseId."
    )
    public ResponseEntity<Void> connectPhases(
        @PathVariable Long id,
        @RequestParam Long sourcePhaseId,
        @RequestParam Long targetPhaseId,
        @RequestParam(required = false) Long currentUserId
    ) {
        Long callerId = (currentUserId != null) ? currentUserId : currentUserProvider.getCurrentUserId().orElse(2L);
        workflowGraphService.connectPhases(id, sourcePhaseId, targetPhaseId, callerId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/projects/{id}/phases/disconnect")
    @Operation(
        summary = "4.2 Gỡ quan hệ phụ thuộc giữa 2 Phase",
        description = "Chủ dự án gỡ bỏ quan hệ tiền đề giữa sourcePhaseId và targetPhaseId."
    )
    public ResponseEntity<Void> disconnectPhases(
        @PathVariable Long id,
        @RequestParam Long sourcePhaseId,
        @RequestParam Long targetPhaseId,
        @RequestParam(required = false) Long currentUserId
    ) {
        Long callerId = (currentUserId != null) ? currentUserId : currentUserProvider.getCurrentUserId().orElse(2L);
        workflowGraphService.disconnectPhases(id, sourcePhaseId, targetPhaseId, callerId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/projects/{id}/nodes")
    @Operation(
        summary = "4.3 Tạo Node công việc mới",
        description = "Thành viên/Owner tạo nút công việc mới. Nếu thiếu mã code, hệ thống tự động sinh mã WPE-xxx. Khởi tạo trạng thái TODO (nếu standalone) hoặc LOCKED (nếu trong phase)."
    )
    public ResponseEntity<GraphNodeResponse> createNode(
        @PathVariable Long id,
        @Valid @RequestBody CreateNodeRequest request,
        @RequestParam(required = false) Long currentUserId
    ) {
        Long callerId = (currentUserId != null) ? currentUserId : currentUserProvider.getCurrentUserId().orElse(2L);
        GraphNodeResponse response = workflowGraphService.createNode(id, request, callerId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/projects/{id}/dependencies")
    @Operation(
        summary = "4.3 Nối cạnh phụ thuộc giữa 2 Node",
        description = "Thiết lập quan hệ parentNodeId -> childNodeId. Tự động kiểm tra chống tự nối và chống chu trình 2 chiều tức thì."
    )
    public ResponseEntity<DependencyResponse> createDependency(
        @PathVariable Long id,
        @Valid @RequestBody CreateDependencyRequest request,
        @RequestParam(required = false) Long currentUserId
    ) {
        Long callerId = (currentUserId != null) ? currentUserId : currentUserProvider.getCurrentUserId().orElse(2L);
        DependencyResponse response = workflowGraphService.createDependency(id, request, callerId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @DeleteMapping("/projects/{id}/dependencies")
    @Operation(
        summary = "4.3 Gỡ cạnh phụ thuộc giữa 2 Node",
        description = "Gỡ bỏ dây nối phụ thuộc giữa parentNodeId và childNodeId."
    )
    public ResponseEntity<Void> deleteDependency(
        @PathVariable Long id,
        @RequestParam Long parentNodeId,
        @RequestParam Long childNodeId,
        @RequestParam(required = false) Long currentUserId
    ) {
        Long callerId = (currentUserId != null) ? currentUserId : currentUserProvider.getCurrentUserId().orElse(2L);
        workflowGraphService.deleteDependency(id, parentNodeId, childNodeId, callerId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping({"/nodes/{id}/metadata", "/projects/{projectId}/nodes/{id}/metadata"})
    @Operation(
        summary = "4.4 Cập nhật tọa độ kéo thả Canvas vào JSONB ui_metadata",
        description = "Lưu vị trí {position: {x, y}, width, height, color} khi người dùng kéo thả thẻ Node trên giao diện."
    )
    public ResponseEntity<GraphNodeResponse> updateNodeMetadata(
        @PathVariable Long id,
        @PathVariable(required = false) Long projectId,
        @Valid @RequestBody UpdateNodeMetadataRequest request,
        @RequestParam(required = false) Long currentUserId
    ) {
        Long callerId = (currentUserId != null) ? currentUserId : currentUserProvider.getCurrentUserId().orElse(2L);
        GraphNodeResponse response = workflowGraphService.updateNodeMetadata(id, request, callerId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/projects/{id}/publish")
    @Operation(
        summary = "4.5 Kích hoạt dự án từ DRAFT sang ACTIVE (Chạy thuật toán Kahn)",
        description = "Chủ dự án bấm xuất bản quy trình. Backend chạy thuật toán Kahn O(V+E): nếu phát hiện chu trình trả về HTTP 422 CYCLE_DETECTED, nếu hợp lệ chuyển trạng thái ACTIVE và tự động mở khóa các Node gốc từ LOCKED sang TODO."
    )
    public ResponseEntity<PublishPipelineResponse> publishPipeline(
        @PathVariable Long id,
        @RequestParam(required = false) Long currentUserId
    ) {
        Long callerId = (currentUserId != null) ? currentUserId : currentUserProvider.getCurrentUserId().orElse(2L);
        PublishPipelineResponse response = workflowGraphService.publishPipeline(id, callerId);
        return ResponseEntity.ok(response);
    }
}
