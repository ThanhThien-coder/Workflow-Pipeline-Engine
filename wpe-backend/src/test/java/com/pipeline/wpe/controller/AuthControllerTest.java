package com.pipeline.wpe.controller;

import com.pipeline.wpe.dto.request.auth.LoginRequest;
import com.pipeline.wpe.dto.request.auth.RegisterRequest;
import com.pipeline.wpe.dto.response.auth.AuthResponse;
import com.pipeline.wpe.exception.ConflictException;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.exception.UnauthorizedException;
import com.pipeline.wpe.service.auth.AuthService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
@AutoConfigureMockMvc(addFilters = false)
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AuthService authService;

    private final AuthResponse sample = new AuthResponse(
        "eyJ.jwt.sig", "rt_abc",
        new AuthResponse.UserSummary("2", "alex.kim", "alex.kim@pipeline.engine", "Alex Kim", "USER", null)
    );

    @Test
    @DisplayName("POST /api/v1/auth/register -> 201, user.id là chuỗi")
    void register_201() throws Exception {
        when(authService.register(any(RegisterRequest.class))).thenReturn(sample);

        mockMvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"alex.kim\",\"email\":\"alex.kim@pipeline.engine\",\"password\":\"Password123!\",\"fullName\":\"Alex Kim\"}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.token").value("eyJ.jwt.sig"))
            .andExpect(jsonPath("$.refreshToken").value("rt_abc"))
            .andExpect(jsonPath("$.user.id").value("2"))
            .andExpect(jsonPath("$.user.id").isString())
            .andExpect(jsonPath("$.user.role").value("USER"));
    }

    @Test
    @DisplayName("POST /api/auth/register (không v1) cũng hoạt động; trùng username -> 409 USERNAME_TAKEN")
    void register_409_username() throws Exception {
        when(authService.register(any(RegisterRequest.class)))
            .thenThrow(new ConflictException("USERNAME_TAKEN", "Tên đăng nhập đã được sử dụng."));

        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"alex.kim\",\"email\":\"x@wpe.io\",\"password\":\"Password123!\"}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("USERNAME_TAKEN"));
    }

    @Test
    @DisplayName("register trùng email -> 409 EMAIL_TAKEN")
    void register_409_email() throws Exception {
        when(authService.register(any(RegisterRequest.class)))
            .thenThrow(new ConflictException("EMAIL_TAKEN", "Email đã được sử dụng."));

        mockMvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"newbie\",\"email\":\"alex.kim@pipeline.engine\",\"password\":\"Password123!\"}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("EMAIL_TAKEN"));
    }

    @Test
    @DisplayName("register thiếu email, mật khẩu ngắn -> 400 VALIDATION_FAILED")
    void register_400_validation() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"ab\",\"password\":\"123\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("VALIDATION_FAILED"));
    }

    @Test
    @DisplayName("POST /api/v1/auth/login -> 200 kèm token, refreshToken, user")
    void login_200() throws Exception {
        when(authService.login(any(LoginRequest.class))).thenReturn(sample);

        mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"alex.kim\",\"password\":\"Password123!\",\"rememberMe\":true}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.token").value("eyJ.jwt.sig"))
            .andExpect(jsonPath("$.refreshToken").value("rt_abc"))
            .andExpect(jsonPath("$.user.username").value("alex.kim"));
    }

    @Test
    @DisplayName("login sai mật khẩu -> 401 BAD_CREDENTIALS")
    void login_401() throws Exception {
        when(authService.login(any(LoginRequest.class)))
            .thenThrow(new UnauthorizedException("BAD_CREDENTIALS", "Tên đăng nhập hoặc mật khẩu không đúng."));

        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"alex.kim\",\"password\":\"sai\"}"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error").value("BAD_CREDENTIALS"))
            .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    @DisplayName("login tài khoản khóa -> 403 ACCOUNT_LOCKED")
    void login_403() throws Exception {
        when(authService.login(any(LoginRequest.class)))
            .thenThrow(new ForbiddenException("ACCOUNT_LOCKED", "Tài khoản đã bị khóa."));

        mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"alex.kim\",\"password\":\"Password123!\"}"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("ACCOUNT_LOCKED"));
    }

    @Test
    @DisplayName("POST /api/v1/auth/refresh -> 200 cặp token mới")
    void refresh_200() throws Exception {
        when(authService.refresh("rt_abc")).thenReturn(sample);

        mockMvc.perform(post("/api/v1/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"rt_abc\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.token").exists())
            .andExpect(jsonPath("$.refreshToken").exists());
    }

    @Test
    @DisplayName("refresh token đã thu hồi gửi lại -> 401 REFRESH_TOKEN_REUSED")
    void refresh_401_reused() throws Exception {
        when(authService.refresh("rt_old"))
            .thenThrow(new UnauthorizedException("REFRESH_TOKEN_REUSED", "reused"));

        mockMvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"rt_old\"}"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error").value("REFRESH_TOKEN_REUSED"));
    }

    @Test
    @DisplayName("refresh không có body -> service nhận null, 401 INVALID_REFRESH_TOKEN")
    void refresh_401_missing() throws Exception {
        when(authService.refresh(isNull()))
            .thenThrow(new UnauthorizedException("INVALID_REFRESH_TOKEN", "invalid"));

        mockMvc.perform(post("/api/v1/auth/refresh"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error").value("INVALID_REFRESH_TOKEN"));
    }

    @Test
    @DisplayName("POST /api/v1/auth/logout -> 200 { success: true } và thu hồi token")
    void logout_200() throws Exception {
        mockMvc.perform(post("/api/v1/auth/logout").contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"rt_abc\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true));
        verify(authService).logout("rt_abc");
    }
}
