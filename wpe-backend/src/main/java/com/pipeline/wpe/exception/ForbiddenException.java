package com.pipeline.wpe.exception;

public class ForbiddenException extends RuntimeException {
    private final String errorCode;

    public ForbiddenException(String message) {
        super(message);
        this.errorCode = "ACCESS_DENIED";
    }

    public ForbiddenException(String errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public String getErrorCode() {
        return errorCode;
    }
}

