package com.pipeline.wpe.controller;

import com.pipeline.wpe.dto.request.project.UpdateMemberRoleRequest;
import com.pipeline.wpe.dto.response.project.ProjectMemberHistoryResponse;
import com.pipeline.wpe.dto.response.project.ProjectMemberResponse;
import com.pipeline.wpe.dto.response.project.RemoveMemberResponse;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.ProjectMemberService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@Tag(name = "Project Members", description = "Quản lý thành viên, vai trò và chuyển quyền sở hữu dự án")
public class ProjectMemberController {

    private final ProjectMemberService projectMemberService;
    private final CurrentUserProvider currentUserProvider;

    @Operation(summary = "Lấy danh sách thành viên của dự án")
    @GetMapping({"/api/v1/projects/{projectId}/members", "/api/projects/{projectId}/members"})
    public ResponseEntity<List<ProjectMemberResponse>> getMembers(@PathVariable Long projectId) {
        Long currentUserId = currentUserProvider.requireCurrentUserId();
        List<ProjectMemberResponse> members = projectMemberService.getMembers(projectId, currentUserId);
        return ResponseEntity.ok(members);
    }

    @Operation(summary = "Lấy lịch sử thành viên của dự án")
    @GetMapping({"/api/v1/projects/{projectId}/members/history", "/api/projects/{projectId}/members/history"})
    public ResponseEntity<List<ProjectMemberHistoryResponse>> getMemberHistory(@PathVariable Long projectId) {
        Long currentUserId = currentUserProvider.requireCurrentUserId();
        List<ProjectMemberHistoryResponse> history = projectMemberService.getMemberHistory(projectId, currentUserId);
        return ResponseEntity.ok(history);
    }

    @Operation(summary = "Cập nhật vai trò thành viên hoặc chuyển quyền sở hữu")
    @PatchMapping({"/api/v1/projects/{projectId}/members/{userId}", "/api/projects/{projectId}/members/{userId}"})
    public ResponseEntity<ProjectMemberResponse> updateMemberRole(
            @PathVariable Long projectId,
            @PathVariable Long userId,
            @Valid @RequestBody UpdateMemberRoleRequest request
    ) {
        Long currentUserId = currentUserProvider.requireCurrentUserId();
        ProjectMemberResponse response = projectMemberService.updateRole(projectId, userId, request.role(), currentUserId);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Xóa mềm thành viên khỏi dự án và gỡ phân công các task chưa hoàn thành")
    @DeleteMapping({"/api/v1/projects/{projectId}/members/{userId}", "/api/projects/{projectId}/members/{userId}"})
    public ResponseEntity<RemoveMemberResponse> removeMember(
            @PathVariable Long projectId,
            @PathVariable Long userId
    ) {
        Long currentUserId = currentUserProvider.requireCurrentUserId();
        RemoveMemberResponse response = projectMemberService.removeMember(projectId, userId, currentUserId);
        return ResponseEntity.ok(response);
    }
}
