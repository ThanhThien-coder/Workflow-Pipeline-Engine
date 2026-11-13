package com.pipeline.wpe.controller;

import com.pipeline.wpe.dto.request.profile.ChangePasswordRequest;
import com.pipeline.wpe.dto.request.profile.UpdateProfileRequest;
import com.pipeline.wpe.dto.response.profile.PasswordChangedResponse;
import com.pipeline.wpe.dto.response.profile.ProfileResponse;
import com.pipeline.wpe.exception.ErrorResponse;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.profile.ProfileBadRequestException;
import com.pipeline.wpe.service.profile.ProfileService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping({"/api/v1/users/me", "/api/users/me"})
@RequiredArgsConstructor
@Tag(name = "User Profile", description = "Hồ sơ cá nhân, đổi mật khẩu, ảnh đại diện (Cụm 2)")
public class UserProfileController {

    private final ProfileService profileService;
    private final CurrentUserProvider currentUserProvider;

    @GetMapping("/profile")
    @Operation(summary = "Lấy hồ sơ của tôi")
    public ResponseEntity<ProfileResponse> getProfile() {
        return ResponseEntity.ok(profileService.getMyProfile(currentUserProvider.requireCurrentUserId()));
    }

    @PutMapping("/profile")
    @Operation(summary = "Cập nhật hồ sơ", description = "409 EMAIL_TAKEN khi email đã có người dùng.")
    public ResponseEntity<ProfileResponse> updateProfile(@Valid @RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(profileService.updateProfile(currentUserProvider.requireCurrentUserId(), request));
    }

    @PostMapping("/password")
    @Operation(summary = "Đổi mật khẩu",
        description = "Thu hồi mọi phiên: token_version + 1, mọi refresh token revoked. 400 WRONG_PASSWORD / VALIDATION_FAILED.")
    public ResponseEntity<PasswordChangedResponse> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        profileService.changePassword(currentUserProvider.requireCurrentUserId(), request);
        return ResponseEntity.ok(new PasswordChangedResponse(true, "Password updated successfully"));
    }

    @PostMapping(value = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Đổi ảnh đại diện",
        description = "multipart, field 'file'. PNG/JPEG/WebP (kiểm magic bytes), tối đa 2MB. 400 UNSUPPORTED_MEDIA / FILE_TOO_LARGE.")
    public ResponseEntity<ProfileResponse> uploadAvatar(@RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(profileService.uploadAvatar(currentUserProvider.requireCurrentUserId(), file));
    }

    @DeleteMapping("/avatar")
    @Operation(summary = "Xóa ảnh đại diện")
    public ResponseEntity<ProfileResponse> removeAvatar() {
        return ResponseEntity.ok(profileService.removeAvatar(currentUserProvider.requireCurrentUserId()));
    }

    // ─────────────── Lỗi riêng của hồ sơ (không sửa GlobalExceptionHandler dùng chung) ───────────────

    /** 400 WRONG_PASSWORD / UNSUPPORTED_MEDIA / FILE_TOO_LARGE, cùng dạng ErrorResponse với các lỗi khác. */
    @ExceptionHandler(ProfileBadRequestException.class)
    public ResponseEntity<ErrorResponse> handleProfileBadRequest(ProfileBadRequestException ex, HttpServletRequest request) {
        return badRequest(ex.getErrorCode(), ex.getMessage(), request);
    }

    /**
     * File vượt spring.servlet.multipart.max-file-size (2MB). Nhờ resolve-lazily: true, lỗi này được ném khi
     * Spring đọc tham số 'file' cho handler của controller này, nên handler cục bộ bắt được.
     */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> handleMaxUploadSize(MaxUploadSizeExceededException ex, HttpServletRequest request) {
        ProfileBadRequestException tooLarge = ProfileBadRequestException.fileTooLarge();
        return badRequest(tooLarge.getErrorCode(), tooLarge.getMessage(), request);
    }

    private static ResponseEntity<ErrorResponse> badRequest(String code, String message, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(ErrorResponse.of(HttpStatus.BAD_REQUEST.value(), code, message, request.getRequestURI()));
    }
}
