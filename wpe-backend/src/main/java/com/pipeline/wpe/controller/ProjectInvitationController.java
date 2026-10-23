package com.pipeline.wpe.controller;

import com.pipeline.wpe.dto.request.project.CreateInvitationRequest;
import com.pipeline.wpe.dto.response.project.InvitationDetailResponse;
import com.pipeline.wpe.dto.response.project.InvitationResponse;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.ProjectInvitationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@Tag(name = "Project Invitations", description = "Quản lý vòng đời lời mời tham gia dự án (Asynchronous Invitation Lifecycle)")
public class ProjectInvitationController {

    private final ProjectInvitationService projectInvitationService;
    private final CurrentUserProvider currentUserProvider;

    @Operation(summary = "Tạo lời mời tham gia dự án mới (Chủ dự án gửi)")
    @PostMapping("/api/v1/projects/{projectId}/invitations")
    public ResponseEntity<InvitationResponse> createInvitation(
            @PathVariable Long projectId,
            @Valid @RequestBody CreateInvitationRequest request
    ) {
        Long currentUserId = currentUserProvider.requireCurrentUserId();
        InvitationResponse response = projectInvitationService.createInvitation(projectId, currentUserId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @Operation(summary = "Lấy danh sách lời mời đang chờ phản hồi của dự án")
    @GetMapping("/api/v1/projects/{projectId}/invitations")
    public ResponseEntity<List<InvitationResponse>> getPendingInvitations(
            @PathVariable Long projectId
    ) {
        Long currentUserId = currentUserProvider.requireCurrentUserId();
        List<InvitationResponse> responses = projectInvitationService.getProjectPendingInvitations(projectId, currentUserId);
        return ResponseEntity.ok(responses);
    }

    @Operation(summary = "Chủ dự án thu hồi lời mời")
    @DeleteMapping("/api/v1/projects/{projectId}/invitations/{invitationId}")
    public ResponseEntity<Void> revokeInvitation(
            @PathVariable Long projectId,
            @PathVariable Long invitationId
    ) {
        Long currentUserId = currentUserProvider.requireCurrentUserId();
        projectInvitationService.revokeInvitation(projectId, invitationId, currentUserId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Lấy chi tiết lời mời cho Popup Modal xác nhận")
    @GetMapping("/api/v1/invitations/{id}")
    public ResponseEntity<InvitationDetailResponse> getInvitationDetail(
            @PathVariable Long id
    ) {
        Long currentUserId = currentUserProvider.requireCurrentUserId();
        InvitationDetailResponse response = projectInvitationService.getInvitationDetail(id, currentUserId);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Người được mời bấm Chấp nhận gia nhập dự án")
    @PostMapping("/api/v1/invitations/{id}/accept")
    public ResponseEntity<Map<String, Object>> acceptInvitation(
            @PathVariable Long id
    ) {
        Long currentUserId = currentUserProvider.requireCurrentUserId();
        projectInvitationService.acceptInvitation(id, currentUserId);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Bạn đã gia nhập dự án thành công.",
                "invitationId", id
        ));
    }

    @Operation(summary = "Người được mời bấm Từ chối lời mời")
    @PostMapping("/api/v1/invitations/{id}/reject")
    public ResponseEntity<Map<String, Object>> rejectInvitation(
            @PathVariable Long id
    ) {
        Long currentUserId = currentUserProvider.requireCurrentUserId();
        projectInvitationService.rejectInvitation(id, currentUserId);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Đã từ chối lời mời tham gia dự án.",
                "invitationId", id
        ));
    }
}
