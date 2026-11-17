package com.pipeline.wpe.exception;

import lombok.Getter;

/** Tính năng tạm thời không dùng được (VD: chưa cấu hình mail). Map sang HTTP 503 kèm mã lỗi riêng. */
@Getter
public class ServiceUnavailableException extends RuntimeException {
    private final String errorCode;

    public ServiceUnavailableException(String errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }
}
