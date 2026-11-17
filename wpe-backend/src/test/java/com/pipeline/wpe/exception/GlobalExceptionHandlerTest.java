package com.pipeline.wpe.exception;

import com.pipeline.wpe.service.admin.AdminAuditService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GlobalExceptionHandlerTest {

    @Mock
    private ObjectProvider<AdminAuditService> adminAuditServiceProvider;

    private GlobalExceptionHandler handler;

    @BeforeEach
    void setUp() {
        handler = new GlobalExceptionHandler(adminAuditServiceProvider);
    }

    @Test
    @DisplayName("NoResourceFoundException -> 404 NOT_FOUND")
    void testHandleNoResourceFound() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/khong-ton-tai");

        NoResourceFoundException ex = new NoResourceFoundException(HttpMethod.GET, "/api/v1/khong-ton-tai");
        ResponseEntity<ErrorResponse> response = handler.handleNotFound(ex, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().status()).isEqualTo(404);
        assertThat(response.getBody().error()).isEqualTo("NOT_FOUND");
        assertThat(response.getBody().message()).isEqualTo("The requested resource was not found.");
        assertThat(response.getBody().path()).isEqualTo("/api/v1/khong-ton-tai");
    }

    @Test
    @DisplayName("NoHandlerFoundException -> 404 NOT_FOUND")
    void testHandleNoHandlerFound() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/unknown");

        NoHandlerFoundException ex = new NoHandlerFoundException("GET", "/api/v1/unknown", new HttpHeaders());
        ResponseEntity<ErrorResponse> response = handler.handleNotFound(ex, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().status()).isEqualTo(404);
        assertThat(response.getBody().error()).isEqualTo("NOT_FOUND");
        assertThat(response.getBody().message()).isEqualTo("The requested resource was not found.");
        assertThat(response.getBody().path()).isEqualTo("/api/v1/unknown");
    }

    @Test
    @DisplayName("HttpRequestMethodNotSupportedException -> 405 METHOD_NOT_ALLOWED")
    void testHandleMethodNotSupported() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/health");

        HttpRequestMethodNotSupportedException ex = new HttpRequestMethodNotSupportedException("DELETE");
        ResponseEntity<ErrorResponse> response = handler.handleMethodNotSupported(ex, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.METHOD_NOT_ALLOWED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().status()).isEqualTo(405);
        assertThat(response.getBody().error()).isEqualTo("METHOD_NOT_ALLOWED");
        assertThat(response.getBody().path()).isEqualTo("/api/v1/health");
    }

    @Test
    @DisplayName("HttpMediaTypeNotSupportedException -> 415 UNSUPPORTED_MEDIA_TYPE")
    void testHandleMediaTypeNotSupported() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/projects");

        HttpMediaTypeNotSupportedException ex = new HttpMediaTypeNotSupportedException("text/plain");
        ResponseEntity<ErrorResponse> response = handler.handleMediaTypeNotSupported(ex, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNSUPPORTED_MEDIA_TYPE);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().status()).isEqualTo(415);
        assertThat(response.getBody().error()).isEqualTo("UNSUPPORTED_MEDIA_TYPE");
        assertThat(response.getBody().path()).isEqualTo("/api/v1/projects");
    }

    @Test
    @DisplayName("HttpMessageNotReadableException -> 400 MALFORMED_REQUEST")
    void testHandleMessageNotReadable() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/projects");

        HttpMessageNotReadableException ex = mock(HttpMessageNotReadableException.class);
        ResponseEntity<ErrorResponse> response = handler.handleMessageNotReadable(ex, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().status()).isEqualTo(400);
        assertThat(response.getBody().error()).isEqualTo("MALFORMED_REQUEST");
        assertThat(response.getBody().message()).isEqualTo("The request body is not valid JSON.");
        assertThat(response.getBody().path()).isEqualTo("/api/v1/projects");
    }

    @Test
    @DisplayName("MethodArgumentTypeMismatchException -> 400 INVALID_PARAMETER")
    void testHandleMethodArgumentTypeMismatch() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/projects/abc");

        MethodArgumentTypeMismatchException ex = mock(MethodArgumentTypeMismatchException.class);
        when(ex.getName()).thenReturn("id");
        ResponseEntity<ErrorResponse> response = handler.handleMethodArgumentTypeMismatch(ex, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().status()).isEqualTo(400);
        assertThat(response.getBody().error()).isEqualTo("INVALID_PARAMETER");
        assertThat(response.getBody().message()).contains("id");
        assertThat(response.getBody().message()).doesNotContain("java.lang", "Long", "String");
        assertThat(response.getBody().path()).isEqualTo("/api/v1/projects/abc");
    }

    @Test
    @DisplayName("MissingServletRequestParameterException -> 400 MISSING_PARAMETER")
    void testHandleMissingServletRequestParameter() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/notifications");

        MissingServletRequestParameterException ex = new MissingServletRequestParameterException("limit", "Integer");
        ResponseEntity<ErrorResponse> response = handler.handleMissingServletRequestParameter(ex, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().status()).isEqualTo(400);
        assertThat(response.getBody().error()).isEqualTo("MISSING_PARAMETER");
        assertThat(response.getBody().message()).contains("limit");
        assertThat(response.getBody().path()).isEqualTo("/api/v1/notifications");
    }

    @Test
    @DisplayName("HandlerMethodValidationException -> 400 VALIDATION_FAILED")
    void testHandleHandlerMethodValidation() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/test");

        HandlerMethodValidationException ex = mock(HandlerMethodValidationException.class);
        ResponseEntity<ErrorResponse> response = handler.handleHandlerMethodValidation(ex, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().status()).isEqualTo(400);
        assertThat(response.getBody().error()).isEqualTo("VALIDATION_FAILED");
        assertThat(response.getBody().path()).isEqualTo("/api/v1/test");
    }

    @Test
    @DisplayName("Exception -> 500 INTERNAL_SERVER_ERROR với message cố định không lộ chi tiết")
    void testHandleGeneralException() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/v1/secret-crash");
        when(request.getMethod()).thenReturn("POST");

        Exception ex = new RuntimeException("Fatal SQL syntax error near SELECT * FROM sensitive_db");
        ResponseEntity<ErrorResponse> response = handler.handleGeneralException(ex, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().status()).isEqualTo(500);
        assertThat(response.getBody().error()).isEqualTo("INTERNAL_SERVER_ERROR");
        assertThat(response.getBody().message()).isEqualTo("Something went wrong on our end. Please try again in a moment.");
        assertThat(response.getBody().message()).doesNotContain("Fatal SQL", "sensitive_db");
        assertThat(response.getBody().path()).isEqualTo("/api/v1/secret-crash");
    }
}
