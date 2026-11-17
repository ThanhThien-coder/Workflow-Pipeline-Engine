package com.pipeline.wpe.service.auth;

import com.pipeline.wpe.entity.PasswordResetTokenEntity;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.exception.BadRequestException;
import com.pipeline.wpe.exception.ServiceUnavailableException;
import com.pipeline.wpe.repository.PasswordResetTokenRepository;
import com.pipeline.wpe.repository.RefreshTokenRepository;
import com.pipeline.wpe.repository.UserRepository;
import com.pipeline.wpe.service.mail.AccountEmailService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;

/** Quên mật khẩu qua email: tạo link đặt lại, kiểm tra link, đặt mật khẩu mới. */
@Slf4j
@Service
public class PasswordResetService {

    public static final String PASSWORD_RESET_UNAVAILABLE = "PASSWORD_RESET_UNAVAILABLE";
    public static final String INVALID_RESET_TOKEN_CODE = "INVALID_RESET_TOKEN";

    public static final String UNAVAILABLE_MESSAGE =
        "Password reset by email isn't available right now. Please contact your workspace administrator.";
    public static final String FORGOT_MESSAGE = "If an account exists for this email, we've sent a password reset link.";
    public static final String INVALID_TOKEN_MESSAGE =
        "This password reset link is invalid or has expired. Please request a new one.";
    public static final String RESET_DONE_MESSAGE =
        "Your password has been reset. You can now sign in with your new password.";

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AccountEmailService emailService;
    private final long tokenTtlMinutes;
    private final long resendCooldownSeconds;
    private final SecureRandom secureRandom = new SecureRandom();

    public PasswordResetService(
        UserRepository userRepository,
        PasswordResetTokenRepository tokenRepository,
        RefreshTokenRepository refreshTokenRepository,
        PasswordEncoder passwordEncoder,
        AccountEmailService emailService,
        @Value("${app.password-reset.token-ttl-minutes:30}") long tokenTtlMinutes,
        @Value("${app.password-reset.resend-cooldown-seconds:60}") long resendCooldownSeconds
    ) {
        this.userRepository = userRepository;
        this.tokenRepository = tokenRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
        this.tokenTtlMinutes = tokenTtlMinutes;
        this.resendCooldownSeconds = resendCooldownSeconds;
    }

    public boolean isEnabled() {
        return emailService.isEnabled();
    }

    /**
     * Luôn thành công với mọi email hợp lệ (không lộ email có tồn tại hay không).
     * Chỉ ném 503 khi tính năng mail đang tắt.
     */
    @Transactional
    public void requestReset(String email) {
        if (!emailService.isEnabled()) {
            throw new ServiceUnavailableException(PASSWORD_RESET_UNAVAILABLE, UNAVAILABLE_MESSAGE);
        }
        String identifier = email == null ? "" : email.trim();
        UserEntity user = identifier.isEmpty() ? null : userRepository.findByEmailIgnoreCase(identifier).orElse(null);
        if (user == null || user.getDeletedAt() != null || Boolean.TRUE.equals(user.getIsLocked())) {
            return;
        }

        Instant now = Instant.now();
        if (tokenRepository.existsByUserIdAndCreatedAtAfter(user.getId(), now.minusSeconds(resendCooldownSeconds))) {
            log.debug("Password reset requested within cooldown for user #{}; ignored.", user.getId());
            return;
        }

        // Link cũ hết hiệu lực
        tokenRepository.markAllUnusedAsUsed(user.getId(), now);

        String rawToken = generateToken();
        tokenRepository.save(PasswordResetTokenEntity.builder()
            .userId(user.getId())
            .tokenHash(TokenHasher.sha256Hex(rawToken))
            .expiresAt(now.plus(Duration.ofMinutes(tokenTtlMinutes)))
            .build());

        emailService.sendPasswordResetAfterCommit(
            user.getId(), user.getEmail(), user.getFullName(), user.getUsername(), rawToken, tokenTtlMinutes);
        log.info("Password reset link issued for user #{}.", user.getId());
    }

    /** Ném 400 INVALID_RESET_TOKEN nếu token không dùng được. */
    @Transactional(readOnly = true)
    public void verifyToken(String rawToken) {
        findUsable(rawToken, Instant.now());
    }

    @Transactional
    public void resetPassword(String rawToken, String newPassword) {
        Instant now = Instant.now();
        Usable usable = findUsable(rawToken, now);
        // Token trước, mật khẩu sau. Mật khẩu yếu thì không đánh dấu token đã dùng.
        PasswordPolicy.validate(newPassword);

        // Giữ chỗ token bằng 1 câu UPDATE có điều kiện: 2 request cùng link chạy đồng thời thì chỉ 1 request thắng.
        if (tokenRepository.markUsedIfUnused(usable.token().getId(), now) == 0) {
            throw invalidToken();
        }
        usable.token().setUsedAt(now);

        UserEntity user = usable.user();
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setTokenVersion((user.getTokenVersion() == null ? 0 : user.getTokenVersion()) + 1);
        userRepository.save(user);

        refreshTokenRepository.revokeAllByUserId(user.getId());
        tokenRepository.markAllUnusedAsUsed(user.getId(), now);

        emailService.sendPasswordChangedAfterCommit(
            user.getId(), user.getEmail(), user.getFullName(), user.getUsername(), now);
        log.info("Password reset completed for user #{}. Sessions revoked.", user.getId());
    }

    private record Usable(PasswordResetTokenEntity token, UserEntity user) {}

    private Usable findUsable(String rawToken, Instant now) {
        if (rawToken == null || rawToken.isBlank()) {
            throw invalidToken();
        }
        Optional<PasswordResetTokenEntity> found = tokenRepository.findByTokenHash(TokenHasher.sha256Hex(rawToken.trim()));
        if (found.isEmpty()) {
            throw invalidToken();
        }
        PasswordResetTokenEntity token = found.get();
        if (token.getUsedAt() != null || !token.getExpiresAt().isAfter(now)) {
            throw invalidToken();
        }
        UserEntity user = userRepository.findById(token.getUserId()).orElse(null);
        if (user == null || user.getDeletedAt() != null || Boolean.TRUE.equals(user.getIsLocked())) {
            throw invalidToken();
        }
        return new Usable(token, user);
    }

    private String generateToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static BadRequestException invalidToken() {
        return new BadRequestException(INVALID_RESET_TOKEN_CODE, INVALID_TOKEN_MESSAGE);
    }
}
