package com.pipeline.wpe.controller;

import com.pipeline.wpe.dto.request.profile.*;
import com.pipeline.wpe.dto.response.auth.AuthResponse;
import com.pipeline.wpe.dto.response.profile.ProfilePrivacyResponse;
import com.pipeline.wpe.dto.response.profile.ProfileProjectResponse;
import com.pipeline.wpe.dto.response.profile.ProfileResponse;
import com.pipeline.wpe.dto.response.profile.PublicProfileResponse;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.profile.UserProfileService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping({"/api/v1", "/api"})
@RequiredArgsConstructor
@Tag(name = "User Profile", description = "Quản lý hồ sơ cá nhân, đổi mật khẩu, ảnh đại diện, quyền riêng tư và vô hiệu hóa / xóa tài khoản")
public class UserProfileController {

    private final UserProfileService userProfileService;
    private final CurrentUserProvider currentUserProvider;

    @GetMapping("/users/me/profile")
    @Operation(summary = "Lấy thông tin hồ sơ của người dùng hiện tại")
    public ResponseEntity<ProfileResponse> getMyProfile() {
        Long userId = currentUserProvider.requireCurrentUserId();
        return ResponseEntity.ok(userProfileService.getMyProfile(userId));
    }

    @GetMapping("/users/{id}/profile")
    @Operation(summary = "Xem hồ sơ của người dùng khác theo quyền riêng tư (404 nếu không được xem)")
    public ResponseEntity<PublicProfileResponse> getUserProfile(@PathVariable("id") Long id) {
        Long viewerId = currentUserProvider.requireCurrentUserId();
        return ResponseEntity.ok(userProfileService.getPublicProfile(viewerId, id));
    }

    @PutMapping("/users/me/profile")
    @Operation(summary = "Cập nhật thông tin hồ sơ người dùng")
    public ResponseEntity<ProfileResponse> updateProfile(@RequestBody UpdateProfileRequest request) {
        Long userId = currentUserProvider.requireCurrentUserId();
        return ResponseEntity.ok(userProfileService.updateProfile(userId, request));
    }

    @PostMapping("/users/me/password")
    @Operation(summary = "Đổi mật khẩu người dùng và cấp cặp token mới cho phiên hiện tại")
    public ResponseEntity<AuthResponse> changePassword(@RequestBody ChangePasswordRequest request) {
        Long userId = currentUserProvider.requireCurrentUserId();
        return ResponseEntity.ok(userProfileService.changePassword(userId, request));
    }

    @PostMapping(value = "/users/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Tải lên ảnh đại diện mới")
    public ResponseEntity<ProfileResponse> uploadAvatar(@RequestParam("file") MultipartFile file) {
        Long userId = currentUserProvider.requireCurrentUserId();
        return ResponseEntity.ok(userProfileService.uploadAvatar(userId, file));
    }

    @DeleteMapping("/users/me/avatar")
    @Operation(summary = "Xóa ảnh đại diện")
    public ResponseEntity<ProfileResponse> removeAvatar() {
        Long userId = currentUserProvider.requireCurrentUserId();
        return ResponseEntity.ok(userProfileService.removeAvatar(userId));
    }

    @PutMapping("/users/me/privacy")
    @Operation(summary = "Cập nhật cài đặt quyền riêng tư")
    public ResponseEntity<ProfilePrivacyResponse> updatePrivacy(@RequestBody UpdatePrivacyRequest request) {
        Long userId = currentUserProvider.requireCurrentUserId();
        return ResponseEntity.ok(userProfileService.updatePrivacy(userId, request));
    }

    @PatchMapping("/users/me/projects/{projectId}")
    @Operation(summary = "Đánh dấu dự án công khai hoặc ẩn khỏi hồ sơ cá nhân")
    public ResponseEntity<ProfileProjectResponse> setProjectPublic(
        @PathVariable Long projectId,
        @RequestBody SetProjectPublicRequest request
    ) {
        Long userId = currentUserProvider.requireCurrentUserId();
        return ResponseEntity.ok(userProfileService.setProjectPublic(userId, projectId, request.isPublic()));
    }

    @PostMapping("/users/me/deactivate")
    @Operation(summary = "Vô hiệu hóa tài khoản tạm thời")
    public ResponseEntity<Void> deactivateAccount() {
        Long userId = currentUserProvider.requireCurrentUserId();
        userProfileService.deactivateAccount(userId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/users/me")
    @Operation(summary = "Xóa vĩnh viễn (ẩn danh hóa) tài khoản người dùng")
    public ResponseEntity<Void> deleteAccount(@RequestBody DeleteAccountRequest request) {
        Long userId = currentUserProvider.requireCurrentUserId();
        userProfileService.deleteAccount(userId, request);
        return ResponseEntity.noContent().build();
    }
}
