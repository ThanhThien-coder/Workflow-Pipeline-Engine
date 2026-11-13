package com.pipeline.wpe.admin;

import com.pipeline.wpe.exception.ErrorResponse;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.exception.GlobalExceptionHandler;
import com.pipeline.wpe.service.admin.AdminAuditAction;
import com.pipeline.wpe.service.admin.AdminAuditService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminAccessDeniedLogTest {

    @Mock
    private ObjectProvider<AdminAuditService> auditServiceProvider;

    @Mock
    private AdminAuditService auditService;

    private GlobalExceptionHandler handler;

    @BeforeEach
    void setUp() {
        handler = new GlobalExceptionHandler(auditServiceProvider);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("URI /api/v1/admin/users, có authentication ROLE_USER -> trả về 403 và ghi audit log ADMIN_ACCESS_DENIED")
    void handleSpringAccessDenied_adminUri_recordsAuditLog() {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(7L, null, List.of(new SimpleGrantedAuthority("ROLE_USER")))
        );
        when(auditServiceProvider.getIfAvailable()).thenReturn(auditService);

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/admin/users");

        ResponseEntity<ErrorResponse> response = handler.handleSpringAccessDenied(
            new AccessDeniedException("Access denied"),
            request
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().error()).isEqualTo("ACCESS_DENIED");

        verify(auditService).record(
            eq(7L),
            isNull(),
            eq(AdminAuditAction.ADMIN_ACCESS_DENIED),
            eq("API"),
            eq("GET /api/v1/admin/users"),
            eq("Không có quyền ADMIN")
        );
    }

    @Test
    @DisplayName("URI /api/v1/projects/1 -> trả về 403 nhưng KHÔNG gọi record")
    void handleSpringAccessDenied_nonAdminUri_doesNotRecord() {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(7L, null, List.of(new SimpleGrantedAuthority("ROLE_USER")))
        );

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/projects/1");

        ResponseEntity<ErrorResponse> response = handler.handleSpringAccessDenied(
            new AccessDeniedException("Access denied"),
            request
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        verifyNoInteractions(auditService);
    }

    @Test
    @DisplayName("Không có authentication -> trả về 401 và KHÔNG gọi record")
    void handleSpringAccessDenied_unauthenticated_returns401AndDoesNotRecord() {
        SecurityContextHolder.clearContext();

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/admin/users");

        ResponseEntity<ErrorResponse> response = handler.handleSpringAccessDenied(
            new AccessDeniedException("Access denied"),
            request
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        verifyNoInteractions(auditService);
    }

    @Test
    @DisplayName("getIfAvailable() trả về null -> vẫn trả về 403, không ném lỗi")
    void handleSpringAccessDenied_auditServiceNull_returns403WithoutThrowing() {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(7L, null, List.of(new SimpleGrantedAuthority("ROLE_USER")))
        );
        when(auditServiceProvider.getIfAvailable()).thenReturn(null);

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/admin/users");

        assertThatCode(() -> {
            ResponseEntity<ErrorResponse> response = handler.handleSpringAccessDenied(
                new AccessDeniedException("Access denied"),
                request
            );
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        }).doesNotThrowAnyException();

        verifyNoInteractions(auditService);
    }

    @Test
    @DisplayName("handleForbidden với CANNOT_SUSPEND_ADMIN trên request admin -> gọi record với detail 'CANNOT_SUSPEND_ADMIN'")
    void handleForbidden_adminUri_recordsAuditLogWithErrorCode() {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(7L, null, List.of(new SimpleGrantedAuthority("ROLE_USER")))
        );
        when(auditServiceProvider.getIfAvailable()).thenReturn(auditService);

        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/admin/users/1/suspend");

        ResponseEntity<ErrorResponse> response = handler.handleForbidden(
            new ForbiddenException("CANNOT_SUSPEND_ADMIN", "Không thể khóa tài khoản quản trị viên"),
            request
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().error()).isEqualTo("CANNOT_SUSPEND_ADMIN");

        verify(auditService).record(
            eq(7L),
            isNull(),
            eq(AdminAuditAction.ADMIN_ACCESS_DENIED),
            eq("API"),
            eq("POST /api/v1/admin/users/1/suspend"),
            eq("CANNOT_SUSPEND_ADMIN")
        );
    }
}
