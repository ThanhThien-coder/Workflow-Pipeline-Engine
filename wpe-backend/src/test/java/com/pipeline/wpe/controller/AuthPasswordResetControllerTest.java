package com.pipeline.wpe.controller;

import com.pipeline.wpe.exception.BadRequestException;
import com.pipeline.wpe.exception.ServiceUnavailableException;
import com.pipeline.wpe.service.auth.AuthService;
import com.pipeline.wpe.service.auth.PasswordResetService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
@AutoConfigureMockMvc(addFilters = false)
class AuthPasswordResetControllerTest {

    private static final String INVALID_MSG = "This password reset link is invalid or has expired. Please request a new one.";

    @Autowired private MockMvc mockMvc;
    @MockBean private AuthService authService;
    @MockBean private PasswordResetService passwordResetService;

    @Test
    @DisplayName("GET /password-reset/status -> 200 { enabled } (cả 2 tiền tố)")
    void status_ok() throws Exception {
        when(passwordResetService.isEnabled()).thenReturn(true);
        mockMvc.perform(get("/api/v1/auth/password-reset/status"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.enabled").value(true));
        when(passwordResetService.isEnabled()).thenReturn(false);
        mockMvc.perform(get("/api/auth/password-reset/status"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.enabled").value(false));
    }

    @Test
    @DisplayName("POST /forgot-password -> 200 thông điệp cố định")
    void forgot_ok() throws Exception {
        mockMvc.perform(post("/api/auth/forgot-password").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"alex@example.com\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.message").value("If an account exists for this email, we've sent a password reset link."));
        verify(passwordResetService).requestReset("alex@example.com");
    }

    @Test
    @DisplayName("POST /forgot-password: email trống / sai định dạng / quá 100 ký tự -> 400 VALIDATION_FAILED")
    void forgot_validation() throws Exception {
        String tooLong = "a".repeat(95) + "@example.com";
        for (String body : new String[]{"{\"email\":\"\"}", "{}", "{\"email\":\"not-an-email\"}", "{\"email\":\"" + tooLong + "\"}"}) {
            mockMvc.perform(post("/api/v1/auth/forgot-password").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_FAILED"));
        }
        verify(passwordResetService, never()).requestReset(org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("POST /forgot-password: mail tắt -> 503 PASSWORD_RESET_UNAVAILABLE")
    void forgot_503() throws Exception {
        doThrow(new ServiceUnavailableException("PASSWORD_RESET_UNAVAILABLE", PasswordResetService.UNAVAILABLE_MESSAGE))
            .when(passwordResetService).requestReset("alex@example.com");
        mockMvc.perform(post("/api/v1/auth/forgot-password").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"alex@example.com\"}"))
            .andExpect(status().isServiceUnavailable())
            .andExpect(jsonPath("$.error").value("PASSWORD_RESET_UNAVAILABLE"))
            .andExpect(jsonPath("$.message").value("Password reset by email isn't available right now. Please contact your workspace administrator."));
    }

    @Test
    @DisplayName("POST /reset-password/verify: hợp lệ -> { valid: true }; sai -> 400 INVALID_RESET_TOKEN")
    void verify_cases() throws Exception {
        mockMvc.perform(post("/api/v1/auth/reset-password/verify").contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"good\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.valid").value(true));

        doThrow(new BadRequestException("INVALID_RESET_TOKEN", INVALID_MSG)).when(passwordResetService).verifyToken("bad");
        mockMvc.perform(post("/api/auth/reset-password/verify").contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"bad\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("INVALID_RESET_TOKEN"))
            .andExpect(jsonPath("$.message").value(INVALID_MSG));
    }

    @Test
    @DisplayName("POST /reset-password: thành công -> 200 thông điệp, không trả token")
    void reset_ok() throws Exception {
        mockMvc.perform(post("/api/v1/auth/reset-password").contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"good\",\"newPassword\":\"BrandNew123\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.message").value("Your password has been reset. You can now sign in with your new password."))
            .andExpect(jsonPath("$.token").doesNotExist())
            .andExpect(jsonPath("$.refreshToken").doesNotExist());
        verify(passwordResetService).resetPassword("good", "BrandNew123");
        verifyNoInteractions(authService);
    }

    @Test
    @DisplayName("POST /reset-password: INVALID_RESET_TOKEN và WEAK_PASSWORD -> 400")
    void reset_errors() throws Exception {
        doThrow(new BadRequestException("INVALID_RESET_TOKEN", INVALID_MSG)).when(passwordResetService).resetPassword("bad", "BrandNew123");
        mockMvc.perform(post("/api/auth/reset-password").contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"bad\",\"newPassword\":\"BrandNew123\"}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("INVALID_RESET_TOKEN"));

        doThrow(new BadRequestException("WEAK_PASSWORD", "weak")).when(passwordResetService).resetPassword("good", "short");
        mockMvc.perform(post("/api/auth/reset-password").contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"good\",\"newPassword\":\"short\"}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("WEAK_PASSWORD"));
    }
}
