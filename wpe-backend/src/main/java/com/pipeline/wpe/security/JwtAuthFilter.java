package com.pipeline.wpe.security;

import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.repository.UserRepository;
import com.pipeline.wpe.service.auth.JwtService;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Objects;

/**
 * Đọc header {@code Authorization: Bearer <jwt>}, kiểm chữ ký, hạn dùng, {@code tv == users.token_version}
 * và {@code is_locked = false}. Hợp lệ thì đặt SecurityContext (principal = userId kiểu Long,
 * authority = ROLE_&lt;system_role&gt;).
 * <p>
 * Ở giai đoạn này (trước X1) filter KHÔNG chặn request khi token sai: chỉ không đặt principal.
 * {@link CurrentUserProvider} sẽ trả 401 TOKEN_EXPIRED khi có header mà không có principal.
 * <p>
 * Không đánh dấu @Component để Spring Boot không tự đăng ký thêm một lần nữa ở servlet container
 * (và không kéo theo các test @WebMvcTest); bean được tạo trong {@link SecurityConfig}.
 */
@Slf4j
public class JwtAuthFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtService jwtService;
    private final UserRepository userRepository;

    public JwtAuthFilter(JwtService jwtService, UserRepository userRepository) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
        throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.startsWith(BEARER_PREFIX)
            && SecurityContextHolder.getContext().getAuthentication() == null) {
            authenticate(header.substring(BEARER_PREFIX.length()).trim());
        }
        filterChain.doFilter(request, response);
    }

    private void authenticate(String token) {
        try {
            JwtService.AccessTokenClaims claims = jwtService.parseAccessToken(token);
            UserEntity user = userRepository.findById(claims.userId()).orElse(null);
            if (user == null) {
                log.debug("JWT hợp lệ nhưng user #{} không tồn tại", claims.userId());
                return;
            }
            if (Boolean.TRUE.equals(user.getIsLocked())) {
                log.debug("JWT của user #{} bị bỏ qua vì tài khoản đang khóa", user.getId());
                return;
            }
            if (!Objects.equals(user.getTokenVersion(), claims.tokenVersion())) {
                log.debug("JWT của user #{} có tv={} khác token_version={}", user.getId(),
                    claims.tokenVersion(), user.getTokenVersion());
                return;
            }
            UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                user.getId(),
                null,
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getSystemRole().name()))
            );
            SecurityContextHolder.getContext().setAuthentication(authentication);
        } catch (JwtException | IllegalArgumentException e) {
            log.debug("JWT không hợp lệ: {}", e.getMessage());
        }
    }
}
