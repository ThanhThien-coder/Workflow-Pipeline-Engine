package com.pipeline.wpe.controller;

import com.pipeline.wpe.dto.request.admin.ChangeUserRoleRequest;
import com.pipeline.wpe.dto.request.admin.SuspendUserRequest;
import com.pipeline.wpe.dto.request.admin.TransferProjectOwnerRequest;
import com.pipeline.wpe.dto.response.admin.AdminAuditLogPageResponse;
import com.pipeline.wpe.dto.response.admin.AdminUserResponse;
import com.pipeline.wpe.dto.response.admin.OwnedProjectResponse;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.admin.AdminAuditService;
import com.pipeline.wpe.service.admin.AdminProjectOwnerService;
import com.pipeline.wpe.service.admin.AdminUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/v1/admin")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminController {

    private final AdminUserService adminUserService;
    private final AdminProjectOwnerService adminProjectOwnerService;
    private final AdminAuditService adminAuditService;
    private final CurrentUserProvider currentUserProvider;

    @GetMapping("/users")
    public ResponseEntity<List<AdminUserResponse>> listUsers(
        @RequestParam(name = "query", required = false) String query,
        @RequestParam(name = "status", required = false) String status
    ) {
        List<AdminUserResponse> users = adminUserService.listUsers(query, status);
        return ResponseEntity.ok(users);
    }

    @PostMapping("/users/{id}/suspend")
    public ResponseEntity<AdminUserResponse> suspendUser(
        @PathVariable("id") Long id,
        @RequestBody(required = false) SuspendUserRequest request
    ) {
        Long actorUserId = currentUserProvider.requireCurrentUserId();
        SuspendUserRequest effectiveRequest = request != null ? request : new SuspendUserRequest(null, null, null);
        AdminUserResponse response = adminUserService.suspendUser(id, effectiveRequest, actorUserId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/users/{id}/unban")
    public ResponseEntity<AdminUserResponse> unbanUser(@PathVariable("id") Long id) {
        Long actorUserId = currentUserProvider.requireCurrentUserId();
        AdminUserResponse response = adminUserService.unbanUser(id, actorUserId);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/users/{id}/role")
    public ResponseEntity<AdminUserResponse> changeUserRole(
        @PathVariable("id") Long id,
        @RequestBody ChangeUserRoleRequest request
    ) {
        Long actorUserId = currentUserProvider.requireCurrentUserId();
        String role = request != null ? request.role() : null;
        AdminUserResponse response = adminUserService.changeRole(id, role, actorUserId);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable("id") Long id) {
        Long actorUserId = currentUserProvider.requireCurrentUserId();
        adminUserService.deleteUser(id, actorUserId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/users/{id}/owned-projects")
    public ResponseEntity<List<OwnedProjectResponse>> listOwnedProjects(@PathVariable("id") Long id) {
        List<OwnedProjectResponse> responses = adminProjectOwnerService.listOwnedProjects(id);
        return ResponseEntity.ok(responses);
    }

    @PostMapping("/projects/{projectId}/transfer-owner")
    public ResponseEntity<OwnedProjectResponse> transferProjectOwner(
        @PathVariable("projectId") Long projectId,
        @RequestBody TransferProjectOwnerRequest request
    ) {
        Long actorUserId = currentUserProvider.requireCurrentUserId();
        Long newOwnerId = request != null ? request.newOwnerId() : null;
        OwnedProjectResponse response = adminProjectOwnerService.transferOwner(projectId, newOwnerId, actorUserId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/audit-logs")
    public ResponseEntity<AdminAuditLogPageResponse> searchAuditLogs(
        @RequestParam(name = "group", required = false) String group,
        @RequestParam(name = "action", required = false) String action,
        @RequestParam(name = "from", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
        @RequestParam(name = "to", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
        @RequestParam(name = "page", defaultValue = "0") int page,
        @RequestParam(name = "size", defaultValue = "50") int size
    ) {
        AdminAuditLogPageResponse response = adminAuditService.search(group, action, from, to, page, size);
        return ResponseEntity.ok(response);
    }
}
