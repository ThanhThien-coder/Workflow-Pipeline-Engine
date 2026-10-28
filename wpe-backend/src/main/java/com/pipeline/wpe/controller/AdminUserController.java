package com.pipeline.wpe.controller;

import com.pipeline.wpe.dto.request.user.SuspendUserRequest;
import com.pipeline.wpe.dto.response.user.AdminUserResponse;
import com.pipeline.wpe.service.AdminUserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping({"/api/admin/users", "/api/v1/admin/users"})
@RequiredArgsConstructor
@Tag(name = "10. Admin Portal - Users", description = "Quản trị người dùng toàn hệ thống, che dữ liệu nhạy cảm, khóa/mở tài khoản")
public class AdminUserController {

    private final AdminUserService adminUserService;

    @GetMapping
    @Operation(summary = "Lấy danh sách người dùng toàn sàn", description = "Lọc người dùng theo từ khóa và trạng thái khóa; tự động che email và địa chỉ IP nhạy cảm")
    public ResponseEntity<List<AdminUserResponse>> getUsers(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String status
    ) {
        List<AdminUserResponse> users = adminUserService.getUsers(query, status);
        return ResponseEntity.ok(users);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy chi tiết người dùng", description = "Xem thông tin người dùng theo ID dành cho Quản trị viên (đã che dữ liệu nhạy cảm)")
    public ResponseEntity<AdminUserResponse> getUserById(@PathVariable("id") Long id) {
        AdminUserResponse response = adminUserService.getUserById(id);
        return ResponseEntity.ok(response);
    }

    @PostMapping({"/{id}/suspend", "/suspend"})
    @Operation(summary = "Tạm khóa tài khoản người dùng", description = "Khóa tài khoản, tăng token_version và thu hồi tức thời toàn bộ phiên đăng nhập trên mọi thiết bị")
    public ResponseEntity<AdminUserResponse> suspendUser(
            @PathVariable(value = "id", required = false) Long id,
            @Valid @RequestBody SuspendUserRequest request
    ) {
        Long targetId = id != null ? id : (request.userId() != null ? Long.parseLong(request.userId()) : null);
        if (targetId == null) {
            throw new IllegalArgumentException("ID người dùng cần khóa không được để trống.");
        }
        AdminUserResponse response = adminUserService.suspendUser(targetId, request);
        return ResponseEntity.ok(response);
    }

    @PostMapping({"/{id}/unban", "/unban"})
    @Operation(summary = "Mở khóa tài khoản người dùng", description = "Mở lại quyền truy cập hệ thống cho tài khoản đang bị khóa")
    public ResponseEntity<AdminUserResponse> unbanUser(
            @PathVariable(value = "id", required = false) Long id,
            @RequestParam(value = "userId", required = false) Long paramUserId
    ) {
        Long targetId = id != null ? id : paramUserId;
        if (targetId == null) {
            throw new IllegalArgumentException("ID người dùng cần mở khóa không được để trống.");
        }
        AdminUserResponse response = adminUserService.unbanUser(targetId);
        return ResponseEntity.ok(response);
    }
}

