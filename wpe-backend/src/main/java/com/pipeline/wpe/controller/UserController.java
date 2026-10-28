package com.pipeline.wpe.controller;

import com.pipeline.wpe.common.util.SecurityUtils;
import com.pipeline.wpe.dto.request.user.ChangePasswordRequest;
import com.pipeline.wpe.dto.request.user.UpdateProfileRequest;
import com.pipeline.wpe.dto.response.user.UserProfileResponse;
import com.pipeline.wpe.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping({"/api/users/me", "/api/v1/users/me"})
@RequiredArgsConstructor
@Tag(name = "02. User Profile", description = "Quản lý thông tin hồ sơ và bảo mật tài khoản cá nhân")
public class UserController {

    private final UserService userService;

    @GetMapping({"", "/profile"})
    @Operation(summary = "Lấy hồ sơ cá nhân", description = "Truy vấn thông tin chi tiết của người dùng đang đăng nhập (hoặc theo Header X-User-Id)")
    public ResponseEntity<UserProfileResponse> getMyProfile() {
        Long userId = SecurityUtils.getCurrentUserId();
        UserProfileResponse response = userService.getMyProfile(userId);
        return ResponseEntity.ok(response);
    }

    @PutMapping({"", "/profile"})
    @Operation(summary = "Cập nhật hồ sơ cá nhân", description = "Cập nhật họ tên, tiểu sử, chức danh, danh sách kỹ năng và liên kết bên ngoài")
    public ResponseEntity<UserProfileResponse> updateProfile(@Valid @RequestBody UpdateProfileRequest request) {
        Long userId = SecurityUtils.getCurrentUserId();
        UserProfileResponse response = userService.updateProfile(userId, request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/password")
    @Operation(summary = "Đổi mật khẩu tài khoản", description = "Đổi mật khẩu mới và tự động hủy bỏ phiên đăng nhập trên các thiết bị khác bằng cách tăng token_version")
    public ResponseEntity<Map<String, Object>> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        Long userId = SecurityUtils.getCurrentUserId();
        userService.changePassword(userId, request);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Mật khẩu đã được cập nhật thành công."
        ));
    }

    @PostMapping(value = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Tải lên ảnh đại diện cá nhân", description = "Upload file ảnh định dạng PNG/JPG/WebP, tối đa 2MB và cập nhật URL vào hồ sơ")
    public ResponseEntity<UserProfileResponse> uploadAvatar(@RequestParam("file") MultipartFile file) {
        Long userId = SecurityUtils.getCurrentUserId();
        UserProfileResponse response = userService.uploadAvatar(userId, file);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/avatar")
    @Operation(summary = "Xóa ảnh đại diện cá nhân", description = "Xóa avatar hiện tại, giao diện sẽ trở về hiển thị chữ cái viết tắt")
    public ResponseEntity<UserProfileResponse> removeAvatar() {
        Long userId = SecurityUtils.getCurrentUserId();
        UserProfileResponse response = userService.removeAvatar(userId);
        return ResponseEntity.ok(response);
    }
}

