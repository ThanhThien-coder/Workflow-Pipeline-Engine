package com.pipeline.wpe.controller;

import com.pipeline.wpe.dto.request.admin.SuspendUserRequest;
import com.pipeline.wpe.dto.response.admin.AdminUserResponse;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.admin.AdminUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminController {

    private final AdminUserService adminUserService;
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
}
