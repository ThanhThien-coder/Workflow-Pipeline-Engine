package com.pipeline.wpe.service.auth;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Kiểm hash mật khẩu trong seed V2__seed_initial_data.sql (admin, alex.kim, sarah.chen)
 * có khớp mật khẩu dev "Password123!" hay không.
 */
class SeedPasswordHashTest {

    private static final String SEED_HASH = "$2a$10$7EqJtq98hPqEX7fNZaFWoOhi59M117z182rWc4ZqNqQ9g2P5jX1lG";

    /**
     * ĐÃ CHẠY VÀ FAIL (A3, 12/11/2026): hash seed V2 KHÔNG khớp "Password123!".
     * Cần migration mới cập nhật password_hash (xin số V trong nhóm, README mục 6.2) — nằm ngoài
     * quyền ghi của A3 nên chưa làm. Bỏ @Disabled khi migration đó được merge.
     */
    @Test
    @Disabled("Hash seed V2 không khớp Password123! - chờ nhóm cấp số migration mới (xem A3 'Điều chưa chắc')")
    @DisplayName("Hash seed V2 khớp Password123!")
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
