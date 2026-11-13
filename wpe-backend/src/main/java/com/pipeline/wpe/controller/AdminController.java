package com.pipeline.wpe.controller;

import com.pipeline.wpe.dto.request.admin.SuspendUserRequest;
import com.pipeline.wpe.dto.response.admin.AdminUserResponse;
import com.pipeline.wpe.dto.response.admin.WorkspaceOverviewResponse;
import com.pipeline.wpe.exception.ErrorResponse;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.admin.AdminService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * A6 — API quản trị cho System Admin (integration map 10.1, 10.2).
 * <p>
 * Mỗi endpoint gắn {@code @PreAuthorize("hasRole('ADMIN')")} riêng (không gắn ở mức class, để không áp
 * lên hàm {@code @ExceptionHandler} bên dưới). Quyền lấy từ SecurityContext do JwtAuthFilter đặt khi
 * access token hợp lệ, nên request chỉ có {@code X-Debug-User-Id} luôn bị từ chối.
 */
@RestController
@RequestMapping({"/api/v1/admin", "/api/admin"})
@RequiredArgsConstructor
@Tag(name = "Admin Portal", description = "Quản trị người dùng (che email, khóa/mở) và workspace (chỉ metadata). Chỉ ADMIN.")
public class AdminController {

    private final AdminService adminService;

    @GetMapping("/users")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Danh sách người dùng (email đã che)",
        description = "query tìm theo username/họ tên; status = ACTIVE | SUSPENDED | ALL. 403 ACCESS_DENIED nếu không phải ADMIN.")
    public ResponseEntity<List<AdminUserResponse>> getUsers(
        @RequestParam(required = false) String query,
        @RequestParam(required = false) String status
    ) {
        return ResponseEntity.ok(adminService.getUsers(query, status));
    }

    @PostMapping("/users/{id}/suspend")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Khóa tài khoản",
        description = "is_locked = true, token_version += 1, thu hồi mọi refresh token. durationDays chỉ ghi log. "
            + "Khóa ADMIN -> 403 CANNOT_SUSPEND_ADMIN.")
    public ResponseEntity<AdminUserResponse> suspendUser(
        @PathVariable Long id,
        @Valid @RequestBody SuspendUserRequest request,
        Authentication authentication
    ) {
        return ResponseEntity.ok(adminService.suspendUser(id, request, actorId(authentication)));
    }

    @PostMapping("/users/{id}/unban")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Mở khóa tài khoản", description = "is_locked = false.")
    public ResponseEntity<AdminUserResponse> unbanUser(@PathVariable Long id, Authentication authentication) {
        return ResponseEntity.ok(adminService.unbanUser(id, actorId(authentication)));
    }

    @GetMapping("/workspaces")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Danh sách dự án (chỉ metadata)",
        description = "Tên, owner, trạng thái, số thành viên, số node, updatedAt. Không trả tiêu đề hay nội dung task.")
    public ResponseEntity<List<WorkspaceOverviewResponse>> getWorkspaces() {
        return ResponseEntity.ok(adminService.getWorkspaces());
    }

    @PostMapping("/workspaces/{id}/archive")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Lưu trữ dự án", description = "status = ARCHIVED.")
    public ResponseEntity<WorkspaceOverviewResponse> archiveWorkspace(@PathVariable Long id, Authentication authentication) {
        return ResponseEntity.ok(adminService.archiveWorkspace(id, actorId(authentication)));
    }

    /**
     * Khi {@code @PreAuthorize} từ chối, Spring ném {@link AccessDeniedException} (của Spring Security).
     * GlobalExceptionHandler hiện chỉ có nhánh {@code Exception.class} nên sẽ trả 500. Handler CỤC BỘ này
     * (chỉ áp cho AdminController) trả đúng mã:
     * <ul>
     *   <li>chưa đăng nhập, không có Authorization (kể cả chỉ có X-Debug-User-Id) -> 401 UNAUTHORIZED;</li>
     *   <li>có Authorization nhưng token sai/hết hạn/tv lệch/user bị khóa -> 401 TOKEN_EXPIRED (FE tự refresh);</li>
     *   <li>đã đăng nhập nhưng không phải ADMIN -> 403 ACCESS_DENIED.</li>
     * </ul>
     * Cần nhóm quyết: nên chuyển handler này lên GlobalExceptionHandler cho mọi controller.
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex, HttpServletRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean authenticated = auth != null && auth.isAuthenticated() && !(auth instanceof AnonymousAuthenticationToken);
        if (!authenticated) {
            String header = request.getHeader(HttpHeaders.AUTHORIZATION);
            boolean sentToken = header != null && !header.isBlank();
            String code = sentToken ? CurrentUserProvider.TOKEN_EXPIRED : "UNAUTHORIZED";
            String message = sentToken
                ? "Access token không hợp lệ hoặc đã hết hạn. Vui lòng làm mới token hoặc đăng nhập lại."
                : "Yêu cầu đăng nhập bằng tài khoản ADMIN.";
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ErrorResponse.of(HttpStatus.UNAUTHORIZED.value(), code, message, request.getRequestURI()));
        }
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(ErrorResponse.of(HttpStatus.FORBIDDEN.value(), "ACCESS_DENIED",
                "Chỉ quản trị viên hệ thống (ADMIN) được dùng chức năng này.", request.getRequestURI()));
    }

    private static Long actorId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof Long id) {
            return id;
        }
        return null;
    }
}
