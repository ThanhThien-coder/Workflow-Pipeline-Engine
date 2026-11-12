package com.pipeline.wpe.service.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * Băm refresh token bằng SHA-256, trả về chuỗi hex chữ thường (64 ký tự).
 * Refresh token đã là chuỗi ngẫu nhiên 256 bit nên không cần salt hay BCrypt (chậm),
 * chỉ cần băm một chiều để DB bị lộ cũng không dùng lại được token gốc.
 */
public final class TokenHasher {

    private static final char[] HEX = "0123456789abcdef".toCharArray();

    private TokenHasher() {
    }

    public static String sha256Hex(String input) {
        if (input == null) {
            throw new IllegalArgumentException("input must not be null");
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            char[] out = new char[hash.length * 2];
            for (int i = 0; i < hash.length; i++) {
                int b = hash[i] & 0xFF;
                out[i * 2] = HEX[b >>> 4];
                out[i * 2 + 1] = HEX[b & 0x0F];
            }
            return new String(out);
        } catch (NoSuchAlgorithmException e) {
            // Mọi JVM chuẩn đều bắt buộc có SHA-256
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
