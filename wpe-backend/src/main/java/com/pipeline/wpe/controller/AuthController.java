package com.pipeline.wpe.controller;

import com.pipeline.wpe.dto.request.auth.LoginRequest;
import com.pipeline.wpe.dto.request.auth.LogoutRequest;
import com.pipeline.wpe.dto.request.auth.RefreshRequest;
import com.pipeline.wpe.dto.request.auth.RegisterRequest;
import com.pipeline.wpe.dto.response.auth.AuthResponse;
import com.pipeline.wpe.dto.response.auth.LogoutResponse;
import com.pipeline.wpe.exception.UnauthorizedException;
import com.pipeline.wpe.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "1. Auth Gateway", description = "Đăng ký, đăng nhập, xoay vòng token và thu hồi phiên")
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    @Operation(summary = "Đăng ký tài khoản")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    @PostMapping("/login")
    @Operation(summary = "Đăng nhập và cấp cặp access/refresh token")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @PostMapping("/refresh")
    @Operation(summary = "Xoay vòng refresh token")
    public AuthResponse refresh(@Valid @RequestBody RefreshRequest request) {
        return authService.refresh(request);
    }

    @PostMapping("/logout")
    @Operation(summary = "Thu hồi refresh token của phiên đăng nhập hiện tại")
    public LogoutResponse logout(@Valid @RequestBody LogoutRequest request, Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Long userId)) {
            throw new UnauthorizedException("AUTHENTICATION_REQUIRED", "Sign-in is required to log out.");
        }
        authService.logout(userId, request.refreshToken());
        return new LogoutResponse(true);
    }
}
