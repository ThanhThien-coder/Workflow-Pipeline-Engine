package com.pipeline.wpe.exception;

import com.pipeline.wpe.service.admin.AdminAuditAction;
import com.pipeline.wpe.service.admin.AdminAuditService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.Instant;
import java.util.List;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    private final ObjectProvider<AdminAuditService> adminAuditServiceProvider;

    public GlobalExceptionHandler(ObjectProvider<AdminAuditService> adminAuditServiceProvider) {
        this.adminAuditServiceProvider = adminAuditServiceProvider;
    }

    private void recordAdminDenied(HttpServletRequest request, String reason) {
        try {
            if (request == null || request.getRequestURI() == null || !request.getRequestURI().startsWith("/api/v1/admin")) {
                return;
            }
            if (adminAuditServiceProvider == null) {
                return;
            }
            AdminAuditService auditService = adminAuditServiceProvider.getIfAvailable();
            if (auditService == null) {
                return;
            }
            Long actorUserId = null;
            org.springframework.security.core.Authentication auth =
                org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getPrincipal() instanceof Long userId) {
                actorUserId = userId;
            }
            String method = request.getMethod() != null ? request.getMethod() : "GET";
            String targetId = method + " " + request.getRequestURI();
            auditService.record(
                actorUserId,
                null,
                AdminAuditAction.ADMIN_ACCESS_DENIED,
                "API",
                targetId,
                reason
            );
        } catch (RuntimeException ignored) {
            // Không bao giờ để ghi log làm hỏng xử lý lỗi của handler
        }
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleResourceNotFound(ResourceNotFoundException ex, HttpServletRequest request) {
        ErrorResponse error = ErrorResponse.of(
            HttpStatus.NOT_FOUND.value(),
            "RESOURCE_NOT_FOUND",
            ex.getMessage(),
            request.getRequestURI()
        );
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
    }

    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<ErrorResponse> handleForbidden(ForbiddenException ex, HttpServletRequest request) {
        String reason = ex.getErrorCode() != null ? ex.getErrorCode() : ex.getMessage();
        recordAdminDenied(request, reason);
        ErrorResponse error = ErrorResponse.of(
            HttpStatus.FORBIDDEN.value(),
            ex.getErrorCode(),
            ex.getMessage(),
            request.getRequestURI()
        );
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(error);
    }

    @ExceptionHandler(UnauthorizedException.class)
    public ResponseEntity<ErrorResponse> handleUnauthorized(UnauthorizedException ex, HttpServletRequest request) {
        ErrorResponse error = ErrorResponse.of(
            HttpStatus.UNAUTHORIZED.value(),
            ex.getErrorCode(),
            ex.getMessage(),
            request.getRequestURI()
        );
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error);
    }

    @ExceptionHandler(CooldownActiveException.class)
    public ResponseEntity<ErrorResponse> handleCooldownActive(CooldownActiveException ex, HttpServletRequest request) {
        ErrorResponse error = ErrorResponse.withRetryAfter(
            HttpStatus.TOO_MANY_REQUESTS.value(),
            "COOLDOWN_ACTIVE",
            ex.getMessage(),
            request.getRequestURI(),
            ex.getRemainingSeconds()
        );
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(error);
    }

    @ExceptionHandler(AiServiceUnavailableException.class)
    public ResponseEntity<ErrorResponse> handleAiServiceUnavailable(AiServiceUnavailableException ex, HttpServletRequest request) {
        ErrorResponse error = ErrorResponse.of(
            HttpStatus.SERVICE_UNAVAILABLE.value(),
            "AI_SERVICE_UNAVAILABLE",
            ex.getMessage(),
            request.getRequestURI()
        );
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(error);
    }

    @ExceptionHandler(ServiceUnavailableException.class)
    public ResponseEntity<ErrorResponse> handleServiceUnavailable(ServiceUnavailableException ex, HttpServletRequest request) {
        ErrorResponse error = ErrorResponse.of(
            HttpStatus.SERVICE_UNAVAILABLE.value(),
            ex.getErrorCode(),
            ex.getMessage(),
            request.getRequestURI()
        );
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(error);
    }

    @ExceptionHandler(CycleDetectedException.class)
    public ResponseEntity<ErrorResponse> handleCycleDetected(CycleDetectedException ex, HttpServletRequest request) {
        ErrorResponse error = ErrorResponse.withCycle(
            HttpStatus.UNPROCESSABLE_ENTITY.value(),
            "CYCLE_DETECTED",
            ex.getMessage(),
            request.getRequestURI(),
            ex.getCycleNodes()
        );
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(error);
    }

    @ExceptionHandler(OptimisticLockingFailureException.class)
    public ResponseEntity<ErrorResponse> handleOptimisticLock(OptimisticLockingFailureException ex, HttpServletRequest request) {
        ErrorResponse error = ErrorResponse.of(
            HttpStatus.CONFLICT.value(),
            "OPTIMISTIC_LOCK_CONFLICT",
            "This task was changed by another member. Please refresh the page.",
            request.getRequestURI()
        );
        return ResponseEntity.status(HttpStatus.CONFLICT).body(error);
    }

    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ErrorResponse> handleConflict(ConflictException ex, HttpServletRequest request) {
        ErrorResponse error = ErrorResponse.of(
            HttpStatus.CONFLICT.value(),
            ex.getErrorCode(),
            ex.getMessage(),
            request.getRequestURI()
        );
        return ResponseEntity.status(HttpStatus.CONFLICT).body(error);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationErrors(MethodArgumentNotValidException ex, HttpServletRequest request) {
        List<ErrorResponse.ValidationErrorItem> validationErrors = ex.getBindingResult()
            .getAllErrors()
            .stream()
            .map(err -> {
                String field = err instanceof FieldError fe ? fe.getField() : err.getObjectName();
                Object rejected = err instanceof FieldError fe ? fe.getRejectedValue() : null;
                return new ErrorResponse.ValidationErrorItem(field, rejected, err.getDefaultMessage());
            })
            .toList();

        ErrorResponse error = new ErrorResponse(
            Instant.now(),
            HttpStatus.BAD_REQUEST.value(),
            "VALIDATION_FAILED",
            "The submitted data is invalid.",
            request.getRequestURI(),
            validationErrors,
            null,
            null
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<ErrorResponse> handleBadRequest(BadRequestException ex, HttpServletRequest request) {
        ErrorResponse error = ErrorResponse.of(
            HttpStatus.BAD_REQUEST.value(),
            ex.getErrorCode(),
            ex.getMessage(),
            request.getRequestURI()
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> handleMaxUploadSizeExceeded(MaxUploadSizeExceededException ex, HttpServletRequest request) {
        ErrorResponse error = ErrorResponse.of(
            HttpStatus.BAD_REQUEST.value(),
            "FILE_TOO_LARGE",
            "The file is too large. The maximum size is 2 MB.",
            request.getRequestURI()
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    @ExceptionHandler(MissingServletRequestPartException.class)
    public ResponseEntity<ErrorResponse> handleMissingServletRequestPart(MissingServletRequestPartException ex, HttpServletRequest request) {
        ErrorResponse error = ErrorResponse.of(
            HttpStatus.BAD_REQUEST.value(),
            "VALIDATION_FAILED",
            "Missing required file part: " + ex.getRequestPartName(),
            request.getRequestURI()
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex, HttpServletRequest request) {
        ErrorResponse error = ErrorResponse.of(
            HttpStatus.BAD_REQUEST.value(),
            "BAD_REQUEST",
            ex.getMessage(),
            request.getRequestURI()
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    @ExceptionHandler({NoResourceFoundException.class, NoHandlerFoundException.class})
    public ResponseEntity<ErrorResponse> handleNotFound(Exception ex, HttpServletRequest request) {
        ErrorResponse error = ErrorResponse.of(
            HttpStatus.NOT_FOUND.value(),
            "NOT_FOUND",
            "The requested resource was not found.",
            request != null ? request.getRequestURI() : ""
        );
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMethodNotSupported(HttpRequestMethodNotSupportedException ex, HttpServletRequest request) {
        String msg = "Method " + (ex.getMethod() != null ? ex.getMethod() : "") + " is not supported.";
        ErrorResponse error = ErrorResponse.of(
            HttpStatus.METHOD_NOT_ALLOWED.value(),
            "METHOD_NOT_ALLOWED",
            msg,
            request != null ? request.getRequestURI() : ""
        );
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED).body(error);
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMediaTypeNotSupported(HttpMediaTypeNotSupportedException ex, HttpServletRequest request) {
        ErrorResponse error = ErrorResponse.of(
            HttpStatus.UNSUPPORTED_MEDIA_TYPE.value(),
            "UNSUPPORTED_MEDIA_TYPE",
            "The content type is not supported.",
            request != null ? request.getRequestURI() : ""
        );
        return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).body(error);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleMessageNotReadable(HttpMessageNotReadableException ex, HttpServletRequest request) {
        ErrorResponse error = ErrorResponse.of(
            HttpStatus.BAD_REQUEST.value(),
            "MALFORMED_REQUEST",
            "The request body is not valid JSON.",
            request != null ? request.getRequestURI() : ""
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleMethodArgumentTypeMismatch(MethodArgumentTypeMismatchException ex, HttpServletRequest request) {
        String paramName = ex.getName() != null ? ex.getName() : "parameter";
        ErrorResponse error = ErrorResponse.of(
            HttpStatus.BAD_REQUEST.value(),
            "INVALID_PARAMETER",
            "Parameter '" + paramName + "' has an invalid format.",
            request != null ? request.getRequestURI() : ""
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorResponse> handleMissingServletRequestParameter(MissingServletRequestParameterException ex, HttpServletRequest request) {
        ErrorResponse error = ErrorResponse.of(
            HttpStatus.BAD_REQUEST.value(),
            "MISSING_PARAMETER",
            "Missing required parameter: " + ex.getParameterName(),
            request != null ? request.getRequestURI() : ""
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<ErrorResponse> handleHandlerMethodValidation(HandlerMethodValidationException ex, HttpServletRequest request) {
        ErrorResponse error = ErrorResponse.of(
            HttpStatus.BAD_REQUEST.value(),
            "VALIDATION_FAILED",
            "The submitted data is invalid.",
            request != null ? request.getRequestURI() : ""
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneralException(Exception ex, HttpServletRequest request) {
        String method = (request != null && request.getMethod() != null) ? request.getMethod() : "UNKNOWN";
        String uri = (request != null && request.getRequestURI() != null) ? request.getRequestURI() : "";
        log.error("Lỗi không lường trước tại {} {}", method, uri, ex);
        ErrorResponse error = ErrorResponse.of(
            HttpStatus.INTERNAL_SERVER_ERROR.value(),
            "INTERNAL_SERVER_ERROR",
            "Something went wrong on our end. Please try again in a moment.",
            uri
        );
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
    }

    @ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleSpringAccessDenied(
        org.springframework.security.access.AccessDeniedException ex,
        HttpServletRequest request
    ) {
        org.springframework.security.core.Authentication auth =
            org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth instanceof org.springframework.security.authentication.AnonymousAuthenticationToken) {
            ErrorResponse error = ErrorResponse.of(
                HttpStatus.UNAUTHORIZED.value(),
                "UNAUTHORIZED",
                "Please sign in to do this.",
                request.getRequestURI()
            );
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error);
        }
        recordAdminDenied(request, "ADMIN role required");
        ErrorResponse error = ErrorResponse.of(
            HttpStatus.FORBIDDEN.value(),
            "ACCESS_DENIED",
            "You don't have permission to do this.",
            request.getRequestURI()
        );
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(error);
    }

    @ExceptionHandler(org.springframework.security.authentication.AuthenticationCredentialsNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleAuthenticationCredentialsNotFound(
        org.springframework.security.authentication.AuthenticationCredentialsNotFoundException ex,
        HttpServletRequest request
    ) {
        ErrorResponse error = ErrorResponse.of(
            HttpStatus.UNAUTHORIZED.value(),
            "UNAUTHORIZED",
            "Please sign in to do this.",
            request.getRequestURI()
        );
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error);
    }
}
