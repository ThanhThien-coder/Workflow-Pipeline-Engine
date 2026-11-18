package com.pipeline.wpe.controller;

import com.pipeline.wpe.dto.request.auth.ForgotPasswordRequest;
import com.pipeline.wpe.dto.request.auth.LoginRequest;
import com.pipeline.wpe.dto.request.auth.RefreshTokenRequest;
import com.pipeline.wpe.dto.request.auth.RegisterRequest;
import com.pipeline.wpe.dto.request.auth.ResetPasswordRequest;
import com.pipeline.wpe.dto.request.auth.ResetPasswordVerifyRequest;
import com.pipeline.wpe.dto.response.auth.AuthResponse;
import com.pipeline.wpe.dto.response.auth.LogoutResponse;
import com.pipeline.wpe.dto.response.auth.PasswordResetStatusResponse;
import com.pipeline.wpe.dto.response.auth.ResetTokenValidResponse;
import com.pipeline.wpe.dto.response.auth.SuccessMessageResponse;
import com.pipeline.wpe.service.auth.AuthService;
import com.pipeline.wpe.service.auth.PasswordResetService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/v1/auth", "/api/auth"})
@RequiredArgsConstructor
@Tag(name = "Auth Gateway", description = "Đăng ký, đăng nhập, làm mới token (rotation) và đăng xuất")
public class AuthController {

    private final AuthService authService;
    private final PasswordResetService passwordResetService;

    @PostMapping("/register")
    @Operation(summary = "Đăng ký tài khoản", description = "201 kèm cặp token. 409 USERNAME_TAKEN / EMAIL_TAKEN khi trùng.")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    @PostMapping("/login")
    @Operation(summary = "Đăng nhập", description = "200 kèm cặp token. 401 BAD_CREDENTIALS, 403 ACCOUNT_LOCKED.")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/refresh")
    @Operation(summary = "Làm mới token (xoay vòng)",
        description = "200 kèm cặp token mới; refresh token cũ bị thu hồi. 401 INVALID_REFRESH_TOKEN / REFRESH_TOKEN_REUSED.")
    public ResponseEntity<AuthResponse> refresh(@RequestBody(required = false) RefreshTokenRequest request) {
        return ResponseEntity.ok(authService.refresh(request != null ? request.refreshToken() : null));
    }

    @PostMapping("/logout")
    @Operation(summary = "Đăng xuất", description = "Thu hồi refresh token được gửi lên. Luôn trả 200 { success: true }.")
    public ResponseEntity<LogoutResponse> logout(@RequestBody(required = false) RefreshTokenRequest request) {
        authService.logout(request != null ? request.refreshToken() : null);
        return ResponseEntity.ok(new LogoutResponse(true));
    }

    @GetMapping("/password-reset/status")
    @Operation(summary = "Quên mật khẩu qua email có bật không", description = "200 { enabled }. enabled = false khi chưa cấu hình mail.")
    public ResponseEntity<PasswordResetStatusResponse> passwordResetStatus() {
        return ResponseEntity.ok(new PasswordResetStatusResponse(passwordResetService.isEnabled()));
    }

    @PostMapping("/forgot-password")
    @Operation(summary = "Yêu cầu link đặt lại mật khẩu",
        description = "Luôn 200 giống nhau dù email có tồn tại hay không. 400 VALIDATION_FAILED, 503 PASSWORD_RESET_UNAVAILABLE khi mail tắt.")
    public ResponseEntity<SuccessMessageResponse> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        passwordResetService.requestReset(request.email());
        return ResponseEntity.ok(new SuccessMessageResponse(true, PasswordResetService.FORGOT_MESSAGE));
    }

    @PostMapping("/reset-password/verify")
    @Operation(summary = "Kiểm tra link đặt lại mật khẩu", description = "200 { valid: true }. 400 INVALID_RESET_TOKEN.")
    public ResponseEntity<ResetTokenValidResponse> verifyResetToken(@RequestBody(required = false) ResetPasswordVerifyRequest request) {
        passwordResetService.verifyToken(request != null ? request.token() : null);
        return ResponseEntity.ok(new ResetTokenValidResponse(true));
    }

    @PostMapping("/reset-password")
    @Operation(summary = "Đặt mật khẩu mới bằng link", description = "200 { success, message }. 400 INVALID_RESET_TOKEN / WEAK_PASSWORD. Không tự đăng nhập.")
    public ResponseEntity<SuccessMessageResponse> resetPassword(@RequestBody(required = false) ResetPasswordRequest request) {
        passwordResetService.resetPassword(
            request != null ? request.token() : null,
            request != null ? request.newPassword() : null);
        return ResponseEntity.ok(new SuccessMessageResponse(true, PasswordResetService.RESET_DONE_MESSAGE));
    }
}
