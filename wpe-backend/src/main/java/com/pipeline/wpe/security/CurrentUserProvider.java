package com.pipeline.wpe.security;

import com.pipeline.wpe.exception.UnauthorizedException;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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

    @Value("${app.security.debug-user-id-enabled:false}")
    private boolean debugUserIdEnabled;

    @Value("${app.security.default-debug-user-id:2}")
    private Long defaultDebugUserId;

    /**
     * Lấy User ID của người dùng hiện tại đang gửi request.
     * 1. Ưu tiên đọc từ SecurityContext (khi module Auth JWT được kích hoạt).
     * 2. Nếu ở chế độ dev (debugUserIdEnabled=true): kiểm tra header X-Debug-User-Id.
     * 3. Fallback về defaultDebugUserId nếu bật chế độ debug.
     */
    public Optional<Long> getCurrentUserId() {
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
                }
            }
        }

        if (debugUserIdEnabled) {
            ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs != null) {
                HttpServletRequest request = attrs.getRequest();
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
     * Bắt buộc phải có user đăng nhập, nếu không có sẽ ném UnauthorizedException.
     */
    public Long requireCurrentUserId() {
        return getCurrentUserId()
            .orElseThrow(() -> new UnauthorizedException("Yêu cầu đăng nhập để thực hiện hành động này."));
    }
}
