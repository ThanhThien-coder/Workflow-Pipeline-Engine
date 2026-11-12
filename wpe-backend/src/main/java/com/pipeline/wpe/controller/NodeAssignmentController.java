package com.pipeline.wpe.controller;

import com.pipeline.wpe.dto.request.node.UpdateNodeAssignmentRequest;
import com.pipeline.wpe.dto.response.graph.GraphNodeResponse;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.NodeAssignmentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@Tag(name = "Node Assignment", description = "Đổi người phụ trách hoặc hạn chót của công việc")
public class NodeAssignmentController {

    private final NodeAssignmentService nodeAssignmentService;
    private final CurrentUserProvider currentUserProvider;

    @Operation(summary = "Đổi người phụ trách hoặc hạn chót của công việc")
    @PatchMapping({"/api/v1/nodes/{id}/assignment", "/api/nodes/{id}/assignment"})
    public ResponseEntity<GraphNodeResponse> updateAssignment(
            @PathVariable Long id,
            @Valid @RequestBody UpdateNodeAssignmentRequest request
    ) {
        Long currentUserId = currentUserProvider.requireCurrentUserId();
        GraphNodeResponse response = nodeAssignmentService.updateAssignment(id, request, currentUserId);
        return ResponseEntity.ok(response);
    }
}
