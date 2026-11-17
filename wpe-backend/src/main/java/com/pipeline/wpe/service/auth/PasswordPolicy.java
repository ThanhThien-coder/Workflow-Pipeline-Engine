package com.pipeline.wpe.service.auth;

import com.pipeline.wpe.exception.BadRequestException;

import java.nio.charset.StandardCharsets;

/** Chính sách mật khẩu mới dùng chung cho đổi mật khẩu và đặt lại mật khẩu. */
public final class PasswordPolicy {

    public static final String WEAK_PASSWORD = "WEAK_PASSWORD";
    public static final String WEAK_PASSWORD_MESSAGE =
        "The new password must be at least 8 characters, include at least one digit, and be no longer than 72 bytes.";

    private PasswordPolicy() {
    }

    /** Ném 400 WEAK_PASSWORD nếu mật khẩu không đạt: >= 8 ký tự, có ít nhất 1 chữ số, <= 72 byte UTF-8. */
    public static void validate(String password) {
        if (password == null
            || password.length() < 8
            || !password.matches(".*\\d.*")
            || password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new BadRequestException(WEAK_PASSWORD, WEAK_PASSWORD_MESSAGE);
        }
    }
}
