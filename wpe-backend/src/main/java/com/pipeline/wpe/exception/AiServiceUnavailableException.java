package com.pipeline.wpe.exception;

/** Không gọi được dịch vụ AI (tắt, quá giờ, lỗi 5xx, body rỗng). Map sang HTTP 503 AI_SERVICE_UNAVAILABLE. */
public class AiServiceUnavailableException extends RuntimeException {
    public static final String USER_MESSAGE = "The AI service is temporarily unavailable. Please try again later.";

    /** Lý do kỹ thuật, chỉ để ghi log; KHÔNG trả về cho client. */
    private final String reason;

    public AiServiceUnavailableException(String reason, Throwable cause) {
        super(USER_MESSAGE, cause);
        this.reason = reason;
    }

    public String getReason() {
        return reason;
    }
}
