package com.pipeline.wpe.exception;

public class AccessDeniedException extends ForbiddenException {
    public AccessDeniedException(String message) {
        super("ACCESS_DENIED", message);
    }

    public AccessDeniedException(String errorCode, String message) {
        super(errorCode, message);
    }
}
