package com.pipeline.wpe.common.util;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

public final class SecurityUtils {

    private SecurityUtils() {}

    /**
     * Lấy ID của user đang gửi request.
     * 1. Kiểm tra Authentication trong SecurityContext.
     * 2. Nếu ở chế độ dev skeleton chưa có JWT, đọc qua Header 'X-User-Id'.
     * 3. Fallback mặc định về ID = 2 (Alex Kim - Seed data trong V2).
     */
    public static Long getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            try {
                return Long.parseLong(auth.getName());
            } catch (NumberFormatException ignored) {}
        }

        ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attrs != null) {
            HttpServletRequest request = attrs.getRequest();
            String headerVal = request.getHeader("X-User-Id");
            if (headerVal != null && !headerVal.isBlank()) {
                try {
                    return Long.parseLong(headerVal.trim());
                } catch (NumberFormatException ignored) {}
            }
        }

        // Mặc định fallback tài khoản dev Alex Kim (ID 2)
        return 2L;
    }
}

