package com.pipeline.wpe.exception;

/**
 * Lỗi 401. {@code errorCode} được trả về ở trường {@code error} của ErrorResponse
 * (VD: BAD_CREDENTIALS, INVALID_REFRESH_TOKEN, REFRESH_TOKEN_REUSED, TOKEN_EXPIRED).
 */
public class UnauthorizedException extends RuntimeException {
    private final String errorCode;

    public UnauthorizedException(String message) {
        super(message);
        this.errorCode = "UNAUTHORIZED";
    }

    public UnauthorizedException(String errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public String getErrorCode() {
        return errorCode;
    }
}
