package com.pipeline.wpe.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pipeline.wpe.common.enums.SystemRole;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.exception.ErrorResponse;
import com.pipeline.wpe.repository.UserRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenService jwtTokenService;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization == null || authorization.isBlank()) {
            filterChain.doFilter(request, response);
            return;
        }

        if (!authorization.startsWith("Bearer ") || authorization.length() <= 7) {
            writeError(request, response, HttpServletResponse.SC_UNAUTHORIZED, "TOKEN_INVALID", "Bearer token is invalid.");
            return;
        }

        Claims claims;
        try {
            claims = jwtTokenService.parseAccessToken(authorization.substring(7).trim());
        } catch (ExpiredJwtException ex) {
            writeError(request, response, HttpServletResponse.SC_UNAUTHORIZED, "TOKEN_EXPIRED", "Access token has expired.");
            return;
        } catch (JwtException | IllegalArgumentException ex) {
            writeError(request, response, HttpServletResponse.SC_UNAUTHORIZED, "TOKEN_INVALID", "Bearer token is invalid.");
            return;
        }

        Long userId;
        Object tokenVersionClaim;
        try {
            userId = Long.valueOf(claims.getSubject());
            tokenVersionClaim = claims.get("tokenVersion");
        } catch (RuntimeException ex) {
            writeError(request, response, HttpServletResponse.SC_UNAUTHORIZED, "TOKEN_INVALID", "Bearer token is invalid.");
            return;
        }
        if (!(tokenVersionClaim instanceof Number claimedTokenVersion)) {
            writeError(request, response, HttpServletResponse.SC_UNAUTHORIZED, "TOKEN_INVALID", "Bearer token is invalid.");
            return;
        }

        UserEntity user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            writeError(request, response, HttpServletResponse.SC_UNAUTHORIZED, "TOKEN_INVALID", "Bearer token is invalid.");
            return;
        }
        if (Boolean.TRUE.equals(user.getIsLocked())) {
            writeError(request, response, HttpServletResponse.SC_FORBIDDEN, "ACCOUNT_LOCKED", "This account is locked.");
            return;
        }
        if (claimedTokenVersion.intValue() != user.getTokenVersion()) {
            writeError(request, response, HttpServletResponse.SC_UNAUTHORIZED, "SESSION_REVOKED", "This session is no longer valid. Please sign in again.");
            return;
        }

        SystemRole role = user.getSystemRole();
        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
            user.getId(),
            null,
            List.of(new SimpleGrantedAuthority("ROLE_" + role.name()))
        );
        authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        SecurityContextHolder.getContext().setAuthentication(authentication);
        filterChain.doFilter(request, response);
    }

    private void writeError(
        HttpServletRequest request,
        HttpServletResponse response,
        int status,
        String code,
        String message
    ) throws IOException {
        SecurityContextHolder.clearContext();
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(response.getOutputStream(), ErrorResponse.of(status, code, message, request.getRequestURI()));
    }
}
