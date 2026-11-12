package com.pipeline.wpe.security;

import com.pipeline.wpe.exception.UnauthorizedException;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Optional;

@Slf4j
@Component
@RequiredArgsConstructor
public class CurrentUserProvider {

    public static final String TOKEN_EXPIRED = "TOKEN_EXPIRED";

    @Value("${app.security.debug-user-id-enabled:false}")
    private boolean debugUserIdEnabled;

    @Value("${app.security.default-debug-user-id:2}")
    private Long defaultDebugUserId;

    /**
     * Lấy User ID của người dùng hiện tại đang gửi request.
     * 1. Ưu tiên đọc từ SecurityContext (JwtAuthFilter đặt khi access token hợp lệ).
     * 2. Request CÓ header Authorization mà không có principal (token sai, hết hạn, tv lệch, user khóa)
     *    -> trả rỗng, KHÔNG rơi về user debug.
     * 3. Request KHÔNG có Authorization và bật chế độ dev (debugUserIdEnabled=true): đọc header
     *    X-Debug-User-Id, không có thì dùng defaultDebugUserId. Giữ cơ chế này cho tới X1.
     */
    public Optional<Long> getCurrentUserId() {
        Optional<Long> authenticated = getAuthenticatedUserId();
        if (authenticated.isPresent()) {
            return authenticated;
        }

        HttpServletRequest request = currentRequest();
        if (hasAuthorizationHeader(request)) {
            return Optional.empty();
        }

        if (debugUserIdEnabled) {
            if (request != null) {
                String headerVal = request.getHeader("X-Debug-User-Id");
                if (headerVal != null && !headerVal.isBlank()) {
                    try {
                        return Optional.of(Long.parseLong(headerVal.trim()));
                    } catch (NumberFormatException e) {
                        log.warn("Invalid X-Debug-User-Id header: {}", headerVal);
                    }
                }
            }
            return Optional.ofNullable(defaultDebugUserId);
        }

        return Optional.empty();
    }

    /**
     * Bắt buộc phải có user đăng nhập.
     * Có header Authorization mà token không hợp lệ -> 401 TOKEN_EXPIRED (FE dựa vào mã này để gọi refresh).
     * Không có gì -> 401 UNAUTHORIZED.
     */
    public Long requireCurrentUserId() {
        Optional<Long> userId = getCurrentUserId();
        if (userId.isPresent()) {
            return userId.get();
        }
        if (hasAuthorizationHeader(currentRequest())) {
            throw new UnauthorizedException(TOKEN_EXPIRED,
                "Access token không hợp lệ hoặc đã hết hạn. Vui lòng làm mới token hoặc đăng nhập lại.");
        }
        throw new UnauthorizedException("Yêu cầu đăng nhập để thực hiện hành động này.");
    }

    private Optional<Long> getAuthenticatedUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && auth.getPrincipal() != null) {
            Object principal = auth.getPrincipal();
            if (principal instanceof Long id) {
                return Optional.of(id);
            }
            if (principal instanceof String str) {
                try {
                    return Optional.of(Long.parseLong(str));
                } catch (NumberFormatException ignored) {
                    // "anonymousUser" của Spring Security
                }
            }
        }
        return Optional.empty();
    }

    private static HttpServletRequest currentRequest() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs) {
            return attrs.getRequest();
        }
        return null;
    }

    private static boolean hasAuthorizationHeader(HttpServletRequest request) {
        if (request == null) {
            return false;
        }
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        return header != null && !header.isBlank();
    }
}
