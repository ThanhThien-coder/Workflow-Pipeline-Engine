package com.pipeline.wpe.exception;

public class CooldownActiveException extends RuntimeException {
    private final long remainingSeconds;

    public CooldownActiveException(long remainingSeconds) {
        super(String.format("AI diagnosis is on cooldown. Please wait %d more seconds.", remainingSeconds));
        this.remainingSeconds = remainingSeconds;
    }

    public long getRemainingSeconds() {
        return remainingSeconds;
    }
}

