package com.pipeline.wpe.admin;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pipeline.wpe.controller.AdminController;
import com.pipeline.wpe.dto.request.admin.ChangeUserRoleRequest;
import com.pipeline.wpe.dto.request.admin.SuspendUserRequest;
import com.pipeline.wpe.dto.request.admin.TransferProjectOwnerRequest;
import com.pipeline.wpe.dto.response.admin.AdminAuditLogPageResponse;
import com.pipeline.wpe.dto.response.admin.AdminAuditLogResponse;
import com.pipeline.wpe.dto.response.admin.AdminUserResponse;
import com.pipeline.wpe.dto.response.admin.OwnedProjectResponse;
import com.pipeline.wpe.exception.ConflictException;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.admin.AdminAuditService;
import com.pipeline.wpe.service.admin.AdminProjectOwnerService;
import com.pipeline.wpe.service.admin.AdminUserService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AdminController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(AdminControllerTest.MethodSecurityConfig.class)
class AdminControllerTest {

    @TestConfiguration
    @EnableMethodSecurity
    static class MethodSecurityConfig {
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AdminUserService adminUserService;

    @MockBean
    private AdminProjectOwnerService adminProjectOwnerService;

    @MockBean
    private AdminAuditService adminAuditService;

    @MockBean
    private CurrentUserProvider currentUserProvider;

