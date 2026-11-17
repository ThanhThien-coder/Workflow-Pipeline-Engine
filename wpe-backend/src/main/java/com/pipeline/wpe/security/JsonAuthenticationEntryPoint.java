package com.pipeline.wpe.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pipeline.wpe.exception.ErrorResponse;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class JsonAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper;

    public JsonAuthenticationEntryPoint(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void commence(
        HttpServletRequest request,
        HttpServletResponse response,
        AuthenticationException authException
    ) throws IOException, ServletException {
        boolean hasCredentials = hasCredentials(request);
        String error;
        String message;
        if (hasCredentials) {
            error = "TOKEN_EXPIRED";
            message = "Your access token is invalid or has expired. Please refresh it or sign in again.";
        } else {
            error = "UNAUTHORIZED";
            message = "Please sign in to do this.";
        }

        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");

        ErrorResponse errorResponse = ErrorResponse.of(
            HttpServletResponse.SC_UNAUTHORIZED,
            error,
            message,
            request.getRequestURI()
        );

        objectMapper.writeValue(response.getOutputStream(), errorResponse);
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
