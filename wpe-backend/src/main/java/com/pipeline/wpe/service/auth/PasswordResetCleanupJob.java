package com.pipeline.wpe.service.auth;

import com.pipeline.wpe.repository.PasswordResetTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

/** Dọn token đặt lại mật khẩu đã hết hạn hoặc đã dùng quá 7 ngày. Chạy mỗi 6 giờ. */
@Slf4j
@Component
@RequiredArgsConstructor
public class PasswordResetCleanupJob {

    static final Duration RETENTION = Duration.ofDays(7);

    private final PasswordResetTokenRepository tokenRepository;

    @Scheduled(fixedDelay = 6 * 60 * 60 * 1000L, initialDelay = 6 * 60 * 60 * 1000L)
    @Transactional
    public int cleanup() {
        int n = tokenRepository.deleteOlderThan(Instant.now().minus(RETENTION));
        if (n > 0) {
            log.info("Deleted {} old password reset tokens", n);
        }
        return n;
    }
}