    private static void loginAs(long userId, String role) {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(
                userId,
                null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role))
            )
        );
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    private final AdminUserResponse sampleUser = new AdminUserResponse(
        "2",
        "Alex Kim",
        "alex.kim",
        "a***@pipeline.engine",
        "USER",
        "ACTIVE",
        3L,
        5L,
        Instant.now()
    );

    @Test
    @DisplayName("ADMIN gọi GET /api/v1/admin/users -> 200 OK")
    void testListUsers_asAdmin_returns200() throws Exception {
        loginAs(1L, "ADMIN");
        when(adminUserService.listUsers(any(), any())).thenReturn(List.of(sampleUser));

        mockMvc.perform(get("/api/v1/admin/users"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value("2"))
            .andExpect(jsonPath("$[0].username").value("alex.kim"))
            .andExpect(jsonPath("$[0].maskedEmail").value("a***@pipeline.engine"));
    }

    @Test
    @DisplayName("USER thường gọi GET /api/v1/admin/users -> 403 Forbidden")
    void testListUsers_asUser_returns403() throws Exception {
        loginAs(2L, "USER");

        mockMvc.perform(get("/api/v1/admin/users"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("ACCESS_DENIED"));
    }

    @Test
    @DisplayName("Không đăng nhập gọi GET /api/v1/admin/users -> 401 Unauthorized")
    void testListUsers_anonymous_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error").value("UNAUTHORIZED"));
    }

    @Test
    @DisplayName("ADMIN khóa admin (service ném CANNOT_SUSPEND_ADMIN) -> 403 Forbidden và error=CANNOT_SUSPEND_ADMIN")
    void testSuspendAdmin_returns403CannotSuspendAdmin() throws Exception {
        loginAs(1L, "ADMIN");
        when(currentUserProvider.requireCurrentUserId()).thenReturn(1L);
        when(adminUserService.suspendUser(eq(99L), any(SuspendUserRequest.class), eq(1L)))
            .thenThrow(new ForbiddenException("CANNOT_SUSPEND_ADMIN", "Không thể khóa tài khoản quản trị viên."));

        mockMvc.perform(post("/api/v1/admin/users/99/suspend")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new SuspendUserRequest("Vi phạm", 7, "Chi tiết"))))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("CANNOT_SUSPEND_ADMIN"));
    }

    @Test
    @DisplayName("ADMIN khóa user thường -> 200 OK")
    void testSuspendRegularUser_returns200() throws Exception {
        loginAs(1L, "ADMIN");
        when(currentUserProvider.requireCurrentUserId()).thenReturn(1L);

        AdminUserResponse suspended = new AdminUserResponse(
            "2",
            "Alex Kim",
            "alex.kim",
            "a***@pipeline.engine",
            "USER",
            "SUSPENDED",
            3L,
            5L,
            Instant.now()
        );
        when(adminUserService.suspendUser(eq(2L), any(SuspendUserRequest.class), eq(1L)))
            .thenReturn(suspended);

        mockMvc.perform(post("/api/v1/admin/users/2/suspend")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new SuspendUserRequest("TERMS_VIOLATION", 10, null))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("SUSPENDED"));
    }

    @Test
    @DisplayName("ADMIN mở khóa user thường -> 200 OK")
    void testUnbanUser_returns200() throws Exception {
        loginAs(1L, "ADMIN");
        when(currentUserProvider.requireCurrentUserId()).thenReturn(1L);
        when(adminUserService.unbanUser(eq(2L), eq(1L))).thenReturn(sampleUser);

        mockMvc.perform(post("/api/v1/admin/users/2/unban"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ACTIVE"));
    }

    @Test
    @DisplayName("USER thường gọi GET /api/v1/admin/audit-logs -> 403 Forbidden")
    void testSearchAuditLogs_asUser_returns403() throws Exception {
        loginAs(2L, "USER");

        mockMvc.perform(get("/api/v1/admin/audit-logs"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("ACCESS_DENIED"));
    }

    @Test
    @DisplayName("ADMIN gọi GET /api/v1/admin/audit-logs?group=LOGIN -> 200 OK và service được gọi với LOGIN")
    void testSearchAuditLogs_asAdmin_returns200() throws Exception {
        loginAs(1L, "ADMIN");
        when(adminAuditService.search(eq("LOGIN"), any(), any(), any(), eq(0), eq(50)))
            .thenReturn(new AdminAuditLogPageResponse(List.of(), 0, 50, 0));

        mockMvc.perform(get("/api/v1/admin/audit-logs").param("group", "LOGIN"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.page").value(0))
            .andExpect(jsonPath("$.size").value(50))
            .andExpect(jsonPath("$.totalElements").value(0));

        org.mockito.Mockito.verify(adminAuditService).search(eq("LOGIN"), org.mockito.ArgumentMatchers.isNull(), org.mockito.ArgumentMatchers.isNull(), org.mockito.ArgumentMatchers.isNull(), eq(0), eq(50));
    }

    @Test
    @DisplayName("USER thường gọi PATCH /api/v1/admin/users/2/role -> 403 Forbidden")
    void testChangeRole_asUser_returns403() throws Exception {
        loginAs(2L, "USER");

        mockMvc.perform(patch("/api/v1/admin/users/2/role")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new ChangeUserRoleRequest("ADMIN"))))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("ACCESS_DENIED"));
    }

    @Test
    @DisplayName("ADMIN gọi PATCH /api/v1/admin/users/2/role -> 200 OK")
    void testChangeRole_asAdmin_returns200() throws Exception {
        loginAs(1L, "ADMIN");
        when(currentUserProvider.requireCurrentUserId()).thenReturn(1L);
        when(adminUserService.changeRole(eq(2L), eq("ADMIN"), eq(1L))).thenReturn(sampleUser);

        mockMvc.perform(patch("/api/v1/admin/users/2/role")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new ChangeUserRoleRequest("ADMIN"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value("2"))
            .andExpect(jsonPath("$.username").value("alex.kim"));
    }

    @Test
    @DisplayName("ADMIN gọi DELETE /api/v1/admin/users/5 -> 204 No Content")
    void testDeleteUser_asAdmin_returns204() throws Exception {
        loginAs(1L, "ADMIN");
        when(currentUserProvider.requireCurrentUserId()).thenReturn(1L);

        mockMvc.perform(delete("/api/v1/admin/users/5"))
            .andExpect(status().isNoContent());

        verify(adminUserService).deleteUser(5L, 1L);
    }

    @Test
    @DisplayName("Service ném ConflictException mã USER_HAS_DATA -> 409 Conflict và $.error == USER_HAS_DATA")
    void testDeleteUser_hasData_returns409() throws Exception {
        loginAs(1L, "ADMIN");
        when(currentUserProvider.requireCurrentUserId()).thenReturn(1L);
        doThrow(new ConflictException("USER_HAS_DATA", "Tài khoản đã có dữ liệu (1 dự án sở hữu). Hãy khóa tài khoản thay vì xóa."))
            .when(adminUserService).deleteUser(5L, 1L);

        mockMvc.perform(delete("/api/v1/admin/users/5"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("USER_HAS_DATA"));
    }

    @Test
    @DisplayName("ADMIN gọi GET /api/v1/admin/users/2/owned-projects -> 200 OK")
    void testListOwnedProjects_asAdmin_returns200() throws Exception {
        loginAs(1L, "ADMIN");
        OwnedProjectResponse projectResponse = new OwnedProjectResponse("1", "Dự án mẫu", "ACTIVE", 2, List.of());
        when(adminProjectOwnerService.listOwnedProjects(2L)).thenReturn(List.of(projectResponse));

        mockMvc.perform(get("/api/v1/admin/users/2/owned-projects"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].projectId").value("1"))
            .andExpect(jsonPath("$[0].name").value("Dự án mẫu"));
    }

    @Test
    @DisplayName("ADMIN gọi POST /api/v1/admin/projects/1/transfer-owner -> 200 OK")
    void testTransferOwner_asAdmin_returns200() throws Exception {
        loginAs(1L, "ADMIN");
        when(currentUserProvider.requireCurrentUserId()).thenReturn(1L);
        OwnedProjectResponse response = new OwnedProjectResponse("1", "Dự án mẫu", "ACTIVE", 2, List.of());
        when(adminProjectOwnerService.transferOwner(eq(1L), eq(2L), eq(1L))).thenReturn(response);

        mockMvc.perform(post("/api/v1/admin/projects/1/transfer-owner")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new TransferProjectOwnerRequest(2L))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.projectId").value("1"))
            .andExpect(jsonPath("$.name").value("Dự án mẫu"));
    }
}
