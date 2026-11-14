package com.pipeline.wpe.service.auth;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Kiểm hash mật khẩu trong seed (admin, alex.kim, sarah.chen) do V12 đặt lại
 * có khớp mật khẩu dev "Password123!" hay không.
 */
class SeedPasswordHashTest {

    private static final String SEED_HASH = "$2a$10$k3h0Yz1p9Bdt1ZD/sUHOlOQU60GO0uzP7Aj/.qDk0yrAGJbOiQGOu";

    /**
     * Kiểm hash do V12 đặt lại cho tài khoản dev khớp "Password123!".
     */
    @Test
    @DisplayName("Hash seed do V12 đặt lại khớp Password123!")
    void seedHashMatchesDevPassword() {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);
        assertThat(encoder.matches("Password123!", SEED_HASH)).isTrue();
    }

    @Test
    @DisplayName("Encoder cost 12 vẫn so khớp được hash cost 10 (cost nằm trong chuỗi hash)")
    void cost12EncoderMatchesCost10Hash() {
        String cost10Hash = new BCryptPasswordEncoder(10).encode("Password123!");
        BCryptPasswordEncoder cost12 = new BCryptPasswordEncoder(12);

        assertThat(cost10Hash).startsWith("$2a$10$");
        assertThat(cost12.matches("Password123!", cost10Hash)).isTrue();
        assertThat(cost12.matches("SaiMatKhau!", cost10Hash)).isFalse();
        assertThat(cost12.encode("Password123!")).startsWith("$2a$12$");
    }
}

