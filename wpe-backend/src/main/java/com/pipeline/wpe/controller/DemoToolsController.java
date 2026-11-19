package com.pipeline.wpe.controller;

import com.pipeline.wpe.dto.request.demo.ForceStatusRequest;
import com.pipeline.wpe.dto.response.demo.CompleteAllResponse;
import com.pipeline.wpe.dto.response.demo.DemoStatusResponse;
import com.pipeline.wpe.dto.response.demo.ExpireInvitationsResponse;
import com.pipeline.wpe.dto.response.demo.OverdueScanResponse;
import com.pipeline.wpe.dto.response.graph.GraphNodeResponse;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.demo.DemoToolsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/demo")
@RequiredArgsConstructor
@Tag(name = "Demo tools", description = "Công cụ demo để test đồ án. Mặc định tắt (app.demo-tools.enabled=false)")
public class DemoToolsController {

    private final DemoToolsService demoToolsService;
    private final CurrentUserProvider currentUserProvider;

    @Operation(summary = "Công cụ demo đang bật hay tắt (mọi người đã đăng nhập đều gọi được)")
    @GetMapping("/status")
    public ResponseEntity<DemoStatusResponse> status() {
        currentUserProvider.requireCurrentUserId();
        return ResponseEntity.ok(new DemoStatusResponse(demoToolsService.isEnabled()));
    }

    @Operation(summary = "Demo: đặt hạn chót về quá khứ và quét quá hạn ngay")
    @PostMapping("/projects/{projectId}/nodes/{nodeId}/make-overdue")
    public ResponseEntity<GraphNodeResponse> makeOverdue(@PathVariable Long projectId, @PathVariable Long nodeId) {
        return ResponseEntity.ok(demoToolsService.makeOverdue(projectId, nodeId, currentUserProvider.requireCurrentUserId()));
    }

    @Operation(summary = "Demo: chạy quét quá hạn ngay")
    @PostMapping("/projects/{projectId}/overdue-scan")
    public ResponseEntity<OverdueScanResponse> overdueScan(@PathVariable Long projectId) {
        return ResponseEntity.ok(demoToolsService.overdueScan(projectId, currentUserProvider.requireCurrentUserId()));
    }

    @Operation(summary = "Demo: ép trạng thái task, bỏ qua máy trạng thái")
    @PostMapping("/projects/{projectId}/nodes/{nodeId}/force-status")
    public ResponseEntity<GraphNodeResponse> forceStatus(
        @PathVariable Long projectId, @PathVariable Long nodeId, @Valid @RequestBody ForceStatusRequest request
    ) {
        return ResponseEntity.ok(demoToolsService.forceStatus(
            projectId, nodeId, request.status(), currentUserProvider.requireCurrentUserId()));
    }

    @Operation(summary = "Demo: hoàn thành mọi task của phase theo thứ tự phụ thuộc")
    @PostMapping("/projects/{projectId}/phases/{phaseId}/complete-all")
    public ResponseEntity<CompleteAllResponse> completeAll(@PathVariable Long projectId, @PathVariable Long phaseId) {
        return ResponseEntity.ok(demoToolsService.completePhase(projectId, phaseId, currentUserProvider.requireCurrentUserId()));
    }

    @Operation(summary = "Demo: xóa thời gian chờ AI của dự án")
    @PostMapping("/projects/{projectId}/ai-cooldown/reset")
    public ResponseEntity<Void> resetAiCooldown(@PathVariable Long projectId) {
        demoToolsService.resetAiCooldown(projectId, currentUserProvider.requireCurrentUserId());
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Demo: cho link khách đang hoạt động hết hạn ngay")
    @PostMapping("/projects/{projectId}/guest-link/expire")
    public ResponseEntity<Void> expireGuestLink(@PathVariable Long projectId) {
        demoToolsService.expireGuestLink(projectId, currentUserProvider.requireCurrentUserId());
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Demo: cho lời mời đang chờ hết hạn ngay")
    @PostMapping("/projects/{projectId}/invitations/expire")
    public ResponseEntity<ExpireInvitationsResponse> expireInvitations(@PathVariable Long projectId) {
        return ResponseEntity.ok(demoToolsService.expireInvitations(projectId, currentUserProvider.requireCurrentUserId()));
    }

    @Operation(summary = "Demo: gửi thông báo thử cho chính mình")
    @PostMapping("/projects/{projectId}/notifications/test")
    public ResponseEntity<Void> testNotification(@PathVariable Long projectId) {
        demoToolsService.sendTestNotification(projectId, currentUserProvider.requireCurrentUserId());
        return ResponseEntity.noContent().build();
    }
}
