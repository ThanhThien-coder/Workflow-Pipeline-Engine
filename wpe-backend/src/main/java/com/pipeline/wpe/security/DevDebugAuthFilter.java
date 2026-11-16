package com.pipeline.wpe.security;

import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Filter dành riêng cho môi trường dev khi {@code app.security.debug-user-id-enabled=true}.
 * Chạy SAU {@link JwtAuthFilter}.
 * Nếu request có credentials (token sai) hoặc đã được authenticate -> không can thiệp.
 * Nếu không có token -> đọc header {@code X-Debug-User-Id} hoặc user debug mặc định.
 * <p>
 * Không đánh dấu @Component, được cấu hình qua SecurityConfig.
 */
public class DevDebugAuthFilter extends OncePerRequestFilter {

    private final UserRepository userRepository;
    private final Long defaultDebugUserId;

    public DevDebugAuthFilter(UserRepository userRepository, Long defaultDebugUserId) {
        this.userRepository = userRepository;
        this.defaultDebugUserId = defaultDebugUserId;
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        if (SecurityContextHolder.getContext().getAuthentication() == null && !hasCredentials(request)) {
            Long targetUserId = resolveDebugUserId(request);
            if (targetUserId != null) {
                UserEntity user = userRepository.findById(targetUserId).orElse(null);
                if (user != null && !Boolean.TRUE.equals(user.getIsLocked())) {
                    String roleName = user.getSystemRole() != null ? user.getSystemRole().name() : "USER";
                    UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                        user.getId(),
                        null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + roleName))
                    );
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            }
        }
        filterChain.doFilter(request, response);
    }

    private Long resolveDebugUserId(HttpServletRequest request) {
        String headerVal = request.getHeader("X-Debug-User-Id");
        if (headerVal != null) {
            try {
                return Long.parseLong(headerVal.trim());
            } catch (NumberFormatException e) {
                // Header không phải số -> bỏ qua (không đặt)
                return null;
            }
        }
        return defaultDebugUserId;
    }

    private static boolean hasCredentials(HttpServletRequest request) {
        if (request == null) {
            return false;
        }
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && !header.isBlank()) {
            return true;
        }
        if (JwtAuthFilter.allowsQueryToken(request)) {
            String token = request.getParameter(JwtAuthFilter.ACCESS_TOKEN_PARAM);
            return token != null && !token.isBlank();
        }
        return false;
    }
}
