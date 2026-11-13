package com.pipeline.wpe.controller.admin;

import com.pipeline.wpe.common.enums.SystemRole;
import com.pipeline.wpe.controller.AdminController;
import com.pipeline.wpe.dto.request.admin.SuspendUserRequest;
import com.pipeline.wpe.dto.response.admin.AdminUserResponse;
import com.pipeline.wpe.dto.response.admin.WorkspaceOverviewResponse;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.repository.UserRepository;
import com.pipeline.wpe.security.SecurityConfig;
import com.pipeline.wpe.service.admin.AdminService;
import com.pipeline.wpe.service.auth.JwtService;
import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * A6 — Test phân quyền thật qua chuỗi filter: SecurityConfig + JwtAuthFilter + @PreAuthorize.
 * <p>
 * pom.xml chưa có {@code spring-security-test} (nằm ngoài "Được ghi" của A6), nên KHÔNG dùng
 * {@code @WithMockUser}. Thay vào đó gửi header {@code Authorization: Bearer <token giả>}, mock
 * {@link JwtService#parseAccessToken} và {@link UserRepository#findById} để JwtAuthFilter đặt principal
 * với quyền {@code ROLE_ADMIN} hoặc {@code ROLE_USER} giống hệt khi chạy thật.
 */
@WebMvcTest(AdminController.class)
@Import(SecurityConfig.class)
class AdminControllerTest {

    private static final String ADMIN_TOKEN = "admin-token";
    private static final String USER_TOKEN = "user-token";
    private static final String BAD_TOKEN = "expired-token";

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AdminService adminService;
    @MockBean
    private JwtService jwtService;
    @MockBean
    private UserRepository userRepository;

    @BeforeEach
    void setUpTokens() {
        UserEntity admin = UserEntity.builder().id(1L).username("admin").email("admin@pipeline.engine")
            .passwordHash("x").systemRole(SystemRole.ADMIN).isLocked(false).tokenVersion(0).build();
        UserEntity sarah = UserEntity.builder().id(3L).username("sarah.chen").email("sarah.chen@pipeline.engine")
            .passwordHash("x").systemRole(SystemRole.USER).isLocked(false).tokenVersion(0).build();

        when(jwtService.parseAccessToken(ADMIN_TOKEN))
            .thenReturn(new JwtService.AccessTokenClaims(1L, "admin", "ADMIN", 0));
        when(jwtService.parseAccessToken(USER_TOKEN))
            .thenReturn(new JwtService.AccessTokenClaims(3L, "sarah.chen", "USER", 0));
        when(jwtService.parseAccessToken(BAD_TOKEN)).thenThrow(new JwtException("expired"));
        when(userRepository.findById(1L)).thenReturn(Optional.of(admin));
        when(userRepository.findById(3L)).thenReturn(Optional.of(sarah));
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }

    private static AdminUserResponse sarahDto(String status) {
        return new AdminUserResponse("3", "sarah.chen", "Sarah Chen", "s***@pipeline.engine", "USER", 2,
            null, null, status);
    }

    // ------------------------------------------------------------ phân quyền

    @Test
    @DisplayName("ADMIN gọi GET /api/v1/admin/users -> 200, email đã che")
    void admin_canListUsers() throws Exception {
        when(adminService.getUsers(isNull(), eq("ACTIVE"))).thenReturn(List.of(sarahDto("ACTIVE")));

        mockMvc.perform(get("/api/v1/admin/users").param("status", "ACTIVE")
                .header(HttpHeaders.AUTHORIZATION, bearer(ADMIN_TOKEN)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value("3"))
            .andExpect(jsonPath("$[0].maskedEmail").value("s***@pipeline.engine"))
            .andExpect(jsonPath("$[0].status").value("ACTIVE"))
            .andExpect(content().string(not(containsString("sarah.chen@pipeline.engine"))));
    }

    @Test
    @DisplayName("User thường (ROLE_USER) gọi API admin -> 403 ACCESS_DENIED (không phải 500), service không bị gọi")
    void regularUser_forbidden() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users").header(HttpHeaders.AUTHORIZATION, bearer(USER_TOKEN)))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.status").value(403))
            .andExpect(jsonPath("$.error").value("ACCESS_DENIED"))
            .andExpect(jsonPath("$.path").value("/api/v1/admin/users"));

        mockMvc.perform(post("/api/v1/admin/users/5/suspend").header(HttpHeaders.AUTHORIZATION, bearer(USER_TOKEN))
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"x\",\"durationDays\":7}"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("ACCESS_DENIED"));

        mockMvc.perform(post("/api/v1/admin/workspaces/10/archive").header(HttpHeaders.AUTHORIZATION, bearer(USER_TOKEN)))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("ACCESS_DENIED"));

        verifyNoInteractions(adminService);
    }

    @Test
    @DisplayName("Chỉ có X-Debug-User-Id (không JWT) -> 401 UNAUTHORIZED, service không bị gọi")
    void debugHeaderOnly_unauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users").header("X-Debug-User-Id", "1"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error").value("UNAUTHORIZED"));
        verifyNoInteractions(adminService);
    }

    @Test
    @DisplayName("Có Authorization nhưng token sai/hết hạn -> 401 TOKEN_EXPIRED (để FE tự refresh)")
    void badToken_tokenExpired() throws Exception {
        mockMvc.perform(get("/api/v1/admin/workspaces").header(HttpHeaders.AUTHORIZATION, bearer(BAD_TOKEN)))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error").value("TOKEN_EXPIRED"));
        verifyNoInteractions(adminService);
    }

    // ---------------------------------------------------------------- suspend

    @Test
    @DisplayName("ADMIN khóa user khác ADMIN -> 403 CANNOT_SUSPEND_ADMIN")
    void suspendAdmin_cannotSuspendAdmin() throws Exception {
        when(adminService.suspendUser(eq(1L), any(SuspendUserRequest.class), eq(1L)))
            .thenThrow(new ForbiddenException("CANNOT_SUSPEND_ADMIN", "Không được khóa tài khoản có quyền ADMIN."));

        mockMvc.perform(post("/api/v1/admin/users/1/suspend").header(HttpHeaders.AUTHORIZATION, bearer(ADMIN_TOKEN))
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"test\",\"durationDays\":7}"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("CANNOT_SUSPEND_ADMIN"));
    }

    @Test
    @DisplayName("ADMIN khóa user thường -> 200 SUSPENDED; body reason + durationDays chuyển đúng vào service")
    void suspendUser_ok() throws Exception {
        when(adminService.suspendUser(eq(3L), any(SuspendUserRequest.class), eq(1L))).thenReturn(sarahDto("SUSPENDED"));

        mockMvc.perform(post("/api/admin/users/3/suspend").header(HttpHeaders.AUTHORIZATION, bearer(ADMIN_TOKEN))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"Vi phạm chính sách bảo mật\",\"durationDays\":7}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("SUSPENDED"));

        ArgumentCaptor<SuspendUserRequest> captor = ArgumentCaptor.forClass(SuspendUserRequest.class);
        verify(adminService).suspendUser(eq(3L), captor.capture(), eq(1L));
        org.assertj.core.api.Assertions.assertThat(captor.getValue().reason()).isEqualTo("Vi phạm chính sách bảo mật");
        org.assertj.core.api.Assertions.assertThat(captor.getValue().durationDays()).isEqualTo(7);
    }

    @Test
    @DisplayName("Suspend thiếu reason -> 400 VALIDATION_FAILED")
    void suspend_missingReason_400() throws Exception {
        mockMvc.perform(post("/api/v1/admin/users/3/suspend").header(HttpHeaders.AUTHORIZATION, bearer(ADMIN_TOKEN))
                .contentType(MediaType.APPLICATION_JSON).content("{\"durationDays\":7}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("VALIDATION_FAILED"));
        verify(adminService, never()).suspendUser(any(), any(), any());
    }

    @Test
    @DisplayName("ADMIN mở khóa -> 200 ACTIVE")
    void unban_ok() throws Exception {
        when(adminService.unbanUser(3L, 1L)).thenReturn(sarahDto("ACTIVE"));
        mockMvc.perform(post("/api/v1/admin/users/3/unban").header(HttpHeaders.AUTHORIZATION, bearer(ADMIN_TOKEN)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ACTIVE"));
    }

    // ------------------------------------------------------------- workspaces

    @Test
    @DisplayName("GET /admin/workspaces -> 200, chỉ metadata, không có field task/title/description")
    void workspaces_metadataOnly() throws Exception {
        when(adminService.getWorkspaces()).thenReturn(List.of(new WorkspaceOverviewResponse(
            "10", "Core Banking Pipeline", "2", "Alex Kim", "ACTIVE", 4, 6, Instant.parse("2026-11-01T10:00:00Z"))));

        mockMvc.perform(get("/api/v1/admin/workspaces").header(HttpHeaders.AUTHORIZATION, bearer(ADMIN_TOKEN)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].name").value("Core Banking Pipeline"))
            .andExpect(jsonPath("$[0].memberCount").value(4))
            .andExpect(jsonPath("$[0].nodeCount").value(6))
            .andExpect(jsonPath("$[0].tasks").doesNotExist())
            .andExpect(jsonPath("$[0].title").doesNotExist())
            .andExpect(jsonPath("$[0].description").doesNotExist());
    }

    @Test
    @DisplayName("ADMIN archive -> 200 ARCHIVED")
    void archive_ok() throws Exception {
        when(adminService.archiveWorkspace(10L, 1L)).thenReturn(new WorkspaceOverviewResponse(
            "10", "Core Banking Pipeline", "2", "Alex Kim", "ARCHIVED", 4, 6, Instant.now()));
        mockMvc.perform(post("/api/v1/admin/workspaces/10/archive").header(HttpHeaders.AUTHORIZATION, bearer(ADMIN_TOKEN)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ARCHIVED"));
    }

    @Test
    @DisplayName("Không gửi gì -> 401, không phải 200 hay 500")
    void anonymous_unauthorized() throws Exception {
        mockMvc.perform(post("/api/v1/admin/workspaces/10/archive"))
            .andExpect(status().isUnauthorized());
        verify(adminService, never()).archiveWorkspace(any(), any());
        verify(jwtService, never()).parseAccessToken(anyString());
    }
}
