package com.pipeline.wpe.exception;

public class CooldownActiveException extends RuntimeException {
    private final long remainingSeconds;

    public CooldownActiveException(long remainingSeconds) {
        super(String.format("AI Diagnosis cooldown đang kích hoạt. Vui lòng chờ thêm %d giây.", remainingSeconds));
        this.remainingSeconds = remainingSeconds;
    }

    public long getRemainingSeconds() {
        return remainingSeconds;
    }
}
